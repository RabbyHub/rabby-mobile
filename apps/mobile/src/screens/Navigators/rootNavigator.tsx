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

import { HomeNavigatorParamsList } from '@/navigation-type';
import React, { useMemo } from 'react';
import WebViewControlPreload from '@/components/WebView/WebViewControlPreload';
import { createGetStyles } from '@/utils/styles';
import ApprovalTokenDetailSheetModalStub from '@/components/TokenDetailPopup/ApprovalTokenDetailSheetModalStub';
import BiometricsStubModal from '@/components/AuthenticationModal/BiometricsStubModal';
import MultiAddressHome from '@/screens/Home/MultiAddressHome';
import { useBottomTabScreenConfig } from '@/hooks/navigation';
import { I18nRouteScreenTitle } from '@/components2024/i18n/RouteScreen';
import { DappWebViewStubScreen } from '../Dapps/DappWebViewScreen';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

// const HomeHiddenTabStack = createCustomNativeStackNavigator<HomeNavigatorParamsList>();
const HomeHiddenTabStack = createBottomTabNavigator<HomeNavigatorParamsList>();

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

export function HomeScreenNavigator() {
  const colors = useThemeColors();
  const { mergeBottomTabOptions2024 } = useBottomTabScreenConfig();

  if (__DEV__) {
    console.debug('[BottomTabNavigator] Render');
  }

  return (
    <>
      <HomeHiddenTabStack.Navigator
        screenOptions={
          /* mergeScreenOptions */ {
            // gestureEnabled: false,
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
          }
        }
        tabBar={() => null}>
        <HomeHiddenTabStack.Screen
          name={RootNames.Home}
          component={MultiAddressHome}
          options={{
            headerShown: false,
          }}
        />
        <HomeHiddenTabStack.Screen
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
        <HomeHiddenTabStack.Screen
          name={RootNames.Settings}
          component={SettingsScreen}
          options={mergeBottomTabOptions2024([
            {
              headerTitle: () => (
                <I18nRouteScreenTitle
                  i18nTitle={({ t }) => t('screens.settings.screenTitle')}
                />
              ),
              headerLeftContainerStyle: {
                paddingLeft: 20,
              },
              headerTitleAlign: 'center',
              headerTintColor: colors['neutral-title-1'],
            },
          ])}
        />

        <HomeHiddenTabStack.Screen
          name={RootNames.DappWebViewStubOnHome}
          component={DappWebViewStubScreen}
          options={{
            title: '',
            headerShadowVisible: false,
            headerShown: false,
            // tabBarStyle: { height: 0, display: 'none' },
            // tabBarButton(props) {
            //   return null;
            // },
            // animation: 'slide_from_bottom',
            // animationDuration: 500,
            // animationTypeForReplace: 'push',
            // header: (headerProps) => {
            //   // return <DappWebViewStubScreen.Header />
            //   return null;
            // }
          }}
        />
      </HomeHiddenTabStack.Navigator>

      <BiometricsStubModal />

      <ApprovalTokenDetailSheetModalStub />

      <WebViewControlPreload />
    </>
  );
}
