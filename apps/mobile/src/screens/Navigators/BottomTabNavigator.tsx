import { isValidElementType } from 'react-is';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Platform, StyleSheet } from 'react-native';
import {
  RcIconNavigationHomeLight,
  RcIconNavigationHomeFocusLight,
  RcIconNavigationDappsFocusLight,
  RcIconNavigationDappsLight,
  RcIconPointsLight,
  RcIconPointsFocusLight,
} from '@/assets/icons/bottom-bar';

import { useThemeColors, useGetAppThemeMode } from '@/hooks/theme';

import { Text } from '@/components';
import { RootNames, ScreenLayouts } from '@/constant/layout';
// import {analytics} from '@/utils/analytics';

// import { LoginNavigator } from '@/screens';

import HomeScreen from '@/screens/Home/Home';

import { DappsScreen } from '@/screens/Dapps/Dapps';
import {
  OpenedDappWebViewStub,
  // OpenedWebViewsStub,
} from '../Dapps/Dapps/components/WebViewsStub';
import { BottomTabParamsList } from '@/navigation-type';
import React, { useMemo } from 'react';
import { PointScreen } from '../Points';
import WebViewControlPreload from '@/components/WebView/WebViewControlPreload';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { makeDebugBorder } from '@/utils/styles';

const BottomTab = createBottomTabNavigator<BottomTabParamsList>();

const BOTTOM_TAB_ICON_SIZE = 24;
const BottomTabIcon = ({
  icon: Icon,
  size = BOTTOM_TAB_ICON_SIZE,
  ...otherProps
}: {
  icon: MemoziedAppSvgIcon | React.ReactNode;
  size?: number;
} & React.ComponentProps<MemoziedAppSvgIcon>) => {
  if (!isValidElementType(Icon)) {
    return Icon || null;
  }

  console.log('[feat] otherProps', otherProps);

  return !Icon ? null : <Icon width={size} height={size} {...otherProps} />;
};

const tabBarLabelStyle = {
  fontSize: 11,
  width: '100%',
  fontWeight: '600',
  textAlign: 'center',
  height: 14,
  // ...makeDebugBorder('yellow'),
} as const;

const BottomTabLabel = ({
  label,
  children = label,
  focused,
}: // color,
React.PropsWithChildren<{
  label?: string;
  focused: boolean;
  color?: string;
}>) => {
  const colors = useThemeColors();

  return (
    <Text
      style={{
        ...tabBarLabelStyle,
        color: focused ? colors['blue-default'] : colors['neutral-foot'],
      }}>
      {children}
    </Text>
  );
};

export default function BottomTabNavigator() {
  const colors = useThemeColors();
  const isDark = useGetAppThemeMode() === 'dark';

  const { systembarOffsetBottom } = useSafeSizes();
  const tabbarHeight = ScreenLayouts.bottomBarHeight + systembarOffsetBottom;

  if (__DEV__) {
    console.debug('[BottomTabNavigator] Render');
  }

  return (
    <>
      <BottomTab.Navigator
        sceneContainerStyle={{ backgroundColor: colors['neutral-bg-1'] }}
        screenOptions={{
          tabBarInactiveTintColor: isDark
            ? 'rgba(223, 223, 223, 0.4)'
            : 'rgba(25, 35, 60, 0.4)',
          tabBarActiveTintColor: colors['neutral-bg-1'],
          headerTitleAlign: 'center',
          headerStyle: {
            backgroundColor: colors['neutral-bg-1'],
          },
          headerShadowVisible: true,
          headerTintColor: colors['neutral-bg-1'],
          headerTitleStyle: {
            color: colors['neutral-title-1'],
            fontWeight: 'bold',
          },
          headerTransparent: true,
          tabBarStyle: {
            position: 'absolute',
            height: tabbarHeight + 6,
            borderTopColor: colors['neutral-line'],
            borderTopWidth: StyleSheet.hairlineWidth,
            backgroundColor: colors['neutral-bg-1'],
          },
          tabBarIconStyle: {
            height: BOTTOM_TAB_ICON_SIZE,
            width: BOTTOM_TAB_ICON_SIZE,
          },
          tabBarLabelPosition: 'below-icon',
          tabBarItemStyle: {
            height: tabbarHeight,
            paddingBottom: systembarOffsetBottom,
            backgroundColor: colors['neutral-bg-1'],
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            // ...makeDebugBorder(),
          },
        }}>
        <BottomTab.Screen
          name={RootNames.Home}
          component={HomeScreen}
          options={{
            title: 'Home',
            headerTitle: '',
            headerShown: true,
            tabBarLabel: ({ focused }) => (
              <BottomTabLabel focused={focused} label={'Home'} />
            ),
            tabBarIcon: ({ color, focused }) => (
              <BottomTabIcon
                icon={
                  focused ? (
                    <RcIconNavigationHomeFocusLight />
                  ) : (
                    <RcIconNavigationHomeLight />
                  )
                }
              />
            ),
          }}
        />
        <BottomTab.Screen
          name={RootNames.Dapps}
          component={DappsScreen}
          options={{
            title: Platform.OS === 'ios' ? 'Explore' : 'Dapps',
            headerTitleStyle: {
              fontWeight: '500',
              fontSize: 17,
            },
            headerTitle: 'Dapps',
            headerTransparent: true,
            headerShown: true,
            tabBarLabel: ({ focused }) => (
              <BottomTabLabel
                focused={focused}
                label={Platform.OS === 'ios' ? 'Explore' : 'Dapps'}
              />
            ),
            tabBarIcon: ({ color, focused }) => (
              <BottomTabIcon
                icon={
                  focused ? (
                    <RcIconNavigationDappsFocusLight />
                  ) : (
                    <RcIconNavigationDappsLight />
                  )
                }
              />
            ),
          }}
        />
        <BottomTab.Screen
          name={RootNames.Points}
          component={PointScreen}
          options={useMemo(
            () => ({
              headerShown: false,
              tabBarLabel: ({ focused }) => (
                <BottomTabLabel focused={focused} label={'Points'} />
              ),
              tabBarIcon: ({ focused }) => (
                <BottomTabIcon
                  icon={
                    focused ? <RcIconPointsFocusLight /> : <RcIconPointsLight />
                  }
                />
              ),
            }),
            [],
          )}
        />
      </BottomTab.Navigator>

      <OpenedDappWebViewStub />
      {/* <OpenedWebViewsStub /> */}

      <WebViewControlPreload />
    </>
  );
}
