import 'react-native-gesture-handler';

import { useThemeColors } from '@/hooks/theme';

import { DEFAULT_NAVBAR_FONT_SIZE, RootNames } from '@/constant/layout';

import { HomeNavigatorParamsList } from '@/navigation-type';
import React, { useLayoutEffect } from 'react';
import WebViewControlPreload from '@/components/WebView/WebViewControlPreload';
import ApprovalTokenDetailSheetModalStub from '@/components/TokenDetailPopup/ApprovalTokenDetailSheetModalStub';
import BiometricsStubModal from '@/components/AuthenticationModal/BiometricsStubModal';
import MultiAddressHome from '@/screens/Home/MultiAddressHome';
import { DappWebViewStubScreen } from '../Dapps/DappWebViewScreen';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { preloadSettingsScreen } from '@/perfs/preloads';

// const HomeHiddenTabStack = createCustomNativeStackNavigator<HomeNavigatorParamsList>();
const HomeHiddenTabStack = createBottomTabNavigator<HomeNavigatorParamsList>();

export function HomeScreenNavigator() {
  const colors = useThemeColors();

  if (__DEV__) {
    console.debug('[BottomTabNavigator] Render');
  }

  useLayoutEffect(() => {
    const timer = setTimeout(() => preloadSettingsScreen(), 200);

    return () => clearTimeout(timer);
  }, []);

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

        {/* <HomeHiddenTabStack.Screen
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
        /> */}
      </HomeHiddenTabStack.Navigator>

      <BiometricsStubModal />

      <ApprovalTokenDetailSheetModalStub />

      <WebViewControlPreload />
    </>
  );
}
