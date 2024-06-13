import { createCustomNativeStackNavigator as createNativeStackNavigator } from '@/utils/CustomNativeStackNavigator';
import React, { useEffect, useRef, useCallback, useMemo } from 'react';
import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
} from '@react-navigation/native';
import { ColorSchemeName, View } from 'react-native';

import { useThemeColors } from '@/hooks/theme';

import { navigationRef, replace } from '@/utils/navigation';
import { RootNames } from './constant/layout';
import {
  useSetCurrentRouteName,
  useSetNavigationReady,
  useStackScreenConfig,
} from './hooks/navigation';
import { analytics, matomoLogScreenView } from './utils/analytics';

import NotFoundScreen from './screens/NotFound';

import MyBundleScreen from './screens/Assets/MyBundle';

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
import { GlobalBottomSheetModal } from './components/GlobalBottomSheetModal/GlobalBottomSheetModal';
import UnlockScreen from './screens/Unlock/Unlock';
import { useIsAppUnlocked } from './hooks/useLock';
import { BackgroundSecureBlurView } from './components/customized/BlurViews';
import { AppStatusBar, useTuneStatusBar } from './components/AppStatusBar';

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
  const { isAppUnlocked } = useIsAppUnlocked();
  const { setNavigationReady } = useSetNavigationReady();

  const setCurrentRouteName = useSetCurrentRouteName();
  const { tuneStatusBar } = useTuneStatusBar();

  const onCurrentRouteChange = useCallback(
    (currentRouteName?: string) => {
      currentRouteName =
        currentRouteName || navigationRef?.getCurrentRoute()?.name;
      routeNameRef.current = currentRouteName;
      setCurrentRouteName(currentRouteName);
      tuneStatusBar(currentRouteName);
      __DEV__ &&
        console.debug(
          'onCurrentRouteChange::currentRouteName',
          currentRouteName,
        );

      return currentRouteName;
    },
    [setCurrentRouteName, tuneStatusBar],
  );

  const onReady = useCallback<
    React.ComponentProps<typeof NavigationContainer>['onReady'] & object
  >(() => {
    setNavigationReady(true);

    if (isAppUnlocked === false) {
      replace(RootNames.Unlock);
      onCurrentRouteChange(RootNames.Unlock);
    } else {
      onCurrentRouteChange();
    }

    analytics.logScreenView({
      screen_name: routeNameRef.current,
      screen_class: routeNameRef.current,
    });
    matomoLogScreenView({ name: routeNameRef.current! });
  }, [setNavigationReady, isAppUnlocked, onCurrentRouteChange]);

  const onStateChange = useCallback<
    React.ComponentProps<typeof NavigationContainer>['onStateChange'] & object
  >(() => {
    const previousRouteName = routeNameRef.current;
    const currentRouteName = navigationRef?.current?.getCurrentRoute()?.name;

    if (previousRouteName !== currentRouteName) {
      onCurrentRouteChange(currentRouteName);

      analytics.logScreenView({
        screen_name: routeNameRef.current,
        screen_class: routeNameRef.current,
      });
      matomoLogScreenView({ name: currentRouteName! });
    }
    routeNameRef.current = currentRouteName;
  }, [onCurrentRouteChange]);

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
          initialRouteName={RootNames.StackGetStarted}>
          <RootStack.Screen
            name={RootNames.StackGetStarted}
            component={GetStartedNavigator}
          />
          <RootStack.Screen
            name={RootNames.StackRoot}
            component={BottomTabNavigator}
            options={RootOptions}
          />
          <RootStack.Screen
            name={RootNames.Unlock}
            component={UnlockScreen}
            options={{
              ...screenOptions,
              title: '',
              headerTitle: '',
              headerBackVisible: false,
              headerShadowVisible: false,
              headerShown: true,
              headerTransparent: true,
              headerStyle: {
                backgroundColor: colors['neutral-bg1'],
              },
            }}
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
                backgroundColor: colors['neutral-bg1'],
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
      <BackgroundSecureBlurView />
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
