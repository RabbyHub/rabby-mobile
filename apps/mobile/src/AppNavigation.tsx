import { createCustomNativeStackNavigator as createNativeStackNavigator } from '@/utils/CustomNativeStackNavigator';
import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
} from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { ColorSchemeName, StatusBar, View } from 'react-native';

import { useGetAppThemeMode, useThemeColors } from '@/hooks/theme';

import { navigationRef } from '@/utils/navigation';
import { AppRootName, RootNames, getRootSpecConfig } from './constant/layout';
import {
  useCurrentRouteNameInAppStatusBar,
  useSetCurrentRouteName,
  useStackScreenConfig,
} from './hooks/navigation';
import { matomoLogScreenView } from './utils/analytics';

import NotFoundScreen from './screens/NotFound';

import MyBundleScreen from './screens/Assets/MyBundle';
import ReceiveScreen from './screens/Receive/Receive';

import { AddressNavigator } from './screens/Navigators/AddressNavigator';
import { SettingNavigator } from './screens/Navigators/SettingsNavigator';

import { FavoritePopularDappsScreen } from './screens/Dapps/FavoritePopularDapps';
import SearchDappsScreen from './screens/Dapps/SearchDapps';
import { GetStartedNavigator } from './screens/Navigators/GetStartedNavigator';
import { NFTDetailScreen } from './screens/NftDetail';

import { useHasActiveOpenedDapp } from './screens/Dapps/hooks/useDappView';
import BottomTabNavigator from './screens/Navigators/BottomTabNavigator';

import {
  AccountNavigatorParamList,
  FavoritePopularDappsNavigatorParamList,
  RootStackParamsList,
  SearchDappsNavigatorParamList,
} from './navigation-type';
import TransactionNavigator from './screens/Navigators/TransactionNavigator';

const RootStack = createNativeStackNavigator<RootStackParamsList>();

const AccountStack = createNativeStackNavigator<AccountNavigatorParamList>();

const FavoritePopularDappsStack =
  createNativeStackNavigator<FavoritePopularDappsNavigatorParamList>();

const SearchDappsStack =
  createNativeStackNavigator<SearchDappsNavigatorParamList>();

const RootOptions = { animation: 'none' } as const;
const RootStackOptions = {
  animation: 'slide_from_right',
  headerShown: false,
} as const;

function AppStatusBar() {
  const currentRouteName = useCurrentRouteNameInAppStatusBar();
  const isLight = useGetAppThemeMode() === 'light';
  const colors = useThemeColors();

  // maybe we need more smooth transition on toggle active dapp
  const hasActiveOpenedDapp = useHasActiveOpenedDapp();

  const { statusBarBackgroundColor, statusBarStyle } = useMemo(() => {
    if (hasActiveOpenedDapp) {
      return {
        statusBarStyle: 'light-content' as const,
        statusBarBackgroundColor: 'rgba(0, 0, 0, 1)',
      };
    }

    const specConfig = currentRouteName
      ? getRootSpecConfig(colors, { isDarkTheme: !isLight })[
          currentRouteName as any as AppRootName
        ]
      : undefined;

    return {
      statusBarBackgroundColor:
        specConfig?.statusbarBackgroundColor || colors['neutral-bg-2'],
      statusBarStyle:
        specConfig?.statusBarStyle ||
        (isLight ? ('dark-content' as const) : ('light-content' as const)),
    };
  }, [isLight, colors, currentRouteName, hasActiveOpenedDapp]);

  return (
    <StatusBar
      animated
      translucent
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
    console.log('routeNameRef', routeNameRef.current);

    matomoLogScreenView({ name: routeNameRef.current! });
  }, [setCurrentRouteName]);

  const onStateChange = useCallback(async () => {
    const previousRouteName = routeNameRef.current;
    const currentRouteName = navigationRef?.current?.getCurrentRoute()?.name;

    setCurrentRouteName(currentRouteName);

    if (previousRouteName !== currentRouteName) {
      matomoLogScreenView({ name: currentRouteName! });
    }
    routeNameRef.current = currentRouteName;
  }, [setCurrentRouteName]);

  return (
    <View style={{ flex: 1, backgroundColor: colors['neutral-bg-2'] }}>
      <AppStatusBar />
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
            name={RootNames.Receive}
            component={ReceiveScreen}
            options={{
              ...screenOptions,
              title: '',
              headerShadowVisible: false,
              headerShown: true,
              headerTransparent: true,
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
            options={{ headerShown: false }}
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

function FavoritePopularDappsNavigator() {
  const screenOptions = useStackScreenConfig();
  const colors = useThemeColors();
  // console.log('============== FavoritePopularNavigator Render =========');

  return (
    <FavoritePopularDappsStack.Navigator
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
        headerTintColor: colors['neutral-title-1'],
      }}>
      <FavoritePopularDappsStack.Screen
        name={RootNames.FavoritePopularDapps}
        component={FavoritePopularDappsScreen}
        options={{
          title: 'Favorite Popular Dapp',
        }}
      />
    </FavoritePopularDappsStack.Navigator>
  );
}

function SearchDappsNavigator() {
  const screenOptions = useStackScreenConfig();
  const colors = useThemeColors();
  // console.log('============== FavoritePopularNavigator Render =========');

  return (
    <SearchDappsStack.Navigator
      screenOptions={{
        ...screenOptions,
        headerShown: false,
        gestureEnabled: false,
        headerTitleAlign: 'center',
        headerStyle: {
          backgroundColor: 'transparent',
        },
        headerTitleStyle: {
          color: colors['neutral-title-1'],
          fontWeight: 'normal',
        },
        headerTintColor: colors['neutral-title-1'],
      }}>
      <SearchDappsStack.Screen
        name={RootNames.SearchDapps}
        component={SearchDappsScreen}
        // options={{
        //   title: 'Favorite Popular Dapp',
        // }}
      />
    </SearchDappsStack.Navigator>
  );
}
