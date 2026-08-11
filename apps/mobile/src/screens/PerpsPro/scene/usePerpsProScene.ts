import { useIsFocused, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useShallow } from 'zustand/react/shallow';

import { RootNames } from '@/constant/layout';
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
  preparePerpsProZeroAddressLeverageBaseline,
  readPerpsProZeroAddressLeverageBaseline,
} from './perpsProZeroAddressLeverageBaseline';
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
  const [appState, setAppState] = useState<AppStateStatus>(
    AppState.currentState,
  );
  const [marketSelection, setMarketSelection] =
    useState<PreparedMarketSelection | null>(null);
  const marketSelectionRef = useRef<PreparedMarketSelection | null>(null);
  const marketSelectionSequenceRef = useRef(0);
  const pendingMarketKeyRef = useRef<string | null>(null);
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
      if (marketSelection || catalogue.length === 0) {
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
      return zeroAddressLeverageBaseline
        ? { marketKey: resolved.marketKey, zeroAddressLeverageBaseline }
        : null;
    }, [catalogue, marketSelection]);
  const effectiveMarketSelection =
    marketSelection ?? synchronousMarketSelection;
  if (!marketSelectionRef.current && effectiveMarketSelection) {
    marketSelectionRef.current = effectiveMarketSelection;
  }

  const selectMarket = useCallback(async (market: PerpsProMarket) => {
    if (marketSelectionRef.current?.marketKey === market.marketKey) {
      marketSelectionSequenceRef.current += 1;
      pendingMarketKeyRef.current = null;
      return true;
    }
    const sequence = ++marketSelectionSequenceRef.current;
    pendingMarketKeyRef.current = market.marketKey;
    const zeroAddressLeverageBaseline =
      await preparePerpsProZeroAddressLeverageBaseline(market.canonicalCoin);
    if (sequence !== marketSelectionSequenceRef.current) {
      return false;
    }
    if (
      !catalogueRef.current.some(item => item.marketKey === market.marketKey)
    ) {
      pendingMarketKeyRef.current = null;
      return false;
    }

    const nextSelection = {
      marketKey: market.marketKey,
      zeroAddressLeverageBaseline,
    };
    pendingMarketKeyRef.current = null;
    marketSelectionRef.current = nextSelection;
    setMarketSelection(nextSelection);
    setPerpsProSessionMarket(market.marketKey);
    return true;
  }, []);

  const cancelPendingMarketSelection = useCallback(() => {
    marketSelectionSequenceRef.current += 1;
    pendingMarketKeyRef.current = null;
  }, []);

  const prefetchMarket = useCallback((coin: string) => {
    prefetchPerpsProZeroAddressLeverageBaseline(coin);
  }, []);

  useEffect(() => {
    if (marketSelection || !synchronousMarketSelection) {
      return;
    }
    marketSelectionRef.current = synchronousMarketSelection;
    setMarketSelection(synchronousMarketSelection);
    setPerpsProSessionMarket(synchronousMarketSelection.marketKey);
  }, [marketSelection, synchronousMarketSelection]);

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
        pendingMarketKeyRef.current ??
        marketSelectionRef.current?.marketKey ??
        getPerpsProMarketSession().marketKey,
    });
    navigationMarketConsumedRef.current = true;
    if (
      resolved &&
      resolved.marketKey !== marketSelectionRef.current?.marketKey &&
      resolved.marketKey !== pendingMarketKeyRef.current
    ) {
      void selectMarket(resolved);
    }
  }, [cancelPendingMarketSelection, catalogue, selectMarket]);

  useEffect(
    () => () => {
      marketSelectionSequenceRef.current += 1;
      pendingMarketKeyRef.current = null;
    },
    [],
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

  const retryMarketData = useCallback(() => {
    fetchMarketData();
  }, [fetchMarketData]);

  return {
    cancelPendingMarketSelection,
    currentMarket,
    executionActive: klineEnabled,
    isResolvingMarket,
    klineEnabled,
    marketDataStatus,
    precision,
    prefetchMarket,
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
