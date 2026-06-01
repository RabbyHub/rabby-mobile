import 'react-native-gesture-handler';
import React, { useCallback } from 'react';
import { createCustomNativeStackNavigator as createNativeStackNavigator } from '@/utils/CustomNativeStackNavigator';
import { RootNames } from '@/constant/layout';
import SingleAddressHome from '../Home/Home';
import { useStackScreenConfig } from '@/hooks/navigation';
const SingleAddressStack = createNativeStackNavigator();

export function SingleAddressNavigator() {
  const { mergeScreenOptions } = useStackScreenConfig();

  if (__DEV__) {
    console.debug('[SingleAddressNavigator] Render');
  }
  const renderHeader = useCallback(() => <SingleAddressHome.Header />, []);

  return (
    <SingleAddressStack.Navigator
      screenOptions={{
        headerTitleAlign: 'left',
      }}>
      <SingleAddressStack.Screen
        name={RootNames.SingleAddressHome}
        component={SingleAddressHome}
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
