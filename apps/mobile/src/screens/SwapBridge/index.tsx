import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import {
  RootScenePager,
  type RootScenePagerGestureMode,
  type RootScenePagerProps,
} from '@rabby-wallet/rn-collapsible-scene-view';
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
import { useRootPagerEnabled } from '@/hooks/useRootPagerEnabled';
import { useRootScenePagerBackGesture } from '@/hooks/useRootScenePagerBackGesture';

const ROOT_SCENES: readonly SwapBridgeTab[] = ['swap', 'bridge'];
// `edge-handoff` (A): every page hands a rightward drag that starts on the
// native back edge to the system. Flip to `boundary-handoff` (B) to give the
// system gesture only to the first sub-screen.
const ROOT_PAGER_GESTURE_MODE: RootScenePagerGestureMode = 'edge-handoff';

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

// The business form and its subscriptions stay unchanged; only the scene
// activity reaches this boundary, so pager previews never activate quotes.
const SwapBridgeRootPage = memo(function SwapBridgeRootPage({
  tab,
  sceneActive,
  isForMultipleAddress,
}: {
  tab: SwapBridgeTab;
  sceneActive: boolean;
  isForMultipleAddress: boolean;
}) {
  const Component =
    tab === 'swap'
      ? isForMultipleAddress
        ? Swap.ForMultipleAddress
        : Swap
      : isForMultipleAddress
      ? Bridge.ForMultipleAddress
      : Bridge;
  return (
    <Component
      disableHeaderRight
      disableAccountSwitcherModal
      sceneActive={sceneActive}
      diagnosticActive={isNonProductionDiagnosticsEnabled && sceneActive}
    />
  );
});

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
  const pagerEnabled = useRootPagerEnabled(isScreenFocused);
  // Prepare the neighbouring form outside the initial render, without
  // activating it: the incoming page is already laid out when a drag starts.
  const [prewarm, setPrewarm] = useState(false);
  useEffect(() => {
    if (!pagerEnabled || prewarm) {
      return;
    }
    if (typeof requestIdleCallback !== 'function') {
      setPrewarm(true);
      return;
    }
    const idle = requestIdleCallback(() => setPrewarm(true));
    return () => cancelIdleCallback(idle);
  }, [pagerEnabled, prewarm]);
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

  // The route param is the settled tab; the pager only moves it on settle.
  useRootScenePagerBackGesture({
    atFirstPage: activeTab === 'swap',
    gestureMode: ROOT_PAGER_GESTURE_MODE,
  });

  const onSettled = useCallback(
    (key: string) => {
      const tab = key as SwapBridgeTab;
      if (tab !== activeTab) {
        navigation.setParams({ activeTab: tab });
      }
    },
    [activeTab, navigation],
  );

  const renderPage = useCallback<RootScenePagerProps['renderPage']>(
    (key, context) => {
      const tab = key as SwapBridgeTab;
      // Mount what the track is revealing or prewarming; retention after the
      // swipe comes from the visited-scene state.
      if (!mountedScenes[tab] && !context.visible && !prewarm) {
        return null;
      }
      return (
        <SwapBridgeRootPage
          tab={tab}
          sceneActive={isSwapBridgeSceneActive({
            activeTab,
            scene: tab,
            screenFocused: isScreenFocused,
          })}
          isForMultipleAddress={isForMultipleAddress}
        />
      );
    },
    [activeTab, isForMultipleAddress, isScreenFocused, mountedScenes, prewarm],
  );

  return (
    <View style={styles.container}>
      {isNonProductionDiagnosticsEnabled ? (
        <SwapBridgeActivationProbe activeTab={activeTab} />
      ) : null}
      {isScreenFocused && (
        <AccountSwitcherModal forScene="MakeTransactionAbout" inScreen />
      )}
      <RootScenePager
        keys={ROOT_SCENES}
        requestedKey={activeTab}
        onSettled={onSettled}
        renderPage={renderPage}
        enabled={pagerEnabled}
        gestureMode={ROOT_PAGER_GESTURE_MODE}
        testID="swap-bridge-root"
      />
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
}));

export default SwapBridgeScreen;
