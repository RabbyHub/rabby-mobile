import 'react-native-gesture-handler';
import React from 'react';

import { useStackScreenConfig } from '@/hooks/navigation';
import { useTheme2024, useThemeColors } from '@/hooks/theme';
import { createCustomNativeStackNavigator } from '@/utils/CustomNativeStackNavigator';
import { DEFAULT_NAVBAR_FONT_SIZE, RootNames } from '@/constant/layout';
import CreateNewAddress from '../Address/CreateNewAddress';
import CreateSelectMethod from '../Address/CreateSelectMethod';
import SetPassword2024 from '../Address/SetPassword2024';
import CreateSelectOnCurrentSeed from '../Address/CreateSelectOnCurrentSeed/index';
import CreateChooseBackup from '../Address/CreateChooseBackup';

const AddressStack = createCustomNativeStackNavigator();

export function AddressNavigator2024() {
  const { mergeScreenOptions } = useStackScreenConfig();
  const colors = useThemeColors();
  const { colors2024, color } = useTheme2024();
  // console.log('============== SettingNavigator Render =========');

  return (
    <AddressStack.Navigator
      screenOptions={mergeScreenOptions({
        gestureEnabled: false,
        headerTitleAlign: 'center',
        headerStyle: {
          backgroundColor: 'transparent',
        },
        headerTintColor: colors2024['neutral-title-1'],
        headerTitleStyle: {
          color: colors2024['neutral-title-1'],
          fontWeight: '500',
          fontSize: DEFAULT_NAVBAR_FONT_SIZE,
        },
        headerTitle: '',
      })}>
      {/* 2024新组件改版 */}
      <AddressStack.Screen
        name={RootNames.CreateSelectMethod}
        component={CreateSelectMethod}
        options={mergeScreenOptions({
          headerTitle: '1. Select Creation Method',
          title: '1. Select Creation Method',
          headerTintColor: colors2024['neutral-title-1'],
          headerStyle: {
            backgroundColor: colors2024['neutral-bg-1'],
          },
          headerTitleStyle: {
            color: colors2024['neutral-title-1'],
            fontWeight: '800',
            fontSize: 20,
            fontFamily: 'SF Pro Rounded',
          },
        })}
      />
      <AddressStack.Screen
        name={RootNames.CreateNewAddress}
        component={CreateNewAddress}
        options={mergeScreenOptions({
          headerLeft: () => null,
          headerTitle: '1. Name Your Address',
          title: '1. Name Your Address',
          headerTintColor: colors2024['neutral-title-1'],
          headerStyle: {
            backgroundColor: colors2024['neutral-bg-1'],
          },
          headerTitleStyle: {
            color: colors2024['neutral-title-1'],
            fontWeight: '800',
            fontSize: 20,
            fontFamily: 'SF Pro Rounded',
          },
        })}
      />
      <AddressStack.Screen
        name={RootNames.CreateSelectOnCurrentSeed}
        component={CreateSelectOnCurrentSeed}
        options={mergeScreenOptions({
          headerLeft: () => null,
          headerTitle: '2. Add Address',
          title: '2. Add Address',
          headerTintColor: colors2024['neutral-title-1'],
          headerStyle: {
            backgroundColor: colors2024['neutral-bg-1'],
          },
          headerTitleStyle: {
            color: colors2024['neutral-title-1'],
            fontWeight: '800',
            fontSize: 20,
            fontFamily: 'SF Pro Rounded',
          },
        })}
      />
      <AddressStack.Screen
        name={RootNames.SetPassword2024}
        component={SetPassword2024}
        options={mergeScreenOptions({
          headerLeft: () => null,
          headerTitle: '2. Set password',
          title: '2. Set password',
          headerTintColor: colors2024['neutral-title-1'],
          headerStyle: {
            backgroundColor: colors2024['neutral-bg-1'],
          },
          headerTitleStyle: {
            color: colors2024['neutral-title-1'],
            fontWeight: '800',
            fontSize: 20,
            fontFamily: 'SF Pro Rounded',
          },
        })}
      />
      <AddressStack.Screen
        name={RootNames.CreateChooseBackup}
        component={CreateChooseBackup}
        options={mergeScreenOptions({
          headerLeft: () => null,
          headerTitle: '3. Choose a backup method',
          title: '3. Choose a backup method',
          headerStyle: {
            backgroundColor: colors2024['neutral-bg-1'],
          },
          headerTintColor: colors2024['neutral-title-1'],
          headerTitleStyle: {
            color: colors2024['neutral-title-1'],
            fontWeight: '800',
            fontSize: 20,
            fontFamily: 'SF Pro Rounded',
          },
        })}
      />
    </AddressStack.Navigator>
  );
}
