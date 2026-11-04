import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import { useShallow } from 'zustand/react/shallow';
import { USDC_TOKEN_ID } from '@rabby-wallet/hyperliquid-sdk';

import type { PerpsProInfoTab } from '@/core/services/perpsService';
import { usePerpsRuntimeStatus } from '@/hooks/perps/runtime/usePerpsRuntimeStatus';
import { getPerpsRuntimeIdentity } from '@/hooks/perps/runtime/perpsRuntimeState';
import {
  fetchStakingSummaryHttp,
  isPerpsUserAbstractionReadyForAccount,
  perpsStore,
  usePerpsStore,
} from '@/hooks/perps/usePerpsStore';
import { getPerpsPendingFundingCount } from '@/hooks/perps/funding/fundingJournal';

import {
  buildPerpsOpenOrdersFromTopology,
  filterPerpsOpenOrders,
  getPerpsOpenOrderCounts,
  type PerpsOpenOrderCategory,
  type PerpsOpenOrderViewModel,
} from '../model/openOrder';
import { buildPerpsOpenOrderTopology } from '../model/openOrderTopology';
import {
  resolvePerpsProCollectionPresentation,
  resolvePerpsProInfoTabPresentation,
  type PerpsProAutomaticInfoTabSelection,
  type PerpsProCollectionPresentation,
} from '../model/infoPanelPresentation';
import {
  buildPerpsPositionsFromTopology,
  filterPerpsPositionsForMarket,
  type PerpsPositionViewModel,
} from '../model/position';
import { usePerpsProInfoPreferences } from './usePerpsProInfoPreferences';
import { createPerpsProAccountSelectors } from './perpsProAccountSelectors';

export type PerpsProAccountPanelState =
  | 'noAccount'
  | 'loading'
  | 'error'
  | 'ready';

export const usePerpsProInfoPanel = (
  canonicalCoin: string,
  requestedInfoTab: PerpsProInfoTab | null = null,
  sceneActive = true,
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
      stakingStatus: state.stakingStatus,
      userAbstraction: state.userAbstraction,
      userAbstractionReady: isPerpsUserAbstractionReadyForAccount(state),
    })),
  );
  const pendingFundingCount = perpsStore(state =>
    getPerpsPendingFundingCount(state.localLoadingHistory),
  );
  const accountSelectors = useMemo(createPerpsProAccountSelectors, []);
  // Keep readiness/risk live at the scene. Numeric valuation belongs only to
  // retained Account leaves, under their existing activity boundary.
  const accountControl = perpsStore(useShallow(accountSelectors.control));
  const accountAssetKeys = perpsStore(useShallow(accountSelectors.assetKeys));

  const accountPagePrepared =
    preferences.activeInfoTab !== 'openOrders' ||
    requestedInfoTab === 'account';

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

  const openOrderTopology = useMemo(
    () => buildPerpsOpenOrderTopology(facts.openOrders),
    [facts.openOrders],
  );
  // Spot valuation can change the Account view without changing position risk.
  // Keep the actual risk input reactive, not the whole Account presentation.
  const accountMarginRatio = accountControl.marginRatio;
  const allPositions = useMemo(
    () =>
      buildPerpsPositionsFromTopology(
        facts.clearinghouseState?.assetPositions || [],
        openOrderTopology,
        accountMarginRatio,
      ),
    [
      accountMarginRatio,
      facts.clearinghouseState?.assetPositions,
      openOrderTopology,
    ],
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
    accountControl.mode === 'portfolioMargin'
      ? facts.spotState.tokenToAvailableAfterMaintenance?.find(
          ([tokenId]) => tokenId === USDC_TOKEN_ID,
        )?.[1] ?? null
      : accountControl.mode === 'unified'
      ? facts.spotState.accountValue ?? null
      : facts.clearinghouseState?.marginSummary?.accountValue ?? null;
  const fundingAccountValueReady =
    !!runtimeAccountIdentity &&
    runtime.status === 'ready' &&
    runtime.identity === runtimeAccountIdentity &&
    facts.userAbstractionReady &&
    (accountControl.mode === 'standard'
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
  // Prepared neighbours are retained offscreen. Refresh only while Account
  // is displayed, including a tap before its native pager transition settles.
  const accountPageActive =
    sceneActive && (requestedInfoTab ?? activeInfoTab) === 'account';
  const currentAccountAddress = facts.currentAccount?.address;
  useEffect(() => {
    if (!accountPageActive || !currentAccountAddress) {
      return;
    }
    fetchStakingSummaryHttp(currentAccountAddress);
    const timer = setInterval(() => {
      fetchStakingSummaryHttp(currentAccountAddress);
    }, 60_000);
    return () => clearInterval(timer);
  }, [accountPageActive, currentAccountAddress]);
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
  const openOrdersByCategory = useMemo<
    Record<'basic' | 'conditional', PerpsOpenOrderViewModel[]>
  >(
    () => ({
      basic: filterPerpsOpenOrders({
        canonicalCoin,
        category: 'basic',
        hideOtherSymbols: hideOtherOpenOrderSymbols,
        orders: allOpenOrders,
      }),
      conditional: filterPerpsOpenOrders({
        canonicalCoin,
        category: 'conditional',
        hideOtherSymbols: hideOtherOpenOrderSymbols,
        orders: allOpenOrders,
      }),
    }),
    [allOpenOrders, canonicalCoin, hideOtherOpenOrderSymbols],
  );
  const openOrders = openOrdersByCategory[openOrderCategory];
  const hasAccount = !!facts.currentAccount;
  const openOrderCollectionPresentationByCategory = useMemo<
    Record<'basic' | 'conditional', PerpsProCollectionPresentation>
  >(() => {
    const collectionFacts = {
      hasAccount,
      runtimeReady: runtime.status === 'ready',
      sourceReady: facts.isOpenOrdersReady,
      totalCount: facts.openOrders.length,
    };
    return {
      basic: resolvePerpsProCollectionPresentation({
        ...collectionFacts,
        visibleCount: openOrdersByCategory.basic.length,
      }),
      conditional: resolvePerpsProCollectionPresentation({
        ...collectionFacts,
        visibleCount: openOrdersByCategory.conditional.length,
      }),
    };
  }, [
    facts.isOpenOrdersReady,
    facts.openOrders.length,
    hasAccount,
    openOrdersByCategory,
    runtime.status,
  ]);
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
    if (facts.stakingStatus === 'error') {
      return 'error';
    }
    if (
      runtime.status !== 'ready' ||
      !facts.isUserDataReady ||
      !facts.isSpotStateReady ||
      !facts.userAbstractionReady ||
      !facts.spotMeta ||
      facts.stakingStatus !== 'success'
    ) {
      return 'loading';
    }
    if (accountControl.hasUnresolvedDexes) {
      return 'error';
    }
    if (accountControl.hasUnpricedNonZeroAssets) {
      return 'loading';
    }
    return 'ready';
  }, [
    accountControl,
    facts.currentAccount,
    facts.isSpotStateReady,
    facts.isUserDataReady,
    facts.spotMeta,
    facts.spotMetaStatus,
    facts.stakingStatus,
    facts.userAbstractionReady,
    runtime.status,
  ]);

  const { status: runtimeStatus, retry: retryRuntime } = runtime;
  const retryAccount = useCallback(() => {
    if (runtimeStatus === 'error') {
      retryRuntime();
    }
    fetchMarketData();
    fetchSpotMeta(true);
    fetchStakingSummaryHttp();
  }, [fetchMarketData, fetchSpotMeta, retryRuntime, runtimeStatus]);

  return {
    accountControl,
    accountAssetKeys,
    accountSelectors,
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
    openOrderCollectionPresentation:
      openOrderCollectionPresentationByCategory[openOrderCategory],
    openOrderCollectionPresentationByCategory,
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
    openOrdersByCategory,
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
