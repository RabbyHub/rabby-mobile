import { createCustomNativeStackNavigator as createNativeStackNavigator } from '@/utils/CustomNativeStackNavigator';
import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
} from '@react-navigation/native';
import React, { useCallback, useRef } from 'react';
import { BackHandler, ColorSchemeName } from 'react-native';
import * as Sentry from '@sentry/react-native';
import { useTheme2024, useThemeColors } from '@/hooks/theme';

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

import { GetStartedNavigator } from './screens/Navigators/GetStartedNavigator';
import { NFTDetailScreen } from './screens/NftDetail';
import { DeFiDetailScreen } from './screens/DeFiDetail';

import { HomeScreenNavigator } from './screens/Navigators/rootNavigator';

import usePrevious from 'ahooks/lib/usePrevious';
import {
  AppStatusBar,
  useTuneStatusBarOnRouteChange,
} from './components/AppStatusBar';
import AutoLockView from './components/AutoLockView';
import { BackgroundSecureBlurView } from './components/customized/BlurViews';
import { GlobalBottomSheetModal } from './components/GlobalBottomSheetModal/GlobalBottomSheetModal';
import { GlobalSecurityTipStubModal } from './components/Security/SecurityTipStubModal';
import { GlobalBottomSheetModal2024 } from './components2024/GlobalBottomSheetModal/GlobalBottomSheetModal';
import { useAppUnlocked } from './hooks/useLock';
import {
  AccountNavigatorParamList,
  FavoriteDappsNavigatorParamList,
  RootStackParamsList,
} from './navigation-type';
import { DuplicateAddressModal } from './screens/Address/components/DuplicateAddressModal';
import { FavoriteDappsScreen } from './screens/Dapps/FavoriteDappsScreen';
import { TestkitsNavigator } from './screens/Navigators/TestkitsNavigator';
import { AliasNameEditModal } from './components2024/AliasNameEditModal/AliasNameEditModal';
import { QrCodeModal } from './components2024/QrCodeModal/QrCodeModal';
import TransactionNavigator from './screens/Navigators/TransactionNavigator';
import { ScannerScreen } from './screens/Scanner/ScannerScreen';
import { FloatViewAutoLockCount } from './screens/Settings/components/FloatView';
import UnlockScreen from './screens/Unlock/Unlock';
import { SingleAddressNavigator } from './screens/Navigators/SingleAddressNavigator';
import { TokenDetailScreen } from './screens/TokenDetail';
// import { GlobalAccountSwitcherStub } from './components/AccountSwitcher/SheetModal';
import { toast } from './components2024/Toast';
import RNHelpers from './core/native/RNHelpers';
import { IS_IOS } from './core/native/utils';

const RootStack = createNativeStackNavigator<RootStackParamsList>();

const AccountStack = createNativeStackNavigator<AccountNavigatorParamList>();

const FavoriteDappsStack =
  createNativeStackNavigator<FavoriteDappsNavigatorParamList>();

const RootOptions = { animation: 'none' } as const;
const RootStackOptions = {
  animation: 'slide_from_right',
  headerShown: false,
} as const;

const REST_COUNTS = {
  CANT_EXIT: 10,
  ON_EXIT: -1,
  PRE_EXIT: 0,
};

const backRestCountRef = {
  current: REST_COUNTS.CANT_EXIT,
  resetTimer: null as any,
};
function useGetSetBackRestCount() {
  const getBackRestCount = useCallback(() => {
    return backRestCountRef.current;
  }, []);

  const setBackRestCount = useCallback((value: number) => {
    backRestCountRef.current = value;
  }, []);

  const setBackStage = useCallback(
    (stage: (typeof REST_COUNTS)[keyof typeof REST_COUNTS]) => {
      backRestCountRef.current = stage;
      if (stage !== REST_COUNTS.CANT_EXIT) {
        backRestCountRef.resetTimer = setTimeout(() => {
          setBackRestCount(REST_COUNTS.CANT_EXIT);
        }, 2500);
      }
    },
    [setBackRestCount],
  );

  return {
    getBackRestCount,
    setBackStage,
  };
}

function useDetermineExitAppOnPressBack() {
  const { getBackRestCount, setBackStage } = useGetSetBackRestCount();

  React.useEffect(() => {
    /**
     * in fact, BackHandler.addEventListener('hardwareBackPress', backAction) is not working on iOS,
     * we just put it here for the sake of robustness.
     */
    if (IS_IOS) return;

    const backAction = () => {
      const restCount = getBackRestCount();
      const navigationInst = navigationRef.current;
      if (navigationInst && !navigationInst?.canGoBack()) {
        if (restCount > REST_COUNTS.PRE_EXIT) {
          toast.info('Press back 2 times to exit');
          setBackStage(REST_COUNTS.PRE_EXIT);
        } else if (restCount === REST_COUNTS.PRE_EXIT) {
          toast.info('Press back again to exit');
          setBackStage(REST_COUNTS.ON_EXIT);
        } else if (restCount === REST_COUNTS.ON_EXIT) {
          try {
            RNHelpers.forceExitApp();
            return true;
          } catch (error) {
            console.error(error);
            Sentry.captureException(
              new Error(`exit app failed, ${JSON.stringify(error)}`),
            );
            // BackHandler.exitApp();
            return false;
          }
        }

        return true;
      } else {
        setBackStage(REST_COUNTS.CANT_EXIT);
      }

      // not prevent by default
      return false;
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction,
    );

    return () => backHandler.remove();
  }, [getBackRestCount, setBackStage]);
}

export default function AppNavigation({
  colorScheme,
}: {
  colorScheme: ColorSchemeName;
}) {
  const routeNameRef = useRef<string>();
  const { mergeScreenOptions } = useStackScreenConfig();
  const colors = useThemeColors();

  const { isAppUnlocked } = useAppUnlocked();
  const { setNavigationReady } = useSetNavigationReady();

  const { setCurrentRouteName } = useSetCurrentRouteName();
  const { tuneOnRouteChange } = useTuneStatusBarOnRouteChange();

  const onRouteChange = useCallback(
    (currentRouteName?: string) => {
      currentRouteName =
        currentRouteName || navigationRef.getCurrentRoute()?.name;
      routeNameRef.current = currentRouteName;

      // tuneOnRouteChange(currentRouteName);
      setCurrentRouteName(currentRouteName);

      /**
       * Some actions would reset the StatusBar style, such as navigation.setOptions,
       * so component `AppStatusBar` works for those Screen without weired behaviors from '@react-native/navigation'.
       *
       * we do extra tune for StatusBar
       */
      setTimeout(() => {
        tuneOnRouteChange(currentRouteName);
      }, 250);
    },
    [setCurrentRouteName, tuneOnRouteChange],
  );

  const onReady = useCallback<
    React.ComponentProps<typeof NavigationContainer>['onReady'] & object
  >(() => {
    setNavigationReady(true);
    let readyRootName = navigationRef.getCurrentRoute()?.name!;
    if (!isAppUnlocked) {
      replace(RootNames.Unlock);
      readyRootName = RootNames.Unlock;
    }
    onRouteChange(readyRootName);

    analytics.logScreenView({
      screen_name: readyRootName,
      screen_class: readyRootName,
    });
    matomoLogScreenView({ name: readyRootName });
  }, [setNavigationReady, isAppUnlocked, onRouteChange]);

  const onStateChange = useCallback<
    React.ComponentProps<typeof NavigationContainer>['onStateChange'] & object
  >(
    _navState => {
      const previousRouteName = routeNameRef.current;
      const currentRouteName = navigationRef?.current?.getCurrentRoute()?.name;

      if (previousRouteName !== currentRouteName) {
        onRouteChange(currentRouteName);

        analytics.logScreenView({
          screen_name: routeNameRef.current,
          screen_class: routeNameRef.current,
        });
        matomoLogScreenView({ name: currentRouteName! });
      }
      routeNameRef.current = currentRouteName;
    },
    [onRouteChange],
  );

  useDetermineExitAppOnPressBack();

  const previousRoute = usePrevious(routeNameRef.current);
  const isSlideFromGetStarted =
    [undefined, RootNames.GetStarted, RootNames.GetStartedScreen2024].includes(
      previousRoute as any,
    ) && routeNameRef.current === RootNames.Unlock;
  // console.debug('previousRoute: %s, routeNameRef.current: %s, isSlideFromGetStarted: %s', previousRoute, routeNameRef.current, isSlideFromGetStarted);

  return (
    <AutoLockView.ForAppNav
      style={{ flex: 1, backgroundColor: colors['neutral-bg-2'] }}>
      <AppStatusBar __isTop__ />
      <GlobalBottomSheetModal />
      <GlobalBottomSheetModal2024 />
      {/* <GlobalAccountSwitcherStub /> */}

      <NavigationContainer
        ref={navigationRef}
        // key={userId}
        onReady={onReady}
        onStateChange={onStateChange}
        independent
        // linking={LinkingConfiguration}
        theme={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <DuplicateAddressModal />
        <AliasNameEditModal />
        <QrCodeModal />

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
            component={HomeScreenNavigator}
            options={RootOptions}
          />
          <RootStack.Screen
            name={RootNames.SingleAddressStack}
            component={SingleAddressNavigator}
          />
          <RootStack.Screen
            name={RootNames.Unlock}
            component={UnlockScreen}
            options={mergeScreenOptions({
              title: '',
              // another valid composition
              // animationTypeForReplace: isSlideFromGetStarted ? 'push' : 'pop',
              // animation: isSlideFromGetStarted ? 'fade_from_bottom' : 'slide_from_left',
              // animationTypeForReplace: 'push',
              animation: 'fade_from_bottom',
              headerTitle: '',
              headerBackVisible: false,
              headerShadowVisible: false,
              // headerShown: true,
              headerTransparent: true,
              headerStyle: {
                // backgroundColor: colors['neutral-bg1'],
              },
            })}
          />
          <RootStack.Screen
            name={RootNames.NotFound}
            component={NotFoundScreen}
            options={mergeScreenOptions({
              title: 'Rabby Wallet',
              headerShadowVisible: false,
              headerShown: true,
              headerTransparent: false,
              headerStyle: {
                backgroundColor: colors['neutral-bg1'],
              },
            })}
          />
          <RootStack.Screen
            name={RootNames.StackTestkits}
            component={TestkitsNavigator}
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
            name={RootNames.StackFavoriteDapps}
            component={FavoriteDappsNavigator}
          />
          <RootStack.Screen
            name={RootNames.NftDetail}
            component={NFTDetailScreen}
            options={mergeScreenOptions({
              headerShown: true,
              headerTitleAlign: 'center',
              headerTitle: '',
              headerStyle: {
                // backgroundColor: colors['neutral-bg-2'],
                backgroundColor: 'transparent',
              },
            })}
          />
          <RootStack.Screen
            name={RootNames.DeFiDetail}
            component={DeFiDetailScreen}
            options={mergeScreenOptions({
              headerShown: true,
              headerTitleAlign: 'center',
              headerTitle: 'DeFi Detail',
              headerLeft: () => null,
              headerStyle: {
                backgroundColor: 'transparent',
              },
            })}
          />
          <RootStack.Screen
            name={RootNames.TokenDetail}
            component={TokenDetailScreen}
            options={mergeScreenOptions({
              headerShown: true,
              headerTitleAlign: 'left',
              headerTitle: '',
              headerStyle: {
                // backgroundColor: colors['neutral-bg-2'],
                backgroundColor: 'transparent',
              },
            })}
          />
          <RootStack.Screen
            name={RootNames.Scanner}
            component={ScannerScreen}
            options={mergeScreenOptions({
              title: 'Scan',
              headerShadowVisible: false,
              headerShown: true,
              headerStyle: {
                backgroundColor: colors['neutral-black'],
              },
              headerTintColor: colors['neutral-title-2'],
              headerTitleStyle: {
                color: colors['neutral-title-2'],
                fontWeight: 'normal',
              },
            })}
          />
        </RootStack.Navigator>
      </NavigationContainer>
      <GlobalSecurityTipStubModal />
      <BackgroundSecureBlurView />

      <FloatViewAutoLockCount />
    </AutoLockView.ForAppNav>
  );
}

function AccountNavigator() {
  const { mergeScreenOptions } = useStackScreenConfig();
  const colors = useThemeColors();
  // console.log('============== AccountsNavigator Render =========');

  return (
    <AccountStack.Navigator
      screenOptions={mergeScreenOptions({
        gestureEnabled: false,
        headerTitleAlign: 'center',
        headerStyle: {
          backgroundColor: 'transparent',
        },
        headerTitleStyle: {
          color: colors['neutral-title-1'],
          fontWeight: 'normal',
        },
      })}>
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

function FavoriteDappsNavigator() {
  const { mergeScreenOptions } = useStackScreenConfig();
  const { colors } = useTheme2024();
  // console.log('============== FavoritePopularNavigator Render =========');

  return (
    <FavoriteDappsStack.Navigator
      screenOptions={mergeScreenOptions({
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
      })}>
      <FavoriteDappsStack.Screen
        name={RootNames.FavoriteDapps}
        component={FavoriteDappsScreen}
        options={mergeScreenOptions({
          headerTintColor: colors['neutral-title-1'],
          headerTitleStyle: {
            fontWeight: '800',
            color: colors['neutral-title-1'],
          },
        })}
      />
    </FavoriteDappsStack.Navigator>
  );
}
