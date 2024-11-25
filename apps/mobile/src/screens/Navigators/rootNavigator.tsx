import 'react-native-gesture-handler';
import { isValidElementType } from 'react-is';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Platform, StyleSheet, View } from 'react-native';
import {
  RcIconNavigationHomeLight,
  RcIconNavigationHomeFocusLight,
  RcIconNavigationDappsFocusLight,
  RcIconNavigationDappsLight,
  RcIconSettingLight,
  RcIconSettingFocusLight,
} from '@/assets/icons/bottom-bar';

import { useThemeColors, useGetBinaryMode } from '@/hooks/theme';

import { Text } from '@/components';
import {
  DEFAULT_NAVBAR_FONT_SIZE,
  RootNames,
  ScreenLayouts,
} from '@/constant/layout';

import HomeScreen from '@/screens/Home/Home';

import { DappsScreen } from '@/screens/Dapps/DappsScreen';
import {
  BottomTabParamsList,
  RootNavigatorParamsList,
  RootStackParamsList,
} from '@/navigation-type';
import React, { useMemo } from 'react';
import WebViewControlPreload from '@/components/WebView/WebViewControlPreload';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { createGetStyles } from '@/utils/styles';
import ApprovalTokenDetailSheetModalStub from '@/components/TokenDetailPopup/ApprovalTokenDetailSheetModalStub';
import BiometricsStubModal from '@/components/AuthenticationModal/BiometricsStubModal';
import HistoryScreen from '../Transaction/History';
import SettingsScreen from '../Settings/Settings';
import { PendingTxCount } from '../Home/components/PendingTxCount';
import { useUpgradeInfo } from '@/hooks/version';
import { OpenedDappWebViewStub } from '../Dapps/DappsScreen/components/WebViewsStub';
import createCustomNativeStackNavigator from '@/utils/CustomNativeStackNavigator';
import MultiAddressHome, {
  MultiAddressHomeHeader,
} from '@/screens/Home/MultiAddressHome';
import { useStackScreenConfig } from '@/hooks/navigation';

const RootStack = createCustomNativeStackNavigator<RootNavigatorParamsList>();

const isIOS = Platform.OS === 'ios';

const getStyles = createGetStyles(colors => ({
  settingsWrapper: {
    position: 'relative',
  },
  actionIconReddot: {
    width: 10,
    height: 10,
    position: 'absolute',

    top: -1,
    right: -1,
    backgroundColor: colors['red-default'],
    borderRadius: 8,
  },
  hideReddot: {
    display: 'none',
  },
}));

export default function RootScrennNavigator() {
  const colors = useThemeColors();
  const { mergeScreenOptions } = useStackScreenConfig();
  const isDark = useGetBinaryMode() === 'dark';

  const { systembarOffsetBottom } = useSafeSizes();
  const tabbarHeight = ScreenLayouts.bottomBarHeight + systembarOffsetBottom;

  if (__DEV__) {
    console.debug('[BottomTabNavigator] Render');
  }

  return (
    <>
      <RootStack.Navigator
        screenOptions={mergeScreenOptions({
          gestureEnabled: false,
          headerTitleAlign: 'center',
          headerStyle: {
            backgroundColor: 'transparent',
          },
          // headerShadowVisible: true,
          headerTintColor: colors['neutral-title-1'],
          headerTitleStyle: {
            color: colors['neutral-title-1'],
            fontWeight: '500',
            fontSize: DEFAULT_NAVBAR_FONT_SIZE,
          },
          // headerTransparent: true,
        })}>
        <RootStack.Screen
          name={RootNames.Home}
          component={MultiAddressHome}
          options={mergeScreenOptions({
            headerShown: false,
          })}
        />
        <RootStack.Screen
          name={RootNames.Dapps}
          component={DappsScreen}
          options={{
            title: isIOS ? 'Explore' : 'Dapps',
            headerTitleStyle: {
              fontWeight: '500',
            },
            headerTitle: 'Dapps',
            headerTransparent: true,
            headerShown: false,
          }}
        />
        <RootStack.Screen
          name={RootNames.History}
          component={HistoryScreen}
          options={useMemo(
            () => ({
              headerTitle: 'Transactions',
              headerTitleStyle: {
                fontWeight: '500',
                fontSize: 20,
                color: colors['neutral-title-1'],
              },
            }),
            [colors],
          )}
        />
        <RootStack.Screen
          name={RootNames.Settings}
          component={SettingsScreen}
          options={useMemo(
            () => ({
              headerTitle: 'Settings',
              headerTitleStyle: {
                fontWeight: '500',
                fontSize: 20,
                color: colors['neutral-title-1'],
              },
            }),
            [colors],
          )}
        />
      </RootStack.Navigator>

      <BiometricsStubModal />

      <OpenedDappWebViewStub />

      <ApprovalTokenDetailSheetModalStub />

      <WebViewControlPreload />
    </>
  );
}
