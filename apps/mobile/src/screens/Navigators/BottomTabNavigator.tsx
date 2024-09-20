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
import { RootNames, ScreenLayouts } from '@/constant/layout';

import HomeScreen from '@/screens/Home/Home';

import { DappsScreen } from '@/screens/Dapps/Dapps';
import { OpenedDappWebViewStub } from '../Dapps/Dapps/components/WebViewsStub';
import { BottomTabParamsList } from '@/navigation-type';
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

const SettingsBarIcon = ({
  focused,
  size = 24,
}: {
  focused?: boolean;
  size?: number;
}) => {
  const { remoteVersion } = useUpgradeInfo();

  const colors = useThemeColors();
  const styles = getStyles(colors);

  return (
    <View style={styles.settingsWrapper}>
      {focused ? (
        <RcIconSettingFocusLight width={size} height={size} />
      ) : (
        <RcIconSettingLight width={size} height={size} />
      )}
      <View
        style={[
          styles.actionIconReddot,
          (!remoteVersion.couldUpgrade || focused) && styles.hideReddot,
        ]}
      />
    </View>
  );
};

const getStyles = createGetStyles(colors => ({
  settingsWrapper: {
    position: 'relative',
  },
  actionIconReddot: {
    width: 8,
    height: 8,
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
          tabBarShowLabel: false,
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
                  focused
                    ? RcIconNavigationHomeFocusLight
                    : RcIconNavigationHomeLight
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
                  focused
                    ? RcIconNavigationDappsFocusLight
                    : RcIconNavigationDappsLight
                }
              />
            ),
          }}
        />
        <BottomTab.Screen
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
              tabBarLabel: ({ focused }) => (
                <BottomTabLabel focused={focused} label={'History'} />
              ),
              tabBarIcon: ({ focused }) => (
                <BottomTabIcon
                  icon={<PendingTxCount focused={focused} size={24} />}
                />
              ),
            }),
            [colors],
          )}
        />
        <BottomTab.Screen
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
              tabBarLabel: ({ focused }) => (
                <BottomTabLabel focused={focused} label={'Settings'} />
              ),
              tabBarIcon: ({ focused }) => (
                <BottomTabIcon
                  icon={<SettingsBarIcon focused={focused} size={24} />}
                />
              ),
            }),
            [colors],
          )}
        />
      </BottomTab.Navigator>

      <BiometricsStubModal />

      <OpenedDappWebViewStub />

      <ApprovalTokenDetailSheetModalStub />

      <WebViewControlPreload />
    </>
  );
}
