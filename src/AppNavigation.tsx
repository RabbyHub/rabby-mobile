import {ColorSchemeName, StyleSheet, View, StatusBar} from 'react-native';
import {isValidElementType} from 'react-is';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
} from '@react-navigation/native';
import {createCustomNativeStackNavigator as createNativeStackNavigator} from '@/utils/CustomNativeStackNavigator';
import {useEffect, useRef, useCallback, useMemo} from 'react';

// import FastImage from 'react-native-fast-image';
import {Colors} from '@/constant/theme';

import {
  RcIconNavigationHomeLight,
  RcIconNavigationDappsLight,
} from '@/assets/icons/bottom-bar';

import {useThemeColors, useColorScheme} from '@/hooks/theme';

import {
  navigationRef,
  useCurrentRouteNameInAppStatusBar,
  useSetCurrentRouteName,
} from '@/utils/navigation';
import {useStackScreenConfig} from './hooks/navigation';
import {Text} from './components';
import {
  AppRootName,
  NavigationHeadersPresets,
  RootNames,
  RootSpecConfig,
  ScreenColors,
  ScreenLayouts,
} from './constant/layout';
// import {analytics} from './utils/analytics';

import {WelcomeScreen} from './screens';
import NotFoundScreen from './screens/NotFound';

import HomeScreen from './screens/Home/Home';

import SettingsScreen from './screens/Settings/Settings';
import DappsScreen from './screens/Dapps/Dapps';
import HistoryScreen from './screens/Transaction/History';
import MyBundleScreen from './screens/Assets/MyBundle';

const RootStack = createNativeStackNavigator();
const BottomTab = createBottomTabNavigator();

const AccountStack = createNativeStackNavigator();
const TransactionStack = createNativeStackNavigator();
const SettingsStack = createNativeStackNavigator();

const RootOptions = {animation: 'none'} as const;
const RootStackOptions = {
  animation: 'slide_from_right',
  headerShown: false,
} as const;

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
  // fontFamily: 'SF Pro',
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

function AppStatusBar() {
  const currentRouteName = useCurrentRouteNameInAppStatusBar();
  const isLight = useColorScheme() === 'light';
  const colors = useThemeColors();

  const {statusBarBackgroundColor, statusBarStyle} = useMemo(() => {
    const specConfig = currentRouteName
      ? RootSpecConfig[currentRouteName as any as AppRootName]
      : undefined;

    return {
      statusBarBackgroundColor:
        specConfig?.statusbarBackgroundColor || colors['neutral-bg-2'],
      statusBarStyle:
        specConfig?.statusBarStyle ||
        (isLight ? ('dark-content' as const) : ('light-content' as const)),
    };
  }, [isLight, colors, currentRouteName]);

  return (
    <StatusBar
      translucent
      backgroundColor={statusBarBackgroundColor}
      barStyle={statusBarStyle}
      animated
    />
  );
}

export default function AppNavigation({
  colorScheme,
}: {
  colorScheme: ColorSchemeName;
}) {
  const routeNameRef = useRef<string>();
  const screenOptions = useStackScreenConfig();
  const colors = useThemeColors();
  // console.log('============== AppNavigation Render =========');
  useEffect(
    () => {
      // TODO: this may cause crash?
      // FastImage.clearMemoryCache();
    },
    [
      /* userId */
    ],
  );

  // useLoginTestAccount();

  const setCurrentRouteName = useSetCurrentRouteName();

  const onReady = useCallback(() => {
    routeNameRef.current = navigationRef?.getCurrentRoute()?.name;
    setCurrentRouteName(routeNameRef.current);

    // analytics.logScreenView({
    //   screen_name: routeNameRef.current,
    //   screen_class: routeNameRef.current,
    // });
  }, [setCurrentRouteName]);

  const onStateChange = useCallback(async () => {
    const previousRouteName = routeNameRef.current;
    const currentRouteName = navigationRef?.current?.getCurrentRoute()?.name;

    setCurrentRouteName(currentRouteName);

    if (!__DEV__ && previousRouteName !== currentRouteName) {
      // await analytics.logScreenView({
      //   screen_name: currentRouteName,
      //   screen_class: currentRouteName,
      // });
    }
    routeNameRef.current = currentRouteName;
  }, [setCurrentRouteName]);

  return (
    <View style={{flex: 1, backgroundColor: colors['neutral-bg-2']}}>
      <AppStatusBar />
      <NavigationContainer
        ref={navigationRef}
        // key={userId}
        onReady={onReady}
        onStateChange={onStateChange}
        // linking={LinkingConfiguration}
        theme={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <RootStack.Navigator
          screenOptions={RootStackOptions}
          initialRouteName={'Root'}>
          <RootStack.Screen
            name={RootNames.StackRoot}
            component={BottomTabNavigator}
            options={RootOptions}
          />
          <RootStack.Screen name={RootNames.Login} component={WelcomeScreen} />
          <RootStack.Screen
            name={RootNames.NotFound}
            component={NotFoundScreen}
            options={{
              ...screenOptions,
              title: 'Rabby Wallet',
              headerShadowVisible: false,
              headerShown: true,
              headerTransparent: false,
              headerStyle: {
                backgroundColor: '#fff',
              },
            }}
          />
          <RootStack.Screen
            name={RootNames.AccountTransaction}
            component={AccountNavigator}
          />
          <RootStack.Screen
            name={RootNames.StackTransaction}
            component={TransactionNavigator}
          />
          <RootStack.Screen
            name={RootNames.StackSettings}
            component={SettingNavigator}
          />
        </RootStack.Navigator>
      </NavigationContainer>
    </View>
  );
}

const BottomTabNavigator = () => {
  const colors = useThemeColors();
  const isDark = useColorScheme() === 'dark';

  if (__DEV__) {
    console.log('BottomTabNavigator Render');
  }

  return (
    <>
      <BottomTab.Navigator
        sceneContainerStyle={{backgroundColor: colors['neutral-bg-1']}}
        screenOptions={{
          tabBarInactiveTintColor: isDark
            ? 'rgba(223, 223, 223, 0.4)'
            : 'rgba(25, 35, 60, 0.4)',
          tabBarActiveTintColor: colors['neutral-bg-1'],
          headerTitleAlign: 'center',
          headerStyle: {
            backgroundColor: '#fff',
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
          tabBarLabelStyle: {...tabBarLabelStyle},
          tabBarLabelPosition: 'below-icon',
          tabBarItemStyle: {
            height: ScreenLayouts.bottomBarHeight,
            paddingTop: 13,
            paddingBottom: 38,
            backgroundColor: '#fff',
          },
        }}>
        <BottomTab.Screen
          name={RootNames.Home}
          component={HomeScreen}
          options={{
            title: 'Home',
            headerTitle: '',
            headerShown: true,
            tabBarLabel: ({focused}) => (
              <BottomTabLabel focused={focused} label={'Home'} />
            ),
            tabBarIcon: ({color, focused}) => (
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
            tabBarLabel: ({focused}) => (
              <BottomTabLabel focused={focused} label={'Dapps'} />
            ),
            tabBarIcon: ({color, focused}) => (
              <BottomTabIcon
                icon={<RcIconNavigationDappsLight isActive={focused} />}
              />
            ),
          }}
        />
      </BottomTab.Navigator>
    </>
  );
};

function AccountNavigator() {
  const screenOptions = useStackScreenConfig();
  const colors = useThemeColors();
  // console.log('============== AccountsNavigator Render =========');

  return (
    <AccountStack.Navigator
      screenOptions={{
        ...screenOptions,
        gestureEnabled: false,
        headerTitleAlign: 'center',
        headerStyle: {
          backgroundColor: 'transparent',
        },
        headerTitleStyle: {
          color: colors['neutral-title-1'],
          fontWeight: 'normal',
        },
      }}>
      <AccountStack.Screen
        name={RootNames.MyBundle}
        component={MyBundleScreen}
        options={{
          title: 'My Bundle',
        }}
      />
    </AccountStack.Navigator>
  );
}

function TransactionNavigator() {
  const screenOptions = useStackScreenConfig();
  const colors = useThemeColors();
  // console.log('============== TransactionNavigator Render =========');

  return (
    <TransactionStack.Navigator
      screenOptions={{
        ...screenOptions,
        gestureEnabled: false,
        headerTitleAlign: 'center',
        headerStyle: {
          backgroundColor: 'transparent',
        },
        headerTitleStyle: {
          color: colors['neutral-title-1'],
          fontWeight: 'normal',
        },
      }}>
      <TransactionStack.Screen
        name={RootNames.History}
        component={HistoryScreen}
        options={{
          title: 'History',
        }}
      />
    </TransactionStack.Navigator>
  );
}

function SettingNavigator() {
  const screenOptions = useStackScreenConfig();
  const colors = useThemeColors();
  // console.log('============== SettingNavigator Render =========');

  return (
    <SettingsStack.Navigator
      screenOptions={{
        ...screenOptions,
        gestureEnabled: false,
        headerTitleAlign: 'center',
        headerStyle: {
          backgroundColor: 'transparent',
        },
        headerTitleStyle: {
          color: colors['neutral-title-1'],
          fontWeight: 'normal',
        },
        headerTitle: 'Settings',
      }}>
      <SettingsStack.Screen
        name={RootNames.Settings}
        component={SettingsScreen}
        options={{
          title: 'Settings',
        }}
      />
    </SettingsStack.Navigator>
  );
}

const getStyles = (colors: Colors) =>
  StyleSheet.create({
    tabItem: {
      position: 'relative',
    },
    tabBarLabelStyle: {
      fontSize: 11,
      width: '100%',
      paddingTop: 6,
      fontWeight: '600',
      textAlign: 'center',
      color: colors['blue-default'],
      // fontFamily: 'SF Pro',
    },
    leftTitle: {
      marginLeft: 8,
      fontSize: 25,
      fontWeight: '700',
    },
  });
