import 'react-native-gesture-handler';
import React from 'react';
import { createCustomNativeStackNavigator as createNativeStackNavigator } from '@/utils/CustomNativeStackNavigator';
import { createStackNavigator } from '@react-navigation/stack';

import { RootNames } from '@/constant/layout';
import SingleAddressHome from '../Home/Home';
import { useStackScreenConfig } from '@/hooks/navigation';

const SingleAddressStack = createStackNavigator();

export function SingleAddressNavigator() {
  const { mergeScreenOptions } = useStackScreenConfig();

  if (__DEV__) {
    console.debug('[SingleAddressNavigator] Render');
  }

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
          headerShown: true,
          // headerRight: RightArea,
          headerStyle: {
            backgroundColor: 'transparent',
          },
        })}
      />
    </SingleAddressStack.Navigator>
  );
}
