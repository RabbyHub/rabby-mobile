import { useIsFocused, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useShallow } from 'zustand/react/shallow';

import { RootNames } from '@/constant/layout';
import { getPerpsRuntimeIdentity } from '@/hooks/perps/runtime/perpsRuntimeState';
import { usePerpsRuntimeStatus } from '@/hooks/perps/runtime/usePerpsRuntimeStatus';
import { PERPS_BOOK_ATOMIC_SWITCH_BUDGET_MS } from '@/hooks/perps/subscriptions/perpsBookTypes';
import { perpsStore, usePerpsStore } from '@/hooks/perps/usePerpsStore';
import type { TransactionNavigatorParamList } from '@/navigation-type';

import {
  buildPerpsProMarket,
  buildPerpsProMarkets,
  type PerpsProMarket,
} from '../model/market';
import type { PerpsProLeverageConfiguration } from '../model/leverage';
import { getPerpTickOptions } from '../model/orderBook';
import { resolveInitialPerpsProMarket } from '../model/resolveInitialMarket';
import {
  getPerpsProMarketSession,
  setPerpsProSessionMarket,
} from '../session/perpsProMarketSession';
import {
  prefetchPerpsProZeroAddressLeverageBaseline,
  preparePerpsProLeverageSources,
  readPerpsProAccountLeverageConfiguration,
  readPerpsProZeroAddressLeverageBaseline,
} from './perpsProZeroAddressLeverageBaseline';
import {
  prewarmPerpsProRealtimeDisplaySnapshot,
  prewarmPerpsProRealtimeIntent,
  waitForPerpsProRealtimeDisplaySnapshot,
} from './perpsProEntryIntent';
import { usePerpsBookPrecision } from './usePerpsBookPrecision';

const getStaticMarketSignature = (market: {
  brief?: string;
  categoryId?: string;
  dexId: string;
  displayName: string;
  logoUrl: string;
  name: string;
  quoteAsset: string;
  szDecimals: number;
}) =>
  [
    market.name,
    market.dexId,
    market.displayName,
    market.quoteAsset,
    market.szDecimals,
    market.logoUrl,
    market.categoryId ?? '',
    market.brief ?? '',
  ].join('|');

type PreparedMarketSelection = {
  accountIdentity: string | null;
  accountLeverageConfiguration: PerpsProLeverageConfiguration | null;
  marketKey: string;
  zeroAddressLeverageBaseline: PerpsProLeverageConfiguration | null;
};

export const usePerpsProScene = () => {
  const route =
    useRoute<
      RouteProp<TransactionNavigatorParamList, typeof RootNames.Perps>
    >();
  const isFocused = useIsFocused();
  const runtime = usePerpsRuntimeStatus();
  const { fetchMarketData } = usePerpsStore();
  const accountIdentity = perpsStore(state =>
    state.currentPerpsAccount
      ? getPerpsRuntimeIdentity(state.currentPerpsAccount)
      : null,
  );
  const accountAddress = perpsStore(
    state => state.currentPerpsAccount?.address ?? null,
  );
  const [appState, setAppState] = useState<AppStateStatus>(
    AppState.currentState,
  );
  const [marketSelection, setMarketSelection] =
    useState<PreparedMarketSelection | null>(null);
  const marketSelectionRef = useRef<PreparedMarketSelection | null>(null);
  const marketSelectionSequenceRef = useRef(0);
  const pendingMarketSelectionRef = useRef<{
    accountIdentity: string | null;
    marketKey: string;
  } | null>(null);
  const pendingRealtimeIntentRef = useRef<{
    cancel: () => void;
    sequence: number;
  } | null>(null);
  const pressedRealtimeIntentRef = useRef<{
    cancel: () => void;
    marketKey: string;
  } | null>(null);
  const navigationMarketRef = useRef(route.params?.market);
  const navigationMarketCandidatesRef = useRef(route.params?.marketCandidates);
  const navigationMarketConsumedRef = useRef(false);

  const marketCatalogueSignature = perpsStore(
    useShallow(state => state.marketData.map(getStaticMarketSignature)),
  );
  const marketDataStatus = perpsStore(state => state.marketDataStatus);

  const catalogue = useMemo(() => {
    const currentMarketData = perpsStore.getState().marketData;
    return currentMarketData.length === marketCatalogueSignature.length
      ? buildPerpsProMarkets(currentMarketData)
      : [];
  }, [marketCatalogueSignature]);

  const catalogueRef = useRef(catalogue);
  catalogueRef.current = catalogue;
  const synchronousMarketSelection =
    useMemo<PreparedMarketSelection | null>(() => {
      if (
        marketSelection?.accountIdentity === accountIdentity ||
        catalogue.length === 0
      ) {
        return null;
      }
      const resolved = resolveInitialPerpsProMarket({
        markets: catalogue,
        navigationMarket: navigationMarketConsumedRef.current
          ? undefined
          : navigationMarketRef.current,
        navigationMarketCandidates: navigationMarketConsumedRef.current
          ? undefined
          : navigationMarketCandidatesRef.current,
        sessionMarketKey: getPerpsProMarketSession().marketKey,
      });
      if (!resolved) {
        return null;
      }
      const zeroAddressLeverageBaseline =
        readPerpsProZeroAddressLeverageBaseline(resolved.canonicalCoin);
      const accountLeverageConfiguration = accountAddress
        ? readPerpsProAccountLeverageConfiguration(
            resolved.canonicalCoin,
            accountAddress,
          )
        : null;
      if (
        (accountAddress && !accountLeverageConfiguration) ||
        (!accountAddress && !zeroAddressLeverageBaseline)
      ) {
        return null;
      }
      return {
        accountIdentity,
        accountLeverageConfiguration,
        marketKey: resolved.marketKey,
        zeroAddressLeverageBaseline,
      };
    }, [accountAddress, accountIdentity, catalogue, marketSelection]);
  const effectiveMarketSelection =
    marketSelection?.accountIdentity === accountIdentity
      ? marketSelection
      : synchronousMarketSelection;
  if (
    effectiveMarketSelection &&
    marketSelectionRef.current?.accountIdentity !== accountIdentity
  ) {
    marketSelectionRef.current = effectiveMarketSelection;
  }

  const releasePendingRealtimeIntent = useCallback(
    (sequence?: number, cancel = true) => {
      const intent = pendingRealtimeIntentRef.current;
      if (!intent || (sequence != null && intent.sequence !== sequence)) {
        return;
      }
      pendingRealtimeIntentRef.current = null;
      if (cancel) {
        intent.cancel();
      }
    },
    [],
  );

  const releasePressedRealtimeIntent = useCallback((marketKey?: string) => {
    const intent = pressedRealtimeIntentRef.current;
    if (!intent || (marketKey != null && intent.marketKey !== marketKey)) {
      return;
    }
    pressedRealtimeIntentRef.current = null;
    intent.cancel();
  }, []);

  const startMarketRealtimeIntent = useCallback(
    (market: PerpsProMarket) => {
      if (marketSelectionRef.current?.marketKey === market.marketKey) {
        releasePressedRealtimeIntent();
        return;
      }
      if (pressedRealtimeIntentRef.current?.marketKey === market.marketKey) {
        return;
      }
      releasePressedRealtimeIntent();
      try {
        pressedRealtimeIntentRef.current = {
          cancel: prewarmPerpsProRealtimeIntent(market),
          marketKey: market.marketKey,
        };
      } catch (error) {
        console.error('[usePerpsProScene] start press intent failed', error);
      }
    },
    [releasePressedRealtimeIntent],
  );

  const prepareMarketSelection = useCallback(
    async (market: PerpsProMarket, prewarmRealtime: boolean) => {
      const selectedAccount = perpsStore.getState().currentPerpsAccount;
      const selectedAccountIdentity = selectedAccount
        ? getPerpsRuntimeIdentity(selectedAccount)
        : null;
      if (
        marketSelectionRef.current?.marketKey === market.marketKey &&
        marketSelectionRef.current.accountIdentity === selectedAccountIdentity
      ) {
        marketSelectionSequenceRef.current += 1;
        pendingMarketSelectionRef.current = null;
        releasePendingRealtimeIntent();
        releasePressedRealtimeIntent();
        return true;
      }
      const sequence = ++marketSelectionSequenceRef.current;
      pendingMarketSelectionRef.current = {
        accountIdentity: selectedAccountIdentity,
        marketKey: market.marketKey,
      };
      releasePendingRealtimeIntent();
      const currentPressedIntent = pressedRealtimeIntentRef.current;
      const pressedIntent =
        prewarmRealtime && currentPressedIntent?.marketKey === market.marketKey
          ? currentPressedIntent
          : null;
      if (pressedIntent) {
        pressedRealtimeIntentRef.current = null;
      } else {
        releasePressedRealtimeIntent();
      }
      let displaySnapshotDeadline: number | null = null;
      if (prewarmRealtime) {
        try {
          pendingRealtimeIntentRef.current = {
            cancel:
              pressedIntent?.cancel ?? prewarmPerpsProRealtimeIntent(market),
            sequence,
          };
        } catch (error) {
          console.error('[usePerpsProScene] prewarm realtime failed', error);
        }
        try {
          displaySnapshotDeadline =
            Date.now() + PERPS_BOOK_ATOMIC_SWITCH_BUDGET_MS;
          void prewarmPerpsProRealtimeDisplaySnapshot(market);
        } catch (error) {
          console.error(
            '[usePerpsProScene] prewarm display snapshot failed',
            error,
          );
        }
      }

      let preparedSources;
      try {
        preparedSources = await preparePerpsProLeverageSources(
          market.canonicalCoin,
          selectedAccount?.address,
        );
      } catch (error) {
        if (sequence === marketSelectionSequenceRef.current) {
          pendingMarketSelectionRef.current = null;
        }
        releasePendingRealtimeIntent(sequence);
        console.error('[usePerpsProScene] prepare market failed', error);
        return false;
      }
      if (displaySnapshotDeadline != null) {
        try {
          await waitForPerpsProRealtimeDisplaySnapshot(
            market,
            Math.max(0, displaySnapshotDeadline - Date.now()),
          );
        } catch (error) {
          console.error(
            '[usePerpsProScene] wait display snapshot failed',
            error,
          );
        }
      }
      if (sequence !== marketSelectionSequenceRef.current) {
        releasePendingRealtimeIntent(sequence);
        return false;
      }
      const liveAccount = perpsStore.getState().currentPerpsAccount;
      const liveAccountIdentity = liveAccount
        ? getPerpsRuntimeIdentity(liveAccount)
        : null;
      if (liveAccountIdentity !== selectedAccountIdentity) {
        pendingMarketSelectionRef.current = null;
        releasePendingRealtimeIntent(sequence);
        return false;
      }
      if (
        !catalogueRef.current.some(item => item.marketKey === market.marketKey)
      ) {
        pendingMarketSelectionRef.current = null;
        releasePendingRealtimeIntent(sequence);
        return false;
      }

      const nextSelection = {
        accountIdentity: selectedAccountIdentity,
        accountLeverageConfiguration:
          preparedSources.accountLeverageConfiguration,
        marketKey: market.marketKey,
        zeroAddressLeverageBaseline:
          preparedSources.zeroAddressLeverageBaseline,
      };
      pendingMarketSelectionRef.current = null;
      marketSelectionRef.current = nextSelection;
      setMarketSelection(nextSelection);
      setPerpsProSessionMarket(market.marketKey);
      // The intent remains bounded by its first-frame/timeout owner. Clearing
      // this ref without cancelling lets the Scene join the same registry.
      releasePendingRealtimeIntent(sequence, false);
      return true;
    },
    [releasePendingRealtimeIntent, releasePressedRealtimeIntent],
  );

  const selectMarket = useCallback(
    (market: PerpsProMarket) => prepareMarketSelection(market, true),
    [prepareMarketSelection],
  );

  const selectMarketByCoin = useCallback(
    (coin: string) => {
      const market = catalogueRef.current.find(
        item => item.canonicalCoin === coin,
      );
      return market
        ? prepareMarketSelection(market, true)
        : Promise.resolve(false);
    },
    [prepareMarketSelection],
  );

  const cancelPendingMarketSelection = useCallback(() => {
    marketSelectionSequenceRef.current += 1;
    pendingMarketSelectionRef.current = null;
    releasePendingRealtimeIntent();
    releasePressedRealtimeIntent();
  }, [releasePendingRealtimeIntent, releasePressedRealtimeIntent]);

  const prefetchMarket = useCallback((coin: string) => {
    prefetchPerpsProZeroAddressLeverageBaseline(coin);
  }, []);

  useEffect(() => {
    if (
      marketSelection?.accountIdentity === accountIdentity ||
      !synchronousMarketSelection
    ) {
      return;
    }
    marketSelectionRef.current = synchronousMarketSelection;
    setMarketSelection(synchronousMarketSelection);
    setPerpsProSessionMarket(synchronousMarketSelection.marketKey);
  }, [accountIdentity, marketSelection, synchronousMarketSelection]);

  useEffect(() => {
    if (catalogue.length === 0) {
      cancelPendingMarketSelection();
      marketSelectionRef.current = null;
      setMarketSelection(null);
      return;
    }
    const resolved = resolveInitialPerpsProMarket({
      markets: catalogue,
      navigationMarket: navigationMarketConsumedRef.current
        ? undefined
        : navigationMarketRef.current,
      navigationMarketCandidates: navigationMarketConsumedRef.current
        ? undefined
        : navigationMarketCandidatesRef.current,
      sessionMarketKey:
        pendingMarketSelectionRef.current?.marketKey ??
        marketSelectionRef.current?.marketKey ??
        getPerpsProMarketSession().marketKey,
    });
    navigationMarketConsumedRef.current = true;
    if (
      resolved &&
      (resolved.marketKey !== marketSelectionRef.current?.marketKey ||
        accountIdentity !== marketSelectionRef.current?.accountIdentity) &&
      (resolved.marketKey !== pendingMarketSelectionRef.current?.marketKey ||
        accountIdentity !== pendingMarketSelectionRef.current?.accountIdentity)
    ) {
      void prepareMarketSelection(resolved, false);
    }
  }, [
    accountIdentity,
    cancelPendingMarketSelection,
    catalogue,
    prepareMarketSelection,
  ]);

  useEffect(
    () => () => {
      marketSelectionSequenceRef.current += 1;
      pendingMarketSelectionRef.current = null;
      releasePendingRealtimeIntent();
      releasePressedRealtimeIntent();
    },
    [releasePendingRealtimeIntent, releasePressedRealtimeIntent],
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', setAppState);
    return () => subscription.remove();
  }, []);

  const preparedCatalogueMarket = useMemo(
    () =>
      catalogue.find(
        item => item.marketKey === effectiveMarketSelection?.marketKey,
      ) ?? null,
    [catalogue, effectiveMarketSelection?.marketKey],
  );
  const catalogueMarket = useMemo(
    () =>
      preparedCatalogueMarket ??
      resolveInitialPerpsProMarket({
        markets: catalogue,
        navigationMarket: navigationMarketConsumedRef.current
          ? undefined
          : navigationMarketRef.current,
        navigationMarketCandidates: navigationMarketConsumedRef.current
          ? undefined
          : navigationMarketCandidatesRef.current,
        sessionMarketKey:
          pendingMarketSelectionRef.current?.marketKey ??
          marketSelectionRef.current?.marketKey ??
          getPerpsProMarketSession().marketKey,
      }),
    [catalogue, preparedCatalogueMarket],
  );
  const isResolvingMarket = catalogue.length > 0 && catalogueMarket == null;
  const canonicalCoin = catalogueMarket?.canonicalCoin ?? '';
  const liveMarketData = perpsStore(state =>
    canonicalCoin ? state.marketDataMap[canonicalCoin] : undefined,
  );
  const currentMarket = useMemo<PerpsProMarket | null>(
    () =>
      liveMarketData ? buildPerpsProMarket(liveMarketData) : catalogueMarket,
    [catalogueMarket, liveMarketData],
  );
  const hasAuthoritativeCurrentPosition = perpsStore(state => {
    if (!canonicalCoin || !state.isUserDataReady) {
      return false;
    }
    const position = state.currentClearinghouseState?.assetPositions.find(
      item => item.position.coin === canonicalCoin,
    )?.position;
    const size = Number(position?.szi ?? 0);
    return Number.isFinite(size) && Math.abs(size) > 0;
  });
  const hasPreparedTradeConfiguration =
    !!effectiveMarketSelection &&
    effectiveMarketSelection.accountIdentity === accountIdentity &&
    effectiveMarketSelection.marketKey === currentMarket?.marketKey;
  const tradeConfigurationReady =
    !!currentMarket &&
    (hasAuthoritativeCurrentPosition || hasPreparedTradeConfiguration);

  const markPrice = Number(currentMarket?.marketData.markPx);
  const markMagnitude =
    Number.isFinite(markPrice) && markPrice > 0
      ? Math.floor(Math.log10(markPrice))
      : null;
  const tickOptions = useMemo(
    () =>
      markMagnitude == null || currentMarket?.marketData.szDecimals == null
        ? []
        : getPerpTickOptions(
            10 ** markMagnitude,
            currentMarket.marketData.szDecimals,
          ),
    [currentMarket?.marketData.szDecimals, markMagnitude],
  );

  const { precision, selectTickOption, selectedTickOption } =
    usePerpsBookPrecision({
      marketKey: currentMarket?.marketKey ?? null,
      tickOptions,
    });

  const fundingHistoryEnabled =
    runtime.status === 'ready' && isFocused && appState === 'active';
  const klineEnabled = fundingHistoryEnabled && !!currentMarket;
  const subscriptionsEnabled = klineEnabled && !!selectedTickOption;
  const orderBookSubscriptionEnabled =
    runtime.status === 'ready' &&
    isFocused &&
    !!currentMarket &&
    !!selectedTickOption;

  const retryMarketData = useCallback(() => {
    fetchMarketData();
  }, [fetchMarketData]);

  return {
    accountLeverageConfiguration:
      effectiveMarketSelection &&
      currentMarket?.marketKey === effectiveMarketSelection.marketKey &&
      effectiveMarketSelection.accountIdentity === accountIdentity
        ? effectiveMarketSelection.accountLeverageConfiguration
        : null,
    cancelPendingMarketSelection,
    currentMarket,
    executionActive: klineEnabled && tradeConfigurationReady,
    fundingHistoryEnabled,
    isResolvingMarket,
    klineEnabled,
    marketDataStatus,
    precision,
    prefetchMarket,
    orderBookSubscriptionEnabled,
    realtimeEnabled: subscriptionsEnabled,
    retryMarketData,
    cancelMarketRealtimeIntent: releasePressedRealtimeIntent,
    selectMarket,
    selectMarketByCoin,
    selectTickOption,
    startMarketRealtimeIntent,
    selectedTickOption,
    tickOptions,
    tradeConfigurationReady,
    zeroAddressLeverageBaseline:
      effectiveMarketSelection &&
      currentMarket?.marketKey === effectiveMarketSelection.marketKey
        ? effectiveMarketSelection.zeroAddressLeverageBaseline
        : null,
  };
};
