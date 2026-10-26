import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  useIsFocused,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { AccountSwitcherModal } from '@/components/AccountSwitcher/Modal';
import { RootNames } from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import {
  type GetNestedScreenRouteProp,
  type TransactionNavigatorParamList,
  type SwapBridgeTab,
} from '@/navigation-type';
import { createGetStyles2024 } from '@/utils/styles';
import { isNonProductionDiagnosticsEnabled } from '@/core/utils/diagnosticEnv';
import { useFeatureActivationDiagnostics } from '@/hooks/useFeatureActivationDiagnostics';
import {
  ensureFeatureActivation,
  markFeatureActivation,
} from '@/core/utils/featureActivationDiagnostics';
import {
  useRegressionScenario,
  useRegressionScenarioComponentAction,
} from '@/devtools/regressionScenarios/react';

import { Bridge } from './Bridge';
import Swap from './Swap';
import { TokenInfoPopup } from '../Swap/components/TokenInfoPopup';
import { withSwapService } from '../Swap/swapServiceDependencies';
import { isSwapBridgeSceneActive } from './sceneActivation';
import { getSwapBridgeActiveTab } from './navigationParams';
import {
  createInitialMountedSwapBridgeScenes,
  mountSwapBridgeScene,
} from './sceneMounting';

type SwapBridgeRoute = GetNestedScreenRouteProp<
  'TransactionNavigatorParamList',
  typeof RootNames.SwapBridge | typeof RootNames.MultiSwapBridge
>;

type SwapBridgeScreenProps = {
  isForMultipleAddress?: boolean;
};

function SwapBridgeActivationProbe({
  activeTab,
}: {
  activeTab: SwapBridgeTab;
}) {
  useFeatureActivationDiagnostics(activeTab);
  return null;
}

function SwapBridgeScreenContent({
  isForMultipleAddress = false,
}: SwapBridgeScreenProps) {
  const route = useRoute<SwapBridgeRoute>();
  const navigation =
    useNavigation<
      NativeStackNavigationProp<
        TransactionNavigatorParamList,
        typeof RootNames.SwapBridge | typeof RootNames.MultiSwapBridge
      >
    >();
  const activeTab = getSwapBridgeActiveTab(route.params);
  const didMarkContentRender = useRef(false);
  if (!didMarkContentRender.current) {
    didMarkContentRender.current = true;
    const activationCycleId = ensureFeatureActivation(
      activeTab,
      'swap_bridge_content_render_fallback',
    );
    markFeatureActivation(activeTab, 'content-render-start', {
      cycleId: activationCycleId,
      reason: 'swap_bridge_content_render_started',
    });
  }
  const [visitedScenes, setVisitedScenes] = useState(() =>
    createInitialMountedSwapBridgeScenes(activeTab),
  );
  // Render a newly selected scene immediately; the effect only remembers it
  // for later visits. No service-ready or route-param update needs a blank frame.
  const mountedScenes = mountSwapBridgeScene(visitedScenes, activeTab);
  useEffect(() => {
    setVisitedScenes(current => mountSwapBridgeScene(current, activeTab));
  }, [activeTab]);
  // Swap-again can leave an earlier SwapBridge route mounted. Shared scene
  // modals must have only one focused host.
  const isScreenFocused = useIsFocused();
  const { styles } = useTheme2024({ getStyle });
  const regressionScenario = useRegressionScenario<'SwapBridge'>();

  const activateTabForRegression = useCallback(
    async (tab: SwapBridgeTab) => {
      navigation.setParams({ activeTab: tab });
      await new Promise<void>(resolve => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
    },
    [navigation],
  );
  const activateSwapForRegression = useCallback(
    () => activateTabForRegression('swap'),
    [activateTabForRegression],
  );
  const activateBridgeForRegression = useCallback(
    () => activateTabForRegression('bridge'),
    [activateTabForRegression],
  );

  useRegressionScenarioComponentAction(
    'swap-bridge.activate-swap',
    activateSwapForRegression,
  );
  useRegressionScenarioComponentAction(
    'swap-bridge.activate-bridge',
    activateBridgeForRegression,
  );

  useEffect(() => {
    if (
      !regressionScenario.active ||
      regressionScenario.scenario !== 'swap-bridge'
    ) {
      return;
    }
    regressionScenario.report('assertion', {
      assertion: `swap-bridge-${activeTab}-active`,
      passed: true,
      activeTab,
    });
  }, [activeTab, regressionScenario]);

  const swapSceneActive = isSwapBridgeSceneActive({
    activeTab,
    scene: 'swap',
    screenFocused: isScreenFocused,
  });
  const bridgeSceneActive = isSwapBridgeSceneActive({
    activeTab,
    scene: 'bridge',
    screenFocused: isScreenFocused,
  });

  return (
    <View style={styles.container}>
      {isNonProductionDiagnosticsEnabled ? (
        <SwapBridgeActivationProbe activeTab={activeTab} />
      ) : null}
      {isScreenFocused && (
        <AccountSwitcherModal forScene="MakeTransactionAbout" inScreen />
      )}
      {mountedScenes.swap ? (
        <View
          pointerEvents={activeTab === 'swap' ? 'auto' : 'none'}
          style={[
            styles.tabScene,
            activeTab !== 'swap' && styles.inactiveTabScene,
          ]}>
          {isForMultipleAddress ? (
            <Swap.ForMultipleAddress
              disableHeaderRight
              disableAccountSwitcherModal
              sceneActive={swapSceneActive}
              diagnosticActive={
                isNonProductionDiagnosticsEnabled && swapSceneActive
              }
            />
          ) : (
            <Swap
              disableHeaderRight
              disableAccountSwitcherModal
              sceneActive={swapSceneActive}
              diagnosticActive={
                isNonProductionDiagnosticsEnabled && swapSceneActive
              }
            />
          )}
        </View>
      ) : null}
      {mountedScenes.bridge ? (
        <View
          pointerEvents={activeTab === 'bridge' ? 'auto' : 'none'}
          style={[
            styles.tabScene,
            activeTab !== 'bridge' && styles.inactiveTabScene,
          ]}>
          {isForMultipleAddress ? (
            <Bridge.ForMultipleAddress
              disableHeaderRight
              disableAccountSwitcherModal
              sceneActive={bridgeSceneActive}
              diagnosticActive={
                isNonProductionDiagnosticsEnabled && bridgeSceneActive
              }
            />
          ) : (
            <Bridge
              disableHeaderRight
              disableAccountSwitcherModal
              sceneActive={bridgeSceneActive}
              diagnosticActive={
                isNonProductionDiagnosticsEnabled && bridgeSceneActive
              }
            />
          )}
        </View>
      ) : null}
      <TokenInfoPopup />
    </View>
  );
}

const SwapBridgeScreenBase = withSwapService(SwapBridgeScreenContent, {
  fallback: <View />,
});

function SwapBridgeScreenRouteEntry(props: SwapBridgeScreenProps) {
  const route = useRoute<SwapBridgeRoute>();
  const initialTab = getSwapBridgeActiveTab(route.params);
  const didMarkRouteRender = useRef(false);
  if (!didMarkRouteRender.current) {
    didMarkRouteRender.current = true;
    const cycleId = ensureFeatureActivation(
      initialTab,
      'swap_bridge_route_render_fallback',
    );
    markFeatureActivation(initialTab, 'route-render-start', {
      cycleId,
      reason: 'swap_bridge_route_render_started',
    });
  }

  return <SwapBridgeScreenBase {...props} />;
}

function ForMultipleAddress() {
  return <SwapBridgeScreenRouteEntry isForMultipleAddress />;
}

const SwapBridgeScreen = Object.assign(SwapBridgeScreenRouteEntry, {
  ForMultipleAddress,
});

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    flex: 1,
    backgroundColor: colors2024['neutral-bg-1'],
  },
  tabScene: {
    ...StyleSheet.absoluteFillObject,
  },
  inactiveTabScene: {
    display: 'none',
  },
}));

export default SwapBridgeScreen;
