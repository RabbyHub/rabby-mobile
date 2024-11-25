import 'react-native-gesture-handler';
import { Platform } from 'react-native';

import { useThemeColors, useGetBinaryMode } from '@/hooks/theme';

import { Text } from '@/components';
import {
  DEFAULT_NAVBAR_FONT_SIZE,
  RootNames,
  ScreenLayouts,
} from '@/constant/layout';

import {
  BottomTabParamsList,
  RootNavigatorParamsList,
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
      </RootStack.Navigator>

      <BiometricsStubModal />

      <OpenedDappWebViewStub />

      <ApprovalTokenDetailSheetModalStub />

      <WebViewControlPreload />
    </>
  );
}
