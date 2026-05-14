import 'react-native-gesture-handler';

import { useThemeColors } from '@/hooks/theme';

import { DEFAULT_NAVBAR_FONT_SIZE, RootNames } from '@/constant/layout';
import { WebViewControlPreload } from '@/perfs/loadables/rootNavigatorScreens';

import { HomeNavigatorParamsList } from '@/navigation-type';
import React, { useLayoutEffect } from 'react';
import MultiAddressHome from '@/screens/Home/MultiAddressHome';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { preloadHomeShortcutNavigators } from '@/perfs/preloads';

const HomeHiddenTabStack = createBottomTabNavigator<HomeNavigatorParamsList>();

const TabBarComponent = () => null;

export function HomeScreenNavigator() {
  const colors = useThemeColors();
  const sceneBackgroundColor = colors['neutral-bg-2'];
  const sceneStyle = React.useMemo(
    () => ({
      backgroundColor: sceneBackgroundColor,
    }),
    [sceneBackgroundColor],
  );

  if (__DEV__) {
    console.debug('[BottomTabNavigator] Render');
  }

  useLayoutEffect(() => {
    const timer = setTimeout(() => {
      preloadHomeShortcutNavigators().catch(error => {
        console.error('preloadHomeShortcutNavigators::error', error);
      });
    }, 300);

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
            sceneStyle,
          }
        }
        tabBar={TabBarComponent}>
        <HomeHiddenTabStack.Screen
          name={RootNames.Home}
          component={MultiAddressHome}
          options={{
            headerShown: false,
            freezeOnBlur: false,
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

      <WebViewControlPreload />
    </>
  );
}
