import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  USDC_TOKEN_ID,
  type WsFastAssetCtxs,
} from '@rabby-wallet/hyperliquid-sdk';

import type { PerpsProInfoTab } from '@/core/services/perpsService';
import { usePerpsRuntimeStatus } from '@/hooks/perps/runtime/usePerpsRuntimeStatus';
import { getPerpsRuntimeIdentity } from '@/hooks/perps/runtime/perpsRuntimeState';
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
} from '../model/account';
import {
  buildPerpsOpenOrdersFromTopology,
  filterPerpsOpenOrders,
  getPerpsOpenOrderCounts,
  type PerpsOpenOrderCategory,
} from '../model/openOrder';
import { buildPerpsOpenOrderTopology } from '../model/openOrderTopology';
import {
  resolvePerpsProCollectionPresentation,
  resolvePerpsProInfoTabPresentation,
  type PerpsProAutomaticInfoTabSelection,
} from '../model/infoPanelPresentation';
import {
  buildPerpsPositionsFromTopology,
  filterPerpsPositionsForMarket,
  type PerpsPositionViewModel,
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

export const usePerpsProInfoPanel = (
  canonicalCoin: string,
  requestedInfoTab: PerpsProInfoTab | null = null,
) => {
  const preferences = usePerpsProInfoPreferences();
  const runtime = usePerpsRuntimeStatus();
  const { fetchMarketData, fetchSpotMeta } = usePerpsStore();
  const [hideOtherPositionSymbols, setHideOtherPositionSymbols] =
    useState(false);
  const [hideOtherOpenOrderSymbols, setHideOtherOpenOrderSymbols] =
    useState(false);
  const [openOrderCategory, setOpenOrderCategory] =
    useState<Exclude<PerpsOpenOrderCategory, 'unsupported'>>('basic');

  const facts = perpsStore(
    useShallow(state => ({
      clearinghouseState: state.currentClearinghouseState,
      currentAccount: state.currentPerpsAccount,
      isSpotStateReady: state.isSpotStateReady,
      isFetchAllDone: state.isFetchAllDone,
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

  const accountPagePrepared =
    preferences.activeInfoTab !== 'openOrders' ||
    requestedInfoTab === 'account';
  const priceDependencyKeys = useMemo(
    () =>
      accountPagePrepared
        ? getSpotPriceDependencyKeys(
            facts.spotState.rawBalances
              .filter(balance => Number(balance.total) !== 0)
              .map(balance => balance.coin),
            facts.spotMeta,
          )
        : [],
    [accountPagePrepared, facts.spotMeta, facts.spotState.rawBalances],
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
      accountPagePrepared &&
      facts.currentAccount &&
      facts.spotMetaStatus === 'idle'
    ) {
      fetchSpotMeta();
    }
  }, [
    accountPagePrepared,
    facts.currentAccount,
    facts.spotMetaStatus,
    fetchSpotMeta,
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
  const openOrderTopology = useMemo(
    () => buildPerpsOpenOrderTopology(facts.openOrders),
    [facts.openOrders],
  );
  const allPositions = useMemo(
    () =>
      buildPerpsPositionsFromTopology(
        facts.clearinghouseState?.assetPositions || [],
        openOrderTopology,
        getPerpsAccountMarginRatio(account),
      ),
    [account, facts.clearinghouseState?.assetPositions, openOrderTopology],
  );
  const allPositionsByCoin = useMemo<
    ReadonlyMap<string, PerpsPositionViewModel>
  >(
    () => new Map(allPositions.map(position => [position.coin, position])),
    [allPositions],
  );
  const accountIdentity = facts.currentAccount
    ? facts.currentAccount.address.toLowerCase() +
      ':' +
      facts.currentAccount.type
    : 'no-account';
  const runtimeAccountIdentity = facts.currentAccount
    ? getPerpsRuntimeIdentity(facts.currentAccount)
    : null;
  const fundingAccountValue =
    account.mode === 'portfolioMargin'
      ? facts.spotState.tokenToAvailableAfterMaintenance?.find(
          ([tokenId]) => tokenId === USDC_TOKEN_ID,
        )?.[1] ?? null
      : account.mode === 'unified'
      ? facts.spotState.accountValue ?? null
      : facts.clearinghouseState?.marginSummary?.accountValue ?? null;
  const fundingAccountValueReady =
    !!runtimeAccountIdentity &&
    runtime.status === 'ready' &&
    runtime.identity === runtimeAccountIdentity &&
    facts.userAbstractionReady &&
    (account.mode === 'standard'
      ? facts.isUserDataReady
      : facts.isSpotStateReady);
  const accountFactsReady =
    !!runtimeAccountIdentity &&
    runtime.status === 'ready' &&
    runtime.identity === runtimeAccountIdentity &&
    facts.isUserDataReady &&
    facts.userAbstractionReady;
  const [automaticInfoTabSelection, setAutomaticInfoTabSelection] =
    useState<PerpsProAutomaticInfoTabSelection | null>(null);
  const infoTabPresentation = resolvePerpsProInfoTabPresentation({
    accountFactsReady,
    accountIdentity: facts.currentAccount ? accountIdentity : null,
    accountSelectionReady: facts.isFetchAllDone,
    activeInfoTabPreference: preferences.activeInfoTab,
    hasUserSelectedInfoTab: preferences.hasUserSelectedInfoTab,
    positionCount: allPositions.length,
    preferencesHydrated: preferences.hydrated,
    previousAutomaticSelection: automaticInfoTabSelection,
  });
  useLayoutEffect(() => {
    const nextSelection = infoTabPresentation.automaticSelection;
    if (!nextSelection) {
      return;
    }
    setAutomaticInfoTabSelection(current =>
      current?.accountIdentity === nextSelection.accountIdentity &&
      current.activeInfoTab === nextSelection.activeInfoTab
        ? current
        : nextSelection,
    );
  }, [infoTabPresentation.automaticSelection]);
  const activeInfoTab = infoTabPresentation.activeInfoTab;
  const allOpenOrders = useMemo(
    () => buildPerpsOpenOrdersFromTopology(openOrderTopology),
    [openOrderTopology],
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
        hideOtherPositionSymbols,
      ),
    [allPositions, canonicalCoin, hideOtherPositionSymbols],
  );
  const openOrders = useMemo(
    () =>
      filterPerpsOpenOrders({
        canonicalCoin,
        category: openOrderCategory,
        hideOtherSymbols: hideOtherOpenOrderSymbols,
        orders: allOpenOrders,
      }),
    [
      allOpenOrders,
      canonicalCoin,
      hideOtherOpenOrderSymbols,
      openOrderCategory,
    ],
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
    if (facts.spotMetaStatus === 'error' && !facts.spotMeta) {
      return 'error';
    }
    if (
      runtime.status !== 'ready' ||
      !facts.isUserDataReady ||
      !facts.isSpotStateReady ||
      !facts.userAbstractionReady ||
      !facts.spotMeta
    ) {
      return 'loading';
    }
    if (account.diagnostics.unresolvedDexes.length > 0) {
      return 'error';
    }
    return 'ready';
  }, [
    account,
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
    fetchSpotMeta(true);
  }, [fetchMarketData, fetchSpotMeta, runtime]);

  return {
    account,
    currentAccount: facts.currentAccount,
    accountIdentity: facts.currentAccount
      ? `${facts.currentAccount.address.toLowerCase()}:${
          facts.currentAccount.type
        }`
      : 'no-account',
    accountState,
    activeInfoTab,
    allOpenOrdersCount: openOrderCounts.basic + openOrderCounts.conditional,
    allPositionsCount: allPositions.length,
    allPositionsByCoin,
    openOrderCollectionPresentation: resolvePerpsProCollectionPresentation({
      hasAccount: !!facts.currentAccount,
      runtimeReady: runtime.status === 'ready',
      sourceReady: facts.isOpenOrdersReady,
      totalCount: facts.openOrders.length,
      visibleCount: openOrders.length,
    }),
    positionCollectionPresentation: resolvePerpsProCollectionPresentation({
      hasAccount: !!facts.currentAccount,
      runtimeReady: runtime.status === 'ready',
      sourceReady: facts.isUserDataReady,
      totalCount: allPositions.length,
      visibleCount: positions.length,
    }),
    hideOtherOpenOrderSymbols,
    hideOtherPositionSymbols,
    fundingAccountValue,
    fundingAccountValueReady,
    hydrated: preferences.hydrated,
    openOrderCategory,
    openOrderCommandCandidates,
    openOrderCounts,
    openOrders,
    pendingFundingCount,
    positions,
    retryAccount,
    setActiveInfoTab: preferences.setActiveInfoTab,
    setHideOtherOpenOrderSymbols,
    setHideOtherPositionSymbols,
    setOpenOrderCategory,
    userAbstraction: facts.userAbstraction,
    userAbstractionReady: facts.userAbstractionReady,
  };
};
