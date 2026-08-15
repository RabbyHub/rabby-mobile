import { useIsFocused, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useShallow } from 'zustand/react/shallow';

import { RootNames } from '@/constant/layout';
import { getPerpsRuntimeIdentity } from '@/hooks/perps/runtime/perpsRuntimeState';
import { usePerpsRuntimeStatus } from '@/hooks/perps/runtime/usePerpsRuntimeStatus';
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
import { prewarmPerpsProRealtimeIntent } from './perpsProEntryIntent';
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
  const navigationMarketRef = useRef(route.params?.market);
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
        return true;
      }
      const sequence = ++marketSelectionSequenceRef.current;
      pendingMarketSelectionRef.current = {
        accountIdentity: selectedAccountIdentity,
        marketKey: market.marketKey,
      };
      releasePendingRealtimeIntent();
      if (prewarmRealtime) {
        try {
          pendingRealtimeIntentRef.current = {
            cancel: prewarmPerpsProRealtimeIntent(market),
            sequence,
          };
        } catch (error) {
          console.error('[usePerpsProScene] prewarm realtime failed', error);
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
    [releasePendingRealtimeIntent],
  );

  const selectMarket = useCallback(
    (market: PerpsProMarket) => prepareMarketSelection(market, true),
    [prepareMarketSelection],
  );

  const cancelPendingMarketSelection = useCallback(() => {
    marketSelectionSequenceRef.current += 1;
    pendingMarketSelectionRef.current = null;
    releasePendingRealtimeIntent();
  }, [releasePendingRealtimeIntent]);

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
    },
    [releasePendingRealtimeIntent],
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', setAppState);
    return () => subscription.remove();
  }, []);

  const catalogueMarket = useMemo(
    () =>
      catalogue.find(
        item => item.marketKey === effectiveMarketSelection?.marketKey,
      ) ?? null,
    [catalogue, effectiveMarketSelection?.marketKey],
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

  const klineEnabled =
    runtime.status === 'ready' &&
    isFocused &&
    appState === 'active' &&
    !!currentMarket;
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
    executionActive: klineEnabled,
    isResolvingMarket,
    klineEnabled,
    marketDataStatus,
    precision,
    prefetchMarket,
    orderBookSubscriptionEnabled,
    realtimeEnabled: subscriptionsEnabled,
    retryMarketData,
    selectMarket,
    selectTickOption,
    selectedTickOption,
    tickOptions,
    zeroAddressLeverageBaseline:
      effectiveMarketSelection &&
      currentMarket?.marketKey === effectiveMarketSelection.marketKey
        ? effectiveMarketSelection.zeroAddressLeverageBaseline
        : null,
  };
};
