import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { View } from 'react-native';
import {
  RootScenePager,
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
import { getSwapBridgeActiveTab } from './navigationParams';
import { useRootPagerEnabled } from './useRootPagerEnabled';

const ROOT_SCENES: readonly SwapBridgeTab[] = ['swap', 'bridge'];

type SwapBridgeRoute = GetNestedScreenRouteProp<
  'TransactionNavigatorParamList',
  typeof RootNames.SwapBridge | typeof RootNames.MultiSwapBridge
>;

type SwapBridgeScreenProps = {
  isForMultipleAddress?: boolean;
};

// Retain form/scroll state after the first preview, including a cancelled swipe.
// Preview mounting never activates quote/signing effects. The existing business
// sceneActive contract changes only once the root track has settled.
const SwapBridgeRootPage = memo(function SwapBridgeRootPage({
  tab,
  selected,
  visible,
  prewarm,
  screenFocused,
  isForMultipleAddress,
}: {
  tab: SwapBridgeTab;
  selected: boolean;
  visible: boolean;
  prewarm: boolean;
  screenFocused: boolean;
  isForMultipleAddress: boolean;
}) {
  const [mounted, setMounted] = useState(visible);
  if (!mounted && (visible || prewarm)) {
    setMounted(true);
  }
  const sceneActive = selected && screenFocused;
  const Component =
    tab === 'swap'
      ? isForMultipleAddress
        ? Swap.ForMultipleAddress
        : Swap
      : isForMultipleAddress
      ? Bridge.ForMultipleAddress
      : Bridge;
  // Root visibility/prewarm metadata must not re-render the business form.
  // Its own subscriptions remain unchanged; only activity reaches this boundary.
  const content = useMemo(
    () => (
      <Component
        disableHeaderRight
        disableAccountSwitcherModal
        sceneActive={sceneActive}
        diagnosticActive={isNonProductionDiagnosticsEnabled && sceneActive}
      />
    ),
    [Component, sceneActive],
  );
  return mounted ? content : null;
});

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
  const [settledTab, setSettledTab] = useState(activeTab);
  const [prewarm, setPrewarm] = useState(false);
  // Swap-again can leave an earlier SwapBridge route mounted. Shared scene
  // modals must have only one focused host.
  const isScreenFocused = useIsFocused();
  const pagerEnabled = useRootPagerEnabled(isScreenFocused);
  const { styles } = useTheme2024({ getStyle });
  const regressionScenario = useRegressionScenario<'SwapBridge'>();

  // Prepare the neighboring form outside the initial render, without treating
  // it as active. Once visited/prepared it remains mounted. No per-frame JS.
  useEffect(() => {
    if (!pagerEnabled || prewarm) {
      return;
    }
    const idle = requestIdleCallback(() => setPrewarm(true));
    return () => cancelIdleCallback(idle);
  }, [pagerEnabled, prewarm]);

  const onSettled = useCallback(
    (key: string) => {
      const tab = key as SwapBridgeTab;
      setSettledTab(tab);
      if (tab !== activeTab) {
        navigation.setParams({ activeTab: tab });
      }
    },
    [activeTab, navigation],
  );
  const renderPage = useCallback<RootScenePagerProps['renderPage']>(
    (key, context) => (
      <SwapBridgeRootPage
        tab={key as SwapBridgeTab}
        selected={context.selected}
        visible={context.visible}
        prewarm={prewarm}
        screenFocused={isScreenFocused}
        isForMultipleAddress={isForMultipleAddress}
      />
    ),
    [isForMultipleAddress, isScreenFocused, prewarm],
  );

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
      assertion: `swap-bridge-${settledTab}-active`,
      passed: true,
      activeTab: settledTab,
    });
  }, [settledTab, regressionScenario]);

  return (
    <View style={styles.container}>
      {isNonProductionDiagnosticsEnabled ? (
        <SwapBridgeActivationProbe activeTab={settledTab} />
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
