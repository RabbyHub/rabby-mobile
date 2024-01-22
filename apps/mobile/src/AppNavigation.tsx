import { ColorSchemeName, View, StatusBar } from 'react-native';
import { isValidElementType } from 'react-is';
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
} from '@react-navigation/native';
import { createCustomNativeStackNavigator as createNativeStackNavigator } from '@/utils/CustomNativeStackNavigator';
import { useEffect, useRef, useCallback, useMemo } from 'react';

import { useThemeColors, useGetAppThemeMode } from '@/hooks/theme';

import { navigate, navigationRef } from '@/utils/navigation';
import {
  useCurrentRouteNameInAppStatusBar,
  useSetCurrentRouteName,
  useStackScreenConfig,
} from './hooks/navigation';
import { Text } from './components';
import { AppRootName, getRootSpecConfig, RootNames } from './constant/layout';
// import {analytics} from './utils/analytics';

// import { LoginNavigator } from './screens';
import NotFoundScreen from './screens/NotFound';

// import DappsScreen from './screens/Dapps/Dapps';
import HistoryScreen from './screens/Transaction/History';
import MyBundleScreen from './screens/Assets/MyBundle';

import { AddressNavigator } from './screens/Navigators/AddressNavigator';
import { SettingNavigator } from './screens/Navigators/SettingsNavigator';

import { FavoritePopularDappsScreen } from './screens/Dapps/FavoritePopularDapps';
import SearchDappsScreen from './screens/Dapps/SearchDapps';
import { NFTDetailScreen } from './screens/NftDetail';
import { GlobalBottomSheetModal } from './components/GlobalBottomSheetModal/GlobalBottomSheetModal';
import { GetStartedNavigator } from './screens/Navigators/GetStartedNavigator';

import BottomTabNavigator from './screens/Navigators/BottomTabNavigator';

const RootStack = createNativeStackNavigator();

const AccountStack = createNativeStackNavigator();
const TransactionStack = createNativeStackNavigator();

const RootOptions = { animation: 'none' } as const;
const RootStackOptions = {
  animation: 'slide_from_right',
  headerShown: false,
} as const;

function AppStatusBar() {
  const currentRouteName = useCurrentRouteNameInAppStatusBar();
  const isLight = useGetAppThemeMode() === 'light';
  const colors = useThemeColors();

  const { statusBarBackgroundColor, statusBarStyle } = useMemo(() => {
    const specConfig = currentRouteName
      ? getRootSpecConfig(colors)[currentRouteName as any as AppRootName]
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
      // translucent
      backgroundColor={statusBarBackgroundColor}
      barStyle={statusBarStyle}
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
    <View style={{ flex: 1, backgroundColor: colors['neutral-bg-2'] }}>
      <AppStatusBar />
      <GlobalBottomSheetModal />
      <NavigationContainer
        ref={navigationRef}
        // key={userId}
        onReady={onReady}
        onStateChange={onStateChange}
        independent
        // linking={LinkingConfiguration}
        theme={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <RootStack.Navigator
          screenOptions={{
            ...RootStackOptions,
            navigationBarColor: 'transparent',
          }}
          initialRouteName={'Root'}>
          <RootStack.Screen
            name={RootNames.StackRoot}
            component={BottomTabNavigator}
            options={RootOptions}
          />
          <RootStack.Screen
            name={RootNames.StackGetStarted}
            component={GetStartedNavigator}
          />
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
          <RootStack.Screen
            name={RootNames.StackAddress}
            component={AddressNavigator}
          />
          <RootStack.Screen
            name={RootNames.StackFavoritePopularDapps}
            component={FavoritePopularDappsNavigator}
          />
          <RootStack.Screen
            name={RootNames.StackSearchDapps}
            component={SearchDappsNavigator}
          />
          <RootStack.Screen
            name={RootNames.NftDetail}
            component={NFTDetailScreen}
            options={{
              ...screenOptions,
              title: 'NFT Detail',
              headerShadowVisible: false,
              headerShown: true,
              headerStyle: {
                backgroundColor: '#fff',
              },
              headerTitleStyle: {
                color: colors['neutral-title-1'],
                fontWeight: 'normal',
              },
            }}
          />
        </RootStack.Navigator>
      </NavigationContainer>
    </View>
  );
}

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

function FavoritePopularDappsNavigator() {
  const screenOptions = useStackScreenConfig();
  const colors = useThemeColors();
  // console.log('============== FavoritePopularNavigator Render =========');

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
        name={RootNames.FavoritePopularDapps}
        component={FavoritePopularDappsScreen}
        options={{
          title: 'Favorite Popular Dapp',
        }}
      />
    </TransactionStack.Navigator>
  );
}

function SearchDappsNavigator() {
  const screenOptions = useStackScreenConfig();
  const colors = useThemeColors();
  // console.log('============== FavoritePopularNavigator Render =========');

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
        name={RootNames.SearchDapps}
        component={SearchDappsScreen}
        // options={{
        //   title: 'Favorite Popular Dapp',
        // }}
      />
    </TransactionStack.Navigator>
  );
}
