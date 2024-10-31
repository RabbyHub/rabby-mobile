import 'react-native-gesture-handler';
import React from 'react';

import { useStackScreenConfig } from '@/hooks/navigation';
import { useThemeColors } from '@/hooks/theme';
import { createCustomNativeStackNavigator } from '@/utils/CustomNativeStackNavigator';
import { DEFAULT_NAVBAR_FONT_SIZE, RootNames } from '@/constant/layout';
import CreateNewAddress from '../Address/CreateNewAddress';
import CreateNewAddressSecond from '../Address/CreateNewAddressSecond';
import CreateNewAddressThird from '../Address/CreateNewAddressThird';

const AddressStack = createCustomNativeStackNavigator();

export function AddressNavigator2024() {
  const { mergeScreenOptions } = useStackScreenConfig();
  const colors = useThemeColors();
  // console.log('============== SettingNavigator Render =========');

  return (
    <AddressStack.Navigator
      screenOptions={mergeScreenOptions({
        gestureEnabled: false,
        headerTitleAlign: 'center',
        headerStyle: {
          backgroundColor: 'transparent',
        },
        headerTintColor: colors['neutral-title-1'],
        headerTitleStyle: {
          color: colors['neutral-title-1'],
          fontWeight: '500',
          fontSize: DEFAULT_NAVBAR_FONT_SIZE,
        },
        headerTitle: '',
      })}>
      {/* 2024新组件改版 */}
      <AddressStack.Screen
        name={RootNames.CreateNewAddress}
        component={CreateNewAddress}
        options={mergeScreenOptions({
          headerTitle: '1. Name Your Address',
          title: '1. Name Your Address',
          headerTintColor: colors['neutral-title-1'],
          headerTitleStyle: {
            color: colors['neutral-title-1'],
          },
        })}
      />
      <AddressStack.Screen
        name={RootNames.CreateNewAddressSecond}
        component={CreateNewAddressSecond}
        options={mergeScreenOptions({
          headerTitle: '2. Set password',
          title: '2. Set password',
          headerTintColor: colors['neutral-title-1'],
          headerTitleStyle: {
            color: colors['neutral-title-1'],
          },
        })}
      />
      <AddressStack.Screen
        name={RootNames.CreateNewAddressThird}
        component={CreateNewAddressThird}
        options={mergeScreenOptions({
          headerTitle: '2. Set password',
          title: '2. Set password',
          headerTintColor: colors['neutral-title-1'],
          headerTitleStyle: {
            color: colors['neutral-title-1'],
          },
        })}
      />
    </AddressStack.Navigator>
  );
}
