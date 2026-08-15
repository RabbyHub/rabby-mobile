import { useEnsurePerpsRuntime } from '@/hooks/perps/runtime/useEnsurePerpsRuntime';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import { perpsStore } from '@/hooks/perps/usePerpsStore';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import React, { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

import { RootNames } from '@/constant/layout';
import type { TransactionNavigatorParamList } from '@/navigation-type';
import { PerpsProScreen } from '../PerpsPro';
import { buildPerpsProMarkets } from '../PerpsPro/model/market';
import { resolveInitialPerpsProMarket } from '../PerpsPro/model/resolveInitialMarket';
import { getPerpsProMarketSession } from '../PerpsPro/session/perpsProMarketSession';
import { prefetchPerpsProZeroAddressLeverageBaseline } from '../PerpsPro/scene/perpsProZeroAddressLeverageBaseline';
import { prewarmPerpsProEntryIntent } from '../PerpsPro/scene/perpsProEntryIntent';
import { usePerpsViewMode } from './hooks/usePerpsViewMode';
import { PerpsSimpleScreen } from './PerpsSimpleScreen';

export const PerpsOriginScreen = () => {
  useEnsurePerpsRuntime();

  const navigation = useRabbyAppNavigation();
  const route =
    useRoute<
      RouteProp<TransactionNavigatorParamList, typeof RootNames.Perps>
    >();
  const { hydrated, savingMode, setViewMode, viewMode } = usePerpsViewMode();
  const marketDataStatus = perpsStore(state => state.marketDataStatus);
  const proIntentCancelRef = useRef<(() => void) | null>(null);
  const proIntentCommittedRef = useRef(false);
  const proIntentCancelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const cancelProIntent = useCallback(() => {
    if (proIntentCancelTimerRef.current) {
      clearTimeout(proIntentCancelTimerRef.current);
      proIntentCancelTimerRef.current = null;
    }
    proIntentCancelRef.current?.();
    proIntentCancelRef.current = null;
  }, []);

  const resolveProTarget = useCallback(() => {
    const state = perpsStore.getState();
    const markets = buildPerpsProMarkets(state.marketData);
    return resolveInitialPerpsProMarket({
      markets,
      navigationMarket: route.params?.market,
      sessionMarketKey: getPerpsProMarketSession().marketKey,
    });
  }, [route.params?.market]);

  const startProIntent = useCallback(() => {
    cancelProIntent();
    const target = resolveProTarget();
    if (!target) {
      return;
    }
    proIntentCancelRef.current = prewarmPerpsProEntryIntent({
      accountAddress: perpsStore.getState().currentPerpsAccount?.address,
      market: target,
    });
  }, [cancelProIntent, resolveProTarget]);

  const handlePressInPro = useCallback(() => {
    proIntentCommittedRef.current = false;
    startProIntent();
  }, [startProIntent]);

  const handlePressOutPro = useCallback(() => {
    if (proIntentCancelTimerRef.current) {
      clearTimeout(proIntentCancelTimerRef.current);
    }
    proIntentCancelTimerRef.current = setTimeout(() => {
      proIntentCancelTimerRef.current = null;
      if (!proIntentCommittedRef.current) {
        cancelProIntent();
      }
    }, 0);
  }, [cancelProIntent]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  useEffect(() => {
    if (!hydrated || viewMode !== 'simple' || marketDataStatus !== 'success') {
      return;
    }
    const target = resolveProTarget();
    if (target) {
      prefetchPerpsProZeroAddressLeverageBaseline(target.canonicalCoin);
    }
  }, [hydrated, marketDataStatus, resolveProTarget, viewMode]);

  useEffect(() => cancelProIntent, [cancelProIntent]);

  const switchToPro = useCallback(() => {
    proIntentCommittedRef.current = true;
    if (!proIntentCancelRef.current) {
      startProIntent();
      proIntentCommittedRef.current = true;
    }
    setViewMode('pro').then(success => {
      if (!success) {
        cancelProIntent();
      }
    });
  }, [cancelProIntent, setViewMode, startProIntent]);

  const switchToSimple = useCallback(() => {
    cancelProIntent();
    setViewMode('simple');
  }, [cancelProIntent, setViewMode]);

  if (!hydrated) {
    return null;
  }

  if (viewMode === 'pro') {
    return (
      <PerpsProScreen
        isModeSwitching={savingMode !== null}
        onSwitchToSimple={switchToSimple}
      />
    );
  }

  return (
    <PerpsSimpleScreen
      isModeSwitching={savingMode !== null}
      onPressInPro={handlePressInPro}
      onPressOutPro={handlePressOutPro}
      onSwitchToPro={switchToPro}
    />
  );
};
