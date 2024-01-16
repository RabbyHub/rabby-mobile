import { isValidElementType } from 'react-is';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import {
  RcIconNavigationHomeLight,
  RcIconNavigationDappsLight,
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
  OpenedWebViewsStub,
} from '../Dapps/Dapps/components/WebViewsStub';

const BottomTab = createBottomTabNavigator();

const BottomTabIcon = ({
  icon: Icon,
  ...otherProps
}: {
  icon: MemoziedAppSvgIcon | React.ReactNode;
} & React.ComponentProps<MemoziedAppSvgIcon>) => {
  if (!isValidElementType(Icon)) {
    return Icon || null;
  }

  return !Icon ? null : <Icon width={24} height={24} {...otherProps} />;
};

const tabBarLabelStyle = {
  fontSize: 11,
  width: '100%',
  paddingTop: 6,
  fontWeight: '600',
  textAlign: 'center',
} as const;

const BottomTabLabel = ({
  label,
  children = label,
  focused,
}: React.PropsWithChildren<{
  label?: string;
  focused: boolean;
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
            // height: Platform.OS === 'ios' ? 90 : 70,
            height: ScreenLayouts.bottomBarHeight,
            borderTopColor: colors['neutral-line'],
            borderTopWidth: 1,
            backgroundColor: colors['neutral-bg-1'],
          },
          tabBarLabelStyle: { ...tabBarLabelStyle },
          tabBarLabelPosition: 'below-icon',
          tabBarItemStyle: {
            height: ScreenLayouts.bottomBarHeight,
            paddingTop: 13,
            paddingBottom: 38,
            backgroundColor: colors['neutral-bg-1'],
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
                icon={<RcIconNavigationHomeLight isActive={focused} />}
              />
            ),
          }}
        />
        <BottomTab.Screen
          name={RootNames.Dapps}
          component={DappsScreen}
          options={{
            title: 'Dapps',
            headerTitleStyle: {
              fontWeight: '500',
              fontSize: 17,
            },
            headerTitle: 'Dapps',
            headerTransparent: true,
            headerShown: true,
            tabBarLabel: ({ focused }) => (
              <BottomTabLabel focused={focused} label={'Dapps'} />
            ),
            tabBarIcon: ({ color, focused }) => (
              <BottomTabIcon
                icon={<RcIconNavigationDappsLight isActive={focused} />}
              />
            ),
          }}
        />
      </BottomTab.Navigator>

      <OpenedDappWebViewStub />
      <OpenedWebViewsStub />
    </>
  );
}
