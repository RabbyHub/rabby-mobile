import React from 'react';
import { Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import 'react-native-gesture-handler';

import { useThemeColors } from '@/hooks/theme';

import { DEFAULT_NAVBAR_FONT_SIZE, RootNames } from '@/constant/layout';

import { DappsScreen } from '@/screens/Dapps/DappsScreen';
import SettingsScreen from '../Settings/Settings';

import BiometricsStubModal from '@/components/AuthenticationModal/BiometricsStubModal';
import ApprovalTokenDetailSheetModalStub from '@/components/TokenDetailPopup/ApprovalTokenDetailSheetModalStub';
import WebViewControlPreload from '@/components/WebView/WebViewControlPreload';
import { I18nRouteScreenTitle } from '@/components2024/i18n/RouteScreen';
import { useBottomTabScreenConfig } from '@/hooks/navigation';
import { HomeNavigatorParamsList } from '@/navigation-type';
import MultiAddressHome from '@/screens/Home/MultiAddressHome';
import { DappWebViewStubScreen } from '../Dapps/DappWebViewScreen';
import SearchScreen from '../Search';

// const HomeHiddenTabStack = createCustomNativeStackNavigator<HomeNavigatorParamsList>();
const HomeHiddenTabStack = createBottomTabNavigator<HomeNavigatorParamsList>();

const isIOS = Platform.OS === 'ios';

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
          name={RootNames.Search}
          component={SearchScreen}
          options={{
            title: 'Search',
            headerTitleStyle: {
              fontWeight: '500',
            },
            headerTitle: 'Search',
            headerTransparent: true,
            headerShown: false,
          }}
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
