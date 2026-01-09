import { createCustomNativeStackNavigator as createNativeStackNavigator } from '@/utils/CustomNativeStackNavigator';
import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  NavigationIndependentTree,
} from '@react-navigation/native';
import React, { useCallback, useMemo, useRef } from 'react';
import { Appearance, BackHandler, ColorSchemeName } from 'react-native';
import * as Sentry from '@sentry/react-native';
import { useAppTheme, useTheme2024, useThemeColors } from '@/hooks/theme';

import { navigationRef, replace } from '@/utils/navigation';
import {
  DEFAULT_NAVBAR_FONT_SIZE,
  getScreenStatusBarConf,
  RootNames,
} from './constant/layout';
import { apisHomeTabIndex, useStackScreenConfig } from './hooks/navigation';
import { analytics, matomoLogScreenView } from './utils/analytics';

import {
  TestkitsNavigator,
  AddressNavigator,
  SettingNavigator,
  GetStartedNavigator,
  HomeScreenNavigator,
  TransactionNavigator,
  SingleAddressNavigator,
  DappsNavigator,
  HomeNonTabNavigator,
} from './screens/Navigators/index.eager';

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

import type {
  AccountNavigatorParamList,
  DappsNavigatorParamsList,
  HomeNavigatorParamsList,
  RootStackParamsList,
} from './navigation-type';

import { DuplicateAddressModal } from './screens/Address/components/DuplicateAddressModal';

import { AliasNameEditModal } from './components2024/AliasNameEditModal/AliasNameEditModal';
import { QrCodeModal } from './components2024/QrCodeModal/QrCodeModal';
import { FloatViewAutoLockCount } from './screens/Settings/components/FloatView';

// import { GlobalAccountSwitcherStub } from './components/AccountSwitcher/SheetModal';
import { toast } from './components2024/Toast';
import RNHelpers from './core/native/RNHelpers';
import { IS_ANDROID, IS_IOS } from './core/native/utils';

import {
  UnlockScreen,
  FavoriteDappsScreen,
  NotFoundScreen,
  MyBundleScreen,
} from '@/screens/index.lazy';
import {
  ScannerScreen,
  TokenDetailScreen,
  NFTDetailScreen,
  DeFiDetailScreen,
} from '@/screens/index.eager';
import BiometricsStubModal from './components/AuthenticationModal/BiometricsStubModal';
import ApprovalTokenDetailSheetModalStub from './components/TokenDetailPopup/ApprovalTokenDetailSheetModalStub';
import { GlobalMiniApproval } from './components/Approval/components/MiniSignTx/GlobalMiniApproval';
import { GlobalSignerPortal } from './components2024/MiniSignV2/components/GlobalSignerPortal';
import { perfEvents } from './core/utils/perf';
import {
  BottomSheetBrowser,
  BrowserFavoritePopup,
  BrowserManagePopup,
} from './screens/Browser/BottomSheetBrowser';
import { TokenMarketInfoScreen } from './screens/TokenDetail/TokenMarketInfoScreen';
import { ModalsSubmitFeedbackByScreenshotStub } from './components/Screenshot/ScreenshotModal';
import { GlobalTipsPopup } from './components2024/GlobalTipsPopup';
import { GlobalMiniSignTypedDataPortal } from './components/Approval/components/MiniSignTypedData/GlobalMiniSignTypedDataPortal';
import { GlobalSearchBottomSheet } from './screens/Search/components/SeachBottomSheet';
import { ToggleCollateralModal } from './screens/Lending/modals/ToggleCollateralModal';
import { RefLikeObject } from './utils/type';
import { useRendererDetect } from './components/Perf/PerfDetector';
import DeviceInfo from 'react-native-device-info';
import { coerceNumber } from './utils/coerce';
import { useAppCouldRender } from './hooks/useBootstrap';

const RootStack = createNativeStackNavigator<RootStackParamsList>();

const AccountStack = createNativeStackNavigator<AccountNavigatorParamList>();

const RootAnimOptions: React.ComponentProps<
  typeof RootStack.Navigator
>['screenOptions'] &
  object = {
  // animation: IS_IOS ? 'slide_from_right' : 'none',
  animation: __DEV__ ? 'slide_from_right' : 'none',
  animationDuration: 200,
};

const REST_COUNTS = {
  CANT_EXIT: 10,
  ON_EXIT: -1,
  PRE_EXIT: 0,
};

const backRestCountRef = {
  current: REST_COUNTS.CANT_EXIT,
  resetTimer: null as ReturnType<typeof setTimeout> | null,
};

const getBackRestCount = () => {
  return backRestCountRef.current;
};

const setBackRestCount = (value: number) => {
  backRestCountRef.current = value;
};

const setBackStage = (
  stage: (typeof REST_COUNTS)[keyof typeof REST_COUNTS],
) => {
  backRestCountRef.current = stage;
  if (stage !== REST_COUNTS.CANT_EXIT) {
    backRestCountRef.resetTimer = setTimeout(() => {
      setBackRestCount(REST_COUNTS.CANT_EXIT);
    }, 2500);
  }
};

function atHome() {
  return navigationRef.getCurrentRoute()?.name === RootNames.Home;
}
function atHomeFirstTab() {
  return atHome() && apisHomeTabIndex.isHomeAtFirstTab();
}

const isAndroidGte16 = (() => {
  try {
    const androiVersion = DeviceInfo.getSystemVersion();
    return IS_ANDROID && coerceNumber(androiVersion?.split('.')[0]) >= 16;
  } catch (error) {
    console.error(error);
    return false;
  }
})();

const PREVENT_GESTURE_BOOL = true;

function useDetermineExitAppOnPressBack() {
  React.useEffect(() => {
    /**
     * in fact, BackHandler.addEventListener('hardwareBackPress', backAction) is not working on iOS,
     * we just put it here for the sake of robustness.
     */
    if (IS_IOS) return;

    const backAction = () => {
      if (atHome()) {
        if (!atHomeFirstTab()) {
          perfEvents.emit('NAV_BACK_ON_HOME');
          return PREVENT_GESTURE_BOOL;
        }
      }

      // not prevent by default
      const finalRet = !PREVENT_GESTURE_BOOL;

      const restCount = getBackRestCount();
      const navigationInst = navigationRef.current;
      if (navigationInst && !navigationInst?.canGoBack()) {
        /* if (restCount > REST_COUNTS.PRE_EXIT) {
          toast.info('Press back 2 times to exit');
          setBackStage(REST_COUNTS.ON_EXIT);
        } else  */ if (restCount >= REST_COUNTS.PRE_EXIT) {
          toast.info('Press back again to exit');
          setBackStage(REST_COUNTS.ON_EXIT);
        } else if (restCount === REST_COUNTS.ON_EXIT) {
          try {
            RNHelpers.forceExitApp();
            return PREVENT_GESTURE_BOOL;
          } catch (error) {
            console.error(error);
            Sentry.captureException(
              new Error(`exit app failed, ${JSON.stringify(error)}`),
            );
            // BackHandler.exitApp();
            return finalRet;
          }
        }

        return PREVENT_GESTURE_BOOL;
      } else {
        setBackStage(REST_COUNTS.CANT_EXIT);
      }

      return finalRet;
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction,
    );

    return () => backHandler.remove();
  }, []);
}

const onRouteChange = (
  _currentRouteName?: string,
  previousRouteName = routeNameRef.current,
) => {
  const currentRouteName =
    _currentRouteName || navigationRef.getCurrentRoute()?.name;
  routeNameRef.current = currentRouteName;

  perfEvents.emit('EVENT_ROUTE_CHANGE', {
    currentRouteName,
    previousRouteName: previousRouteName ?? undefined,
  });
};

const onStateChange: React.ComponentProps<
  typeof NavigationContainer
>['onStateChange'] &
  object = _navState => {
  const previousRouteName = routeNameRef?.current;
  const currentRouteName = navigationRef?.current?.getCurrentRoute()?.name;

  if (previousRouteName !== currentRouteName) {
    onRouteChange(currentRouteName, previousRouteName);

    analytics.logScreenView({
      screen_name: routeNameRef.current || '',
      screen_class: routeNameRef.current || '',
    });
    matomoLogScreenView({ name: currentRouteName! });
  }
  routeNameRef.current = currentRouteName;
};

const routeNameRef: RefLikeObject<string | undefined | null> = { current: '' };
export default function AppNavigation() {
  const { mergeScreenOptions } = useStackScreenConfig();
  const { binaryTheme: colorScheme } = useAppTheme({ isAppTop: true });

  const colors = useThemeColors();

  const { getIsAppUnlocked } = useAppUnlocked();

  const onReady = useCallback<
    React.ComponentProps<typeof NavigationContainer>['onReady'] & object
  >(() => {
    let readyRootName = navigationRef.getCurrentRoute()?.name!;
    if (!getIsAppUnlocked()) {
      replace(RootNames.Unlock);
      readyRootName = RootNames.Unlock;
    }
    perfEvents.emit('APP_NAVIGATION_READY', {
      readyRootName,
    });
    onRouteChange(readyRootName);

    analytics.logScreenView({
      screen_name: readyRootName,
      screen_class: readyRootName,
    });
    matomoLogScreenView({ name: readyRootName });
  }, [getIsAppUnlocked]);

  useDetermineExitAppOnPressBack();

  useRendererDetect({ name: 'AppNavigation' });

  console.debug(
    'routeNameRef.current, colorScheme',
    routeNameRef.current,
    colorScheme,
    navigationRef.current,
  );

  // const { couldRender } = useAppCouldRender();

  // if (!couldRender) return null;

  return (
    <AutoLockView.ForAppNav
      style={{ flex: 1, backgroundColor: colors['neutral-bg-2'] }}>
      <AppStatusBar __isTop__ />
      <GlobalBottomSheetModal />
      <GlobalBottomSheetModal2024 />
      {/* <GlobalAccountSwitcherStub /> */}
      <NavigationIndependentTree>
        <NavigationContainer
          navigationInChildEnabled
          ref={navigationRef}
          // key={userId}
          onReady={onReady}
          onStateChange={onStateChange}
          theme={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <DuplicateAddressModal />
          <AliasNameEditModal />
          <QrCodeModal />
          <RootStack.Navigator
            screenOptions={{
              ...RootAnimOptions,
              headerShown: false,
              navigationBarColor: 'transparent',
              freezeOnBlur: false,
            }}
            initialRouteName={RootNames.StackGetStarted}>
            <RootStack.Screen
              name={RootNames.StackGetStarted}
              component={GetStartedNavigator}
            />
            <RootStack.Screen
              name={RootNames.StackRoot}
              component={HomeScreenNavigator}
              options={RootAnimOptions}
            />
            <RootStack.Screen
              name={RootNames.StackHomeNonTab}
              component={HomeNonTabNavigator}
              options={RootAnimOptions}
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
              name={RootNames.StackDapps}
              component={DappsNavigator}
            />
            <RootStack.Group
              screenOptions={
                {
                  // freezeOnBlur: true,
                }
              }>
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
                  headerTitle: '',
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
                getId={({ params }) => {
                  const idStr = [
                    params.token.id,
                    params.isSwapToTokenDetail ? 'swapTo' : 'normal',
                    params.tokenSelectType,
                  ]
                    .filter(Boolean)
                    .join('-');
                  return idStr || undefined;
                }}
              />
              <RootStack.Screen
                name={RootNames.TokenMarketInfo}
                component={TokenMarketInfoScreen}
                options={mergeScreenOptions({
                  headerShown: true,
                  headerTitleAlign: 'left',
                  headerTitle: '',
                  headerStyle: {
                    // backgroundColor: colors['neutral-bg-2'],
                    backgroundColor: 'transparent',
                  },
                })}
                getId={({ params }) => {
                  const idStr = [
                    params.token.id,
                    params.isSwapToTokenDetail ? 'swapTo' : 'normal',
                    params.tokenSelectType,
                  ]
                    .filter(Boolean)
                    .join('-');
                  return idStr || undefined;
                }}
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
                    fontWeight: '900',
                    fontFamily: 'SF Pro Rounded',
                  },
                })}
              />
            </RootStack.Group>
          </RootStack.Navigator>
          <BiometricsStubModal />
          <ApprovalTokenDetailSheetModalStub />
          <GlobalSearchBottomSheet />
          <BottomSheetBrowser />
          <BrowserManagePopup />
          <BrowserFavoritePopup />
        </NavigationContainer>
      </NavigationIndependentTree>
      <ModalsSubmitFeedbackByScreenshotStub />
      <ToggleCollateralModal />

      {/** @warning put all business stub components before this modal */}
      <GlobalSecurityTipStubModal />
      <BackgroundSecureBlurView />
      <FloatViewAutoLockCount />
      <GlobalMiniApproval />
      <GlobalMiniSignTypedDataPortal />
      <GlobalTipsPopup />
      <GlobalSignerPortal />
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
