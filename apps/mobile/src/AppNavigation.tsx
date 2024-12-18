import { createCustomNativeStackNavigator as createNativeStackNavigator } from '@/utils/CustomNativeStackNavigator';
import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
} from '@react-navigation/native';
import React, { useCallback, useRef } from 'react';
import { ColorSchemeName } from 'react-native';

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
import { TokenDetailScreen, RightMore } from './screens/TokenDetail';
// import { GlobalAccountSwitcherStub } from './components/AccountSwitcher/SheetModal';

const RootStack = createNativeStackNavigator<RootStackParamsList>();

const AccountStack = createNativeStackNavigator<AccountNavigatorParamList>();

const FavoriteDappsStack =
  createNativeStackNavigator<FavoriteDappsNavigatorParamList>();

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
            })}
          />
          <RootStack.Screen
            name={RootNames.TokenDetail}
            component={TokenDetailScreen}
            options={mergeScreenOptions({
              headerShown: true,
              headerTitleAlign: 'left',
              headerTitle: '',
              headerRight: RightMore,
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
