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
import { getPerpTickOptions } from '../model/orderBook';
import { resolveInitialPerpsProMarket } from '../model/resolveInitialMarket';
import {
  getPerpsProMarketSession,
  setPerpsProSessionMarket,
} from '../session/perpsProMarketSession';
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
  const [marketKey, setMarketKey] = useState<string | null>(
    () => getPerpsProMarketSession().marketKey,
  );
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

  useEffect(() => {
    if (catalogue.length === 0) {
      setMarketKey(null);
      return;
    }
    const resolved = resolveInitialPerpsProMarket({
      markets: catalogue,
      navigationMarket: navigationMarketConsumedRef.current
        ? undefined
        : navigationMarketRef.current,
      sessionMarketKey: marketKey ?? getPerpsProMarketSession().marketKey,
    });
    navigationMarketConsumedRef.current = true;
    if (resolved && resolved.marketKey !== marketKey) {
      setMarketKey(resolved.marketKey);
      setPerpsProSessionMarket(resolved.marketKey);
    }
  }, [catalogue, marketKey]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', setAppState);
    return () => subscription.remove();
  }, []);

  const catalogueMarket = useMemo(
    () => catalogue.find(item => item.marketKey === marketKey) ?? null,
    [catalogue, marketKey],
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

  const selectMarket = useCallback((market: PerpsProMarket) => {
    setMarketKey(market.marketKey);
    setPerpsProSessionMarket(market.marketKey);
  }, []);
  const retryMarketData = useCallback(() => {
    fetchMarketData();
  }, [fetchMarketData]);

  return {
    currentMarket,
    executionActive: klineEnabled,
    isResolvingMarket,
    klineEnabled,
    marketDataStatus,
    precision,
    realtimeEnabled: subscriptionsEnabled,
    retryMarketData,
    selectMarket,
    selectTickOption,
    selectedTickOption,
    tickOptions,
  };
};
