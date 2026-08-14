import { useEnsurePerpsRuntime } from '@/hooks/perps/runtime/useEnsurePerpsRuntime';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import { perpsStore } from '@/hooks/perps/usePerpsStore';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import React, { useCallback, useEffect, useLayoutEffect } from 'react';

import { RootNames } from '@/constant/layout';
import type { TransactionNavigatorParamList } from '@/navigation-type';
import { PerpsProScreen } from '../PerpsPro';
import { buildPerpsProMarkets } from '../PerpsPro/model/market';
import { resolveInitialPerpsProMarket } from '../PerpsPro/model/resolveInitialMarket';
import { getPerpsProMarketSession } from '../PerpsPro/session/perpsProMarketSession';
import { prefetchPerpsProZeroAddressLeverageBaseline } from '../PerpsPro/scene/perpsProZeroAddressLeverageBaseline';
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

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  useEffect(() => {
    if (!hydrated || viewMode !== 'simple' || marketDataStatus !== 'success') {
      return;
    }
    const markets = buildPerpsProMarkets(perpsStore.getState().marketData);
    const target = resolveInitialPerpsProMarket({
      markets,
      navigationMarket: route.params?.market,
      sessionMarketKey: getPerpsProMarketSession().marketKey,
    });
    if (target) {
      prefetchPerpsProZeroAddressLeverageBaseline(target.canonicalCoin);
    }
  }, [hydrated, marketDataStatus, route.params?.market, viewMode]);

  const switchToPro = useCallback(() => {
    setViewMode('pro');
  }, [setViewMode]);

  const switchToSimple = useCallback(() => {
    setViewMode('simple');
  }, [setViewMode]);

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
      onSwitchToPro={switchToPro}
    />
  );
};
