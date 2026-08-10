import 'react-native-gesture-handler';
import React, { useCallback, useLayoutEffect } from 'react';
import { createCustomNativeStackNavigator as createNativeStackNavigator } from '@/utils/CustomNativeStackNavigator';
import { RootNames } from '@/constant/layout';
import SingleAddressHome from '../Home/Home';
import { useStackScreenConfig } from '@/hooks/navigation';
import { withRegressionScenario } from '@/devtools/regressionScenarios/react';
import { scheduleSingleAddressTransactionNavigatorWarmup } from './singleAddressWarmup';

const SingleAddressStack = createNativeStackNavigator();
const RegressionSingleAddressHome = withRegressionScenario(SingleAddressHome, {
  screen: 'SingleAddressHome',
});

export function SingleAddressNavigator() {
  const { mergeScreenOptions } = useStackScreenConfig();

  if (__DEV__) {
    console.debug('[SingleAddressNavigator] Render');
  }
  const renderHeader = useCallback(() => <SingleAddressHome.Header />, []);

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
