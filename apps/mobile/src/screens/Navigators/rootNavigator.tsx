import 'react-native-gesture-handler';
import { Platform, StyleProp, TextStyle } from 'react-native';

import { useThemeColors, useGetBinaryMode } from '@/hooks/theme';

import { Text } from '@/components';
import {
  DEFAULT_NAVBAR_FONT_SIZE,
  RootNames,
  ScreenLayouts,
} from '@/constant/layout';

import { DappsScreen } from '@/screens/Dapps/DappsScreen';
import SettingsScreen from '../Settings/Settings';

import {
  RootNavigatorParamsList,
  RootStackParamsList,
} from '@/navigation-type';
import React, { useMemo } from 'react';
import WebViewControlPreload from '@/components/WebView/WebViewControlPreload';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { createGetStyles } from '@/utils/styles';
import ApprovalTokenDetailSheetModalStub from '@/components/TokenDetailPopup/ApprovalTokenDetailSheetModalStub';
import BiometricsStubModal from '@/components/AuthenticationModal/BiometricsStubModal';
import { OpenedDappWebViewStub } from '../Dapps/DappsScreen/components/WebViewsStub';
import createCustomNativeStackNavigator from '@/utils/CustomNativeStackNavigator';
import MultiAddressHome from '@/screens/Home/MultiAddressHome';
import { useStackScreenConfig } from '@/hooks/navigation';
import { I18nRouteScreenTitle } from '@/components2024/i18n/RouteScreen';

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

export default function RootScreenNavigator() {
  const colors = useThemeColors();
  const { mergeScreenOptions } = useStackScreenConfig();

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
          name={RootNames.Settings}
          component={SettingsScreen}
          options={useMemo(
            () =>
              mergeScreenOptions({
                headerTitle: () => (
                  <I18nRouteScreenTitle
                    i18nTitle={({ t }) => t('screens.settings.screenTitle')}
                  />
                ),
                gestureEnabled: false,
                headerTitleAlign: 'center',
                headerTintColor: colors['neutral-title-1'],
              }),
            [colors, mergeScreenOptions],
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
