import { useEnsurePerpsRuntime } from '@/hooks/perps/runtime/useEnsurePerpsRuntime';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import { perpsStore } from '@/hooks/perps/usePerpsStore';
import { useHideTipsPopup, useIsTipsPopupVisible } from '@/hooks/useTipsPopup';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef } from 'react';
import type { LayoutChangeEvent } from 'react-native';

import { RootNames } from '@/constant/layout';
import type { TransactionNavigatorParamList } from '@/navigation-type';
import { PerpsProScreen } from '../PerpsPro';
import { PERPS_PORTFOLIO_BREAKDOWN_TIPS_OWNER } from '../PerpsShared/constants';
import { buildPerpsProMarkets } from '../PerpsPro/model/market';
import { resolveInitialPerpsProMarket } from '../PerpsPro/model/resolveInitialMarket';
import { getPerpsProMarketSession } from '../PerpsPro/session/perpsProMarketSession';
import { prefetchPerpsProZeroAddressLeverageBaseline } from '../PerpsPro/scene/perpsProZeroAddressLeverageBaseline';
import { prewarmPerpsProEntryIntent } from '../PerpsPro/scene/perpsProEntryIntent';
import { usePerpsViewMode } from './hooks/usePerpsViewMode';
import { PerpsSimpleScreen } from './PerpsSimpleScreen';
import type { PerpsRegionAlertLayout } from './components/PerpsRegionAlert';

export const PerpsOriginScreen = () => {
  useEnsurePerpsRuntime();

  const route =
    useRoute<
      RouteProp<TransactionNavigatorParamList, typeof RootNames.Perps>
    >();
  const navigation = useRabbyAppNavigation();
  const { hasVisitedPro, hydrated, savingMode, setViewMode, viewMode } =
    usePerpsViewMode();
  const marketDataStatus = perpsStore(state => state.marketDataStatus);
  const proIntentCancelRef = useRef<(() => void) | null>(null);
  const proIntentCommittedRef = useRef(false);
  const regionAlertLayoutRef = useRef<PerpsRegionAlertLayout | null>(null);
  const proIntentCancelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const portfolioBreakdownVisible = useIsTipsPopupVisible(
    PERPS_PORTFOLIO_BREAKDOWN_TIPS_OWNER,
  );
  const hidePortfolioBreakdown = useHideTipsPopup(
    PERPS_PORTFOLIO_BREAKDOWN_TIPS_OWNER,
  );

  useEffect(
    () =>
      navigation.addListener('beforeRemove', event => {
        if (portfolioBreakdownVisible) {
          event.preventDefault();
          hidePortfolioBreakdown();
        }
      }),
    [hidePortfolioBreakdown, navigation, portfolioBreakdownVisible],
  );

  useEffect(
    () => navigation.addListener('blur', hidePortfolioBreakdown),
    [hidePortfolioBreakdown, navigation],
  );

  useEffect(
    () => () => {
      hidePortfolioBreakdown();
    },
    [hidePortfolioBreakdown],
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
      navigationMarketCandidates: route.params?.marketCandidates,
      sessionMarketKey: getPerpsProMarketSession().marketKey,
    });
  }, [route.params?.market, route.params?.marketCandidates]);

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
    hidePortfolioBreakdown();
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
  }, [cancelProIntent, hidePortfolioBreakdown, setViewMode, startProIntent]);

  const switchToSimple = useCallback(() => {
    hidePortfolioBreakdown();
    cancelProIntent();
    setViewMode('simple');
  }, [cancelProIntent, hidePortfolioBreakdown, setViewMode]);

  const captureRegionAlertLayout = useCallback((event: LayoutChangeEvent) => {
    const height = Math.ceil(event.nativeEvent.layout.height);
    const width = Math.ceil(event.nativeEvent.layout.width);
    if (height <= 0 || width <= 0) {
      return;
    }
    regionAlertLayoutRef.current = { height, width };
  }, []);

  if (!hydrated) {
    return null;
  }

  if (viewMode === 'pro') {
    return (
      <PerpsProScreen
        initialRegionAlertLayout={regionAlertLayoutRef.current}
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
      onRegionAlertLayout={captureRegionAlertLayout}
      onSwitchToPro={switchToPro}
      showProNewBadge={!hasVisitedPro}
    />
  );
};
