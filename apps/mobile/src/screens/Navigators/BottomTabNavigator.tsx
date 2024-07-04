import 'react-native-gesture-handler';
import { isValidElementType } from 'react-is';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Platform, StyleSheet, View } from 'react-native';
import {
  RcIconNavigationHomeLight,
  RcIconNavigationHomeFocusLight,
  RcIconNavigationDappsFocusLight,
  RcIconNavigationDappsLight,
  RcIconPointsLight,
  RcIconPointsFocusLight,
} from '@/assets/icons/bottom-bar';

import { useThemeColors, useGetBinaryMode } from '@/hooks/theme';

import { Text } from '@/components';
import { RootNames, ScreenLayouts } from '@/constant/layout';

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
import ApprovalTokenDetailSheetModalStub from '@/components/TokenDetailPopup/ApprovalTokenDetailSheetModalStub';
import { toast } from '@/components/Toast';
import BiometricsStubModal from '@/components/AuthenticationModal/BiometricsStubModal';

const BottomTab = createBottomTabNavigator<BottomTabParamsList>();

const BOTTOM_TAB_SIZES = {
  icon: 24,
  labelHeight: 16,
  get totalHeight() {
    return this.icon + this.labelHeight;
  },
};

const BottomTabIcon = ({
  icon: Icon,
  size = BOTTOM_TAB_SIZES.icon,
  ...otherProps
}: {
  icon: MemoziedAppSvgIcon | React.ReactNode;
  size?: number;
} & React.ComponentProps<MemoziedAppSvgIcon>) => {
  if (!isValidElementType(Icon)) {
    return Icon || null;
  }

  return !Icon ? null : <Icon width={size} height={size} {...otherProps} />;
};

const tabBarLabelStyle = {
  fontSize: 11,
  width: '100%',
  fontWeight: '600',
  textAlign: 'center',
  height: BOTTOM_TAB_SIZES.labelHeight,
  // ...makeDebugBorder('pink'),
} as const;

const BottomTabLabel = ({
  label,
  children = label,
  focused,
  style,
}: // color,
React.PropsWithChildren<{
  label?: string;
  focused: boolean;
  color?: string;
  style?: React.ComponentProps<typeof Text>['style'];
}>) => {
  const colors = useThemeColors();

  return (
    <Text
      style={StyleSheet.flatten([
        {
          ...tabBarLabelStyle,

          color: focused ? colors['blue-default'] : colors['neutral-foot'],
        },
        style,
      ])}>
      {children}
    </Text>
  );
};

const isIOS = Platform.OS === 'ios';

export default function BottomTabNavigator() {
  const colors = useThemeColors();
  const isDark = useGetBinaryMode() === 'dark';

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
            height: tabbarHeight + (isIOS ? 0 : 6),
            borderTopColor: colors['neutral-line'],
            borderTopWidth: StyleSheet.hairlineWidth,
            backgroundColor: colors['neutral-bg-1'],
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            // ...makeDebugBorder('blue'),
          },
          tabBarIconStyle: {
            height: BOTTOM_TAB_SIZES.icon,
            width: BOTTOM_TAB_SIZES.icon,
            // ...makeDebugBorder('yellow'),
          },
          tabBarLabelPosition: 'below-icon',
          tabBarItemStyle: {
            height: BOTTOM_TAB_SIZES.totalHeight,
            flexDirection: 'column',
            backgroundColor: colors['neutral-bg-1'],
            // ...makeDebugBorder('red'),
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
            title: isIOS ? 'Explore' : 'Dapps',
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
                label={isIOS ? 'Explore' : 'Dapps'}
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
          listeners={{
            tabPress: e => {
              e.preventDefault();
              toast.show('Stay tuned :) ', {
                position: toast.positions.CENTER,
              });
            },
          }}
          options={useMemo(
            () => ({
              headerShown: false,
              tabBarLabel: ({ focused }) => (
                <BottomTabLabel
                  focused={focused}
                  label={'Points'}
                  style={{ opacity: 0.5 }}
                />
              ),
              tabBarIcon: ({ focused }) => (
                <BottomTabIcon
                  icon={
                    focused ? (
                      <RcIconPointsFocusLight />
                    ) : (
                      <View style={{ opacity: 0.5 }}>
                        <RcIconPointsLight />
                      </View>
                    )
                  }
                />
              ),
            }),
            [],
          )}
        />
      </BottomTab.Navigator>

      <BiometricsStubModal />

      <OpenedDappWebViewStub />
      {/* <OpenedWebViewsStub /> */}

      <ApprovalTokenDetailSheetModalStub />

      <WebViewControlPreload />
    </>
  );
}
