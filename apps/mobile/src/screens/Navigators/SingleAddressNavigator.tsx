import 'react-native-gesture-handler';
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
} from 'react';
import { useNavigation } from '@react-navigation/native';
import { createCustomNativeStackNavigator as createNativeStackNavigator } from '@/utils/CustomNativeStackNavigator';
import { RootNames } from '@/constant/layout';
import { useStackScreenConfig } from '@/hooks/navigation';
import { withRegressionScenario } from '@/devtools/regressionScenarios/react';
import { scheduleSingleAddressTransactionNavigatorWarmup } from './singleAddressWarmup';
import {
  ensureFeatureActivation,
  markFeatureActivation,
} from '@/core/utils/featureActivationDiagnostics';
import { withScreenRenderActivityAudit } from '@/hooks/storeActivity/withScreenRenderActivityAudit';
import { SingleAddressHomeScreen } from '@/perfs/loadables/singleAddressScreens';
import { SingleAddressLoadingScreen } from '@/perfs/loadables/SingleAddressLoadingScreen';
import { SingleAddressHeader } from '../Home/SingleAddressHeader';
import { IS_IOS } from '@/core/native/utils';

const SingleAddressStack = createNativeStackNavigator();

type OpeningTransitionEvent = {
  data?: {
    closing?: boolean;
  };
};

function SingleAddressRouteScreen() {
  const navigation = useNavigation();
  const [contentReady, setContentReady] = useState(!IS_IOS);

  useEffect(() => {
    if (!IS_IOS) {
      return;
    }

    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
    let revealed = false;

    const revealContent = () => {
      if (revealed) {
        return;
      }
      revealed = true;
      setContentReady(true);
    };

    const unsubscribeTransition = navigation.addListener(
      'transitionEnd' as never,
      ((event: OpeningTransitionEvent) => {
        if (event.data?.closing === false) {
          revealContent();
        }
      }) as never,
    );
    fallbackTimer = setTimeout(revealContent, 500);

    return () => {
      unsubscribeTransition();
      if (fallbackTimer !== null) {
        clearTimeout(fallbackTimer);
      }
    };
  }, [navigation]);

  return contentReady ? (
    <SingleAddressHomeScreen />
  ) : (
    <SingleAddressLoadingScreen />
  );
}

const AuditedSingleAddressHome = withScreenRenderActivityAudit(
  SingleAddressRouteScreen,
  'single-address-screen',
);
const RegressionSingleAddressHome = withRegressionScenario(
  AuditedSingleAddressHome,
  {
    screen: 'SingleAddressHome',
  },
);

export function SingleAddressNavigator() {
  const activationCycleId = ensureFeatureActivation(
    'single-address',
    'single_address_route_render_fallback',
  );
  markFeatureActivation('single-address', 'route-render-start', {
    cycleId: activationCycleId,
    reason: 'single_address_navigator_render',
  });
  const { mergeScreenOptions } = useStackScreenConfig();

  if (__DEV__) {
    console.debug('[SingleAddressNavigator] Render');
  }
  const renderHeader = useCallback(() => <SingleAddressHeader />, []);

  useLayoutEffect(() => {
    const warmupHandle = scheduleSingleAddressTransactionNavigatorWarmup();

    return () => {
      if (
        warmupHandle &&
        typeof warmupHandle === 'object' &&
        'cancel' in warmupHandle
      ) {
        warmupHandle.cancel();
      }
    };
  }, []);

  return (
    <SingleAddressStack.Navigator
      screenOptions={{
        headerTitleAlign: 'left',
      }}>
      <SingleAddressStack.Screen
        name={RootNames.SingleAddressHome}
        component={RegressionSingleAddressHome}
        options={mergeScreenOptions({
          title: '',
          headerTitle: '',
          header: renderHeader,
          headerShown: true,
          headerStyle: {
            backgroundColor: 'transparent',
          },
        })}
      />
    </SingleAddressStack.Navigator>
  );
}
