import 'react-native-gesture-handler';
import React from 'react';

import { useStackScreenConfig } from '@/hooks/navigation';
import { useTheme2024 } from '@/hooks/theme';
import { createCustomNativeStackNavigator } from '@/utils/CustomNativeStackNavigator';
import { DEFAULT_NAVBAR_FONT_SIZE, RootNames } from '@/constant/layout';
import CreateNewAddress from '../Address/CreateNewAddress';
import CreateSelectMethod from '../Address/CreateSelectMethod';
import SetPassword2024 from '../Address/SetPassword2024';
import CreateSelectOnCurrentSeed from '../Address/CreateSelectOnCurrentSeed/index';
import CreateChooseBackup from '../Address/CreateChooseBackup';
import { createGetStyles2024 } from '@/utils/styles';

const AddressStack = createCustomNativeStackNavigator();

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  headerTitleText: {
    color: colors2024['neutral-title-1'],
    fontWeight: '800',
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
  },
}));

export function AddressNavigator2024() {
  const { mergeScreenOptions } = useStackScreenConfig();
  const { colors2024, styles } = useTheme2024({ getStyle });
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
        headerTitleStyle: styles.headerTitleText,
        headerTitle: '',
      })}>
      {/* 2024新组件改版 */}
      <AddressStack.Screen
        name={RootNames.CreateSelectMethod}
        component={CreateSelectMethod}
        options={mergeScreenOptions({
          headerLeft: () => null,
          headerTitle: '1. Select Creation Method',
          title: '1. Select Creation Method',
          headerTintColor: colors2024['neutral-title-1'],
          headerStyle: {
            backgroundColor: colors2024['neutral-bg-1'],
          },
          headerTitleStyle: styles.headerTitleText,
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
          headerTitleStyle: styles.headerTitleText,
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
          headerTitleStyle: styles.headerTitleText,
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
          headerTitleStyle: styles.headerTitleText,
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
          headerTitleStyle: styles.headerTitleText,
        })}
      />
    </AddressStack.Navigator>
  );
}
