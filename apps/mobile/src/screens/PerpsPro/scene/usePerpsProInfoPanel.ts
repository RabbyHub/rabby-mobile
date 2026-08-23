import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { WsFastAssetCtxs } from '@rabby-wallet/hyperliquid-sdk';

import { usePerpsRuntimeStatus } from '@/hooks/perps/runtime/usePerpsRuntimeStatus';
import {
  isPerpsUserAbstractionReadyForAccount,
  perpsStore,
  usePerpsStore,
} from '@/hooks/perps/usePerpsStore';
import { getPerpsPendingFundingCount } from '@/hooks/perps/funding/fundingJournal';

import {
  buildPerpsAccountViewModel,
  getPerpsAccountMarginRatio,
  getSpotPriceDependencyKeys,
  resolvePerpsAccountMode,
} from '../model/account';
import {
  buildPerpsOpenOrders,
  filterPerpsOpenOrders,
  getPerpsOpenOrderCounts,
  type PerpsOpenOrderCategory,
} from '../model/openOrder';
import {
  isPerpsProCollectionAuthoritativelyEmpty,
  resolvePerpsProInitialInfoTab,
} from '../model/infoPanelPresentation';
import {
  buildPerpsPositions,
  filterPerpsPositionsForMarket,
} from '../model/position';
import { usePerpsProInfoPreferences } from './usePerpsProInfoPreferences';

export type PerpsProAccountPanelState =
  | 'noAccount'
  | 'loading'
  | 'error'
  | 'ready';

const marketFactSignature = (market: {
  dexId: string;
  name: string;
  quoteAsset: string;
}) => `${market.name}\u0000${market.dexId}\u0000${market.quoteAsset}`;

export const usePerpsProInfoPanel = (canonicalCoin: string) => {
  const preferences = usePerpsProInfoPreferences();
  const runtime = usePerpsRuntimeStatus();
  const { fetchMarketData, fetchSpotMeta } = usePerpsStore();
  const [hideOtherSymbols, setHideOtherSymbols] = useState(false);
  const [openOrderCategory, setOpenOrderCategory] =
    useState<Exclude<PerpsOpenOrderCategory, 'unsupported'>>('basic');

  const facts = perpsStore(
    useShallow(state => ({
      clearinghouseState: state.currentClearinghouseState,
      currentAccount: state.currentPerpsAccount,
      isSpotStateReady: state.isSpotStateReady,
      isUserDataReady: state.isUserDataReady,
      isOpenOrdersReady: state.isOpenOrdersReady,
      marketDataStatus: state.marketDataStatus,
      openOrders: state.openOrders,
      spotMeta: state.spotMeta,
      spotMetaStatus: state.spotMetaStatus,
      spotState: state.spotState,
      userAbstraction: state.userAbstraction,
      userAbstractionReady: isPerpsUserAbstractionReadyForAccount(state),
    })),
  );
  const pendingFundingCount = perpsStore(state =>
    getPerpsPendingFundingCount(state.localLoadingHistory),
  );
  const marketFactSignatures = perpsStore(
    useShallow(state => state.marketData.map(marketFactSignature)),
  );

  const marketDataMap = useMemo(() => {
    const result: Record<
      string,
      {
        coin: string;
        dexId: string;
        quoteAsset: 'USDC' | 'USDT' | 'USDH' | 'USDE';
      }
    > = {};
    for (const signature of marketFactSignatures) {
      const [coin, dexId, quoteAsset] = signature.split('\u0000');
      if (
        coin &&
        (quoteAsset === 'USDC' ||
          quoteAsset === 'USDT' ||
          quoteAsset === 'USDH' ||
          quoteAsset === 'USDE')
      ) {
        result[coin] = { coin, dexId: dexId || '', quoteAsset };
      }
    }
    return result;
  }, [marketFactSignatures]);

  const accountMode = resolvePerpsAccountMode(facts.userAbstraction);
  const priceDependencyKeys = useMemo(
    () =>
      preferences.activeInfoTab === 'account'
        ? getSpotPriceDependencyKeys(
            facts.spotState.rawBalances
              .filter(balance => Number(balance.total) !== 0)
              .map(balance => balance.coin),
            facts.spotMeta,
          )
        : [],
    [facts.spotMeta, facts.spotState.rawBalances, preferences.activeInfoTab],
  );
  const spotPriceValues = perpsStore(
    useShallow(state =>
      priceDependencyKeys.map(
        key => `${key}\u0000${state.spotAssetCtxs[key]?.markPx ?? ''}`,
      ),
    ),
  );
  const spotAssetCtxs = useMemo(
    () =>
      spotPriceValues.reduce((result, value) => {
        const [key, markPx] = value.split('\u0000');
        if (!key) {
          return result;
        }
        result[key] = {
          markPx: markPx || undefined,
        };
        return result;
      }, {} as WsFastAssetCtxs),
    [spotPriceValues],
  );

  useEffect(() => {
    if (
      preferences.activeInfoTab === 'account' &&
      facts.currentAccount &&
      accountMode !== 'standard' &&
      facts.spotMetaStatus === 'idle'
    ) {
      fetchSpotMeta();
    }
  }, [
    accountMode,
    facts.currentAccount,
    facts.spotMetaStatus,
    fetchSpotMeta,
    preferences.activeInfoTab,
  ]);

  const account = useMemo(
    () =>
      buildPerpsAccountViewModel({
        clearinghouseState: facts.clearinghouseState,
        marketDataMap,
        spotAssetCtxs,
        spotMeta: facts.spotMeta,
        spotState: facts.spotState,
        userAbstraction: facts.userAbstraction,
      }),
    [
      facts.clearinghouseState,
      facts.spotMeta,
      facts.spotState,
      facts.userAbstraction,
      marketDataMap,
      spotAssetCtxs,
    ],
  );
  const allPositions = useMemo(
    () =>
      buildPerpsPositions(
        facts.clearinghouseState?.assetPositions || [],
        facts.openOrders,
        getPerpsAccountMarginRatio(account),
      ),
    [account, facts.clearinghouseState?.assetPositions, facts.openOrders],
  );
  const accountIdentity = facts.currentAccount
    ? facts.currentAccount.address.toLowerCase() +
      ':' +
      facts.currentAccount.type
    : 'no-account';
  const initialInfoTab = resolvePerpsProInitialInfoTab(allPositions.length);
  const infoTabInitializationReady =
    preferences.hydrated &&
    (!facts.currentAccount ||
      (runtime.status === 'ready' &&
        facts.isUserDataReady &&
        facts.userAbstractionReady));
  const initializedInfoTabAccountRef = useRef<string | null>(null);
  useEffect(() => {
    if (
      !infoTabInitializationReady ||
      initializedInfoTabAccountRef.current === accountIdentity
    ) {
      return;
    }
    initializedInfoTabAccountRef.current = accountIdentity;
    if (preferences.activeInfoTab !== initialInfoTab) {
      preferences.setActiveInfoTab(initialInfoTab);
    }
  }, [
    accountIdentity,
    infoTabInitializationReady,
    initialInfoTab,
    preferences,
  ]);
  const activeInfoTab =
    infoTabInitializationReady &&
    initializedInfoTabAccountRef.current !== accountIdentity
      ? initialInfoTab
      : preferences.activeInfoTab;
  const allOpenOrders = useMemo(
    () => buildPerpsOpenOrders(facts.openOrders),
    [facts.openOrders],
  );
  const openOrderCounts = useMemo(
    () => getPerpsOpenOrderCounts(allOpenOrders),
    [allOpenOrders],
  );
  const positions = useMemo(
    () =>
      filterPerpsPositionsForMarket(
        allPositions,
        canonicalCoin,
        hideOtherSymbols,
      ),
    [allPositions, canonicalCoin, hideOtherSymbols],
  );
  const openOrders = useMemo(
    () =>
      filterPerpsOpenOrders({
        canonicalCoin,
        category: openOrderCategory,
        hideOtherSymbols,
        orders: allOpenOrders,
      }),
    [allOpenOrders, canonicalCoin, hideOtherSymbols, openOrderCategory],
  );
  const openOrderCommandCandidates = useMemo(
    () => allOpenOrders.filter(order => order.category === openOrderCategory),
    [allOpenOrders, openOrderCategory],
  );

  const accountState = useMemo<PerpsProAccountPanelState>(() => {
    if (!facts.currentAccount || runtime.status === 'waitingForAccount') {
      return 'noAccount';
    }
    if (runtime.status === 'error') {
      return 'error';
    }
    const requiresSpotMeta = accountMode !== 'standard';
    if (
      requiresSpotMeta &&
      facts.spotMetaStatus === 'error' &&
      !facts.spotMeta
    ) {
      return 'error';
    }
    if (
      runtime.status !== 'ready' ||
      !facts.isUserDataReady ||
      !facts.isSpotStateReady ||
      !facts.userAbstractionReady ||
      (requiresSpotMeta && !facts.spotMeta)
    ) {
      return 'loading';
    }
    if (account.diagnostics.unresolvedDexes.length > 0) {
      return 'error';
    }
    return 'ready';
  }, [
    account,
    accountMode,
    facts.currentAccount,
    facts.isSpotStateReady,
    facts.isUserDataReady,
    facts.spotMeta,
    facts.spotMetaStatus,
    facts.userAbstractionReady,
    runtime.status,
  ]);

  const retryAccount = useCallback(() => {
    if (runtime.status === 'error') {
      runtime.retry();
    }
    fetchMarketData();
    if (accountMode !== 'standard') {
      fetchSpotMeta(true);
    }
  }, [accountMode, fetchMarketData, fetchSpotMeta, runtime]);

  return {
    account,
    accountIdentity: facts.currentAccount
      ? `${facts.currentAccount.address.toLowerCase()}:${
          facts.currentAccount.type
        }`
      : 'no-account',
    accountState,
    activeInfoTab,
    allOpenOrdersCount: openOrderCounts.basic + openOrderCounts.conditional,
    allPositionsCount: allPositions.length,
    openOrdersEmpty: isPerpsProCollectionAuthoritativelyEmpty({
      hasAccount: !!facts.currentAccount,
      runtimeReady: runtime.status === 'ready',
      sourceReady: facts.isOpenOrdersReady,
      totalCount: facts.openOrders.length,
    }),
    positionsEmpty: isPerpsProCollectionAuthoritativelyEmpty({
      hasAccount: !!facts.currentAccount,
      runtimeReady: runtime.status === 'ready',
      sourceReady: facts.isUserDataReady,
      totalCount: allPositions.length,
    }),
    hideOtherSymbols,
    hydrated: preferences.hydrated,
    openOrderCategory,
    openOrderCommandCandidates,
    openOrderCounts,
    openOrders,
    pendingFundingCount,
    positions,
    retryAccount,
    setActiveInfoTab: preferences.setActiveInfoTab,
    setHideOtherSymbols,
    setOpenOrderCategory,
  };
};
