import { createCustomNativeStackNavigator as createNativeStackNavigator } from '@/utils/CustomNativeStackNavigator';
import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  NavigationIndependentTree,
} from '@react-navigation/native';
import React, { useCallback } from 'react';
import {
  BackHandler,
  InteractionManager,
  StyleSheet,
  View,
} from 'react-native';
import * as Sentry from '@sentry/react-native';
import { useAppTheme, useThemeColors } from '@/hooks/theme';

import { navigationRef } from '@/utils/navigation';
import { RootNames } from './constant/layout';
import { apisHomeTabIndex, useStackScreenConfig } from './hooks/navigation';
import { analytics, matomoLogScreenView } from './utils/analytics';
import * as apisAccount from './core/apis/account';

import { AppStatusBar } from './components/AppStatusBar';
import AutoLockView from './components/AutoLockView';
import { GlobalBottomSheetModal } from './components/GlobalBottomSheetModal/GlobalBottomSheetModal';
import { GlobalBottomSheetModal2024 } from './components2024/GlobalBottomSheetModal/GlobalBottomSheetModal';
import { useAppUnlocked } from './hooks/useLock';

import type {
  AccountNavigatorParamList,
  RootStackParamsList,
} from './navigation-type';

// import { GlobalAccountSwitcherStub } from './components/AccountSwitcher/SheetModal';
import { toast } from './components2024/Toast';
import RNHelpers from './core/native/RNHelpers';
import { IS_IOS } from './core/native/utils';
import {
  MyBundleScreen,
  NFTDetailScreen,
  NotFoundScreen,
  ScannerScreen,
  TokenDetailScreen,
  TokenMarketInfoScreen,
} from '@/perfs/loadables/screens';
import UnlockScreen from '@/screens/Unlock/Unlock';
import SetupWallet from '@/screens/Address/SetupWallet';
import SelectImportMethod from '@/screens/Address/SelectImportMethod';
import ImportRabbyWallet from '@/screens/Address/ImportRabbyWallet';
import { ImportSecret } from '@/screens/Address/ImportSecret';
import MoreImportMethods from '@/screens/Address/MoreImportMethods';
import SelectAddMethod from '@/screens/Address/SelectAddMethod';
import Backup from '@/screens/Address/Backup';
import BiometricsStubModal from './components/AuthenticationModal/BiometricsStubModal';
import { perfEvents } from './core/utils/perf';
import { RefLikeObject } from './utils/type';
import { useRendererDetect } from './components/Perf/PerfDetector';
import { useTranslation } from 'react-i18next';
import {
  AliasNameEditModal,
  ApprovalTokenDetailSheetModalStub,
  BackgroundSecureBlurView,
  BottomSheetBrowser,
  BottomSheetDappInfoPopup,
  BrowserFavoritePopup,
  BrowserManagePopup,
  DuplicateAddressModal,
  FloatingDiagnosticsPanel,
  GlobalMiniApproval,
  GlobalMiniSignTypedDataPortal,
  GlobalSecurityTipStubModal,
  GlobalSignerPortal,
  GlobalTipsPopup,
  InnerDappWebViewPreloadEntry,
  ModalsSubmitFeedbackByScreenshotStub,
  QrCodeModal,
  ToggleCollateralModal,
  WideScreenDebugPanel,
} from '@/perfs/loadables/appNavigationGlobals';
import {
  AddressNavigator,
  DappsNavigator,
  HomeNonTabNavigator,
  SettingNavigator,
  SingleAddressNavigator,
  TestkitsNavigator,
  TransactionNavigator,
} from '@/perfs/loadables/navigators';
import { HomeScreenNavigator } from '@/perfs/loadables/homeRootNavigator';
import { GetStartedNavigator } from './screens/Navigators/GetStartedNavigator';

const RootStack = createNativeStackNavigator<RootStackParamsList>();
const AccountStack = createNativeStackNavigator<AccountNavigatorParamList>();

type AppInitialRouteName =
  | typeof RootNames.StackGetStarted
  | typeof RootNames.StackRoot
  | typeof RootNames.Unlock;

function useAppInitialRouteName(isAppUnlocked: boolean) {
  const [initialRouteName, setInitialRouteName] =
    React.useState<AppInitialRouteName | null>(() =>
      isAppUnlocked ? null : RootNames.Unlock,
    );

  React.useEffect(() => {
    if (!isAppUnlocked) {
      setInitialRouteName(prev => prev || RootNames.Unlock);
      return;
    }
    if (initialRouteName) {
      return;
    }

    let cancelled = false;

    apisAccount
      .hasVisibleAccounts()
      .then(hasVisibleAccounts => {
        if (cancelled) {
          return;
        }

        setInitialRouteName(
          hasVisibleAccounts ? RootNames.StackRoot : RootNames.StackGetStarted,
        );
      })
      .catch(error => {
        console.error('useAppInitialRouteName::error', error);
        if (!cancelled) {
          setInitialRouteName(RootNames.StackRoot);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [initialRouteName, isAppUnlocked]);

  return initialRouteName;
}

const RootAnimOptions: React.ComponentProps<
  typeof RootStack.Navigator
>['screenOptions'] &
  object = {
  animation: 'none',
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

const PREVENT_GESTURE_BOOL = true;

function useDetermineExitAppOnPressBack() {
  React.useEffect(() => {
    /**
     * in fact, BackHandler.addEventListener('hardwareBackPress', backAction) is not working on iOS,
     * we just put it here for the sake of robustness.
     */
    if (IS_IOS) {
      return;
    }

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

type DeferredGlobalsSlot = 'navigation-pre' | 'navigation-post' | 'overlay';
const DEFERRED_GLOBALS_AFTER_UNLOCK_DELAY_MS = 800;

function useRenderDeferredGlobalsAfterFirstUnlock(isAppUnlocked: boolean) {
  const [hasUnlockedOnce, setHasUnlockedOnce] = React.useState(isAppUnlocked);

  React.useEffect(() => {
    if (!isAppUnlocked || hasUnlockedOnce) {
      return;
    }

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const interactionHandle = InteractionManager.runAfterInteractions(() => {
      timeoutId = setTimeout(() => {
        setHasUnlockedOnce(true);
      }, DEFERRED_GLOBALS_AFTER_UNLOCK_DELAY_MS);
    });

    return () => {
      interactionHandle.cancel?.();
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [hasUnlockedOnce, isAppUnlocked]);

  React.useEffect(() => {
    if (isAppUnlocked) {
      return;
    }

    setHasUnlockedOnce(false);
  }, [isAppUnlocked]);

  return hasUnlockedOnce;
}

function AppNavigationDeferredGlobals({
  slot,
  enabled,
}: {
  slot: DeferredGlobalsSlot;
  enabled: boolean;
}) {
  if (!enabled) {
    return null;
  }

  if (slot === 'navigation-pre') {
    return (
      <>
        <DuplicateAddressModal />
        <AliasNameEditModal />
        <QrCodeModal />
      </>
    );
  }

  if (slot === 'navigation-post') {
    return (
      <>
        <InnerDappWebViewPreloadEntry />
        <BiometricsStubModal />
        <ApprovalTokenDetailSheetModalStub />
        <BottomSheetBrowser />
        <BrowserManagePopup />
        <BrowserFavoritePopup />
        <BottomSheetDappInfoPopup />
      </>
    );
  }

  return (
    <>
      <ModalsSubmitFeedbackByScreenshotStub />
      <ToggleCollateralModal />

      {/** @warning put all business stub components before this modal */}
      <GlobalSecurityTipStubModal />
      <FloatingDiagnosticsPanel />
      <GlobalMiniApproval />
      <GlobalMiniSignTypedDataPortal />
      <GlobalTipsPopup />
      <GlobalSignerPortal />
    </>
  );
}

export default function AppNavigation() {
  const { mergeScreenOptions, mergeScreenOptions2024 } = useStackScreenConfig();
  const { binaryTheme: colorScheme } = useAppTheme({ isAppTop: true });
  const { t } = useTranslation();

  const colors = useThemeColors();

  const { isAppUnlocked } = useAppUnlocked();
  const initialRouteName = useAppInitialRouteName(isAppUnlocked);
  const shouldRenderDeferredGlobals =
    useRenderDeferredGlobalsAfterFirstUnlock(isAppUnlocked);

  const onReady = useCallback<
    React.ComponentProps<typeof NavigationContainer>['onReady'] & object
  >(() => {
    const readyRootName = navigationRef.getCurrentRoute()?.name!;
    perfEvents.emit('APP_NAVIGATION_READY', {
      readyRootName,
    });
    onRouteChange(readyRootName);

    analytics.logScreenView({
      screen_name: readyRootName,
      screen_class: readyRootName,
    });
    matomoLogScreenView({ name: readyRootName });
  }, []);

  useDetermineExitAppOnPressBack();

  useRendererDetect({ name: 'AppNavigation' });

  if (!initialRouteName) {
    return (
      <AutoLockView.ForAppNav
        style={{ flex: 1, backgroundColor: colors['neutral-bg-2'] }}>
        <AppStatusBar __isTop__ />
      </AutoLockView.ForAppNav>
    );
  }

  return (
    <AutoLockView.ForAppNav
      style={{ flex: 1, backgroundColor: colors['neutral-bg-2'] }}>
      <AppStatusBar __isTop__ />
      <GlobalBottomSheetModal />
      <GlobalBottomSheetModal2024 />
      {/* <GlobalAccountSwitcherStub /> */}
      <View style={appNavigationStyles.layout}>
        <View style={appNavigationStyles.mainPane}>
          <NavigationIndependentTree>
            <NavigationContainer
              navigationInChildEnabled
              ref={navigationRef}
              // key={userId}
              onReady={onReady}
              onStateChange={onStateChange}
              theme={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
              <AppNavigationDeferredGlobals
                slot="navigation-pre"
                enabled={shouldRenderDeferredGlobals}
              />
              <RootStack.Navigator
                screenOptions={{
                  ...RootAnimOptions,
                  headerShown: false,
                  navigationBarColor: 'transparent',
                  freezeOnBlur: false,
                }}
                initialRouteName={initialRouteName}>
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
                  name={RootNames.SetupWallet}
                  component={SetupWallet}
                  options={{ headerShown: false }}
                />
                <RootStack.Screen
                  name={RootNames.SelectImportMethod}
                  component={SelectImportMethod}
                  options={mergeScreenOptions2024([
                    {
                      headerShown: true,
                      headerTitle: t('screens.addressStackTitle.ImportMethods'),
                    },
                  ])}
                />
                <RootStack.Screen
                  name={RootNames.ImportRabbyWallet}
                  component={ImportRabbyWallet}
                  options={mergeScreenOptions2024([
                    {
                      headerShown: true,
                      headerTitle: t(
                        'page.newUserOnboarding.restoreWallet.title',
                      ),
                    },
                  ])}
                />
                <RootStack.Screen
                  name={RootNames.ImportSecret}
                  component={ImportSecret}
                  options={mergeScreenOptions2024([
                    {
                      headerShown: true,
                    },
                  ])}
                />
                <RootStack.Screen
                  name={RootNames.MoreImportMethods}
                  component={MoreImportMethods}
                  options={mergeScreenOptions2024([
                    {
                      headerShown: true,
                      headerTitle: t(
                        'screens.addressStackTitle.MoreImportMethods',
                      ),
                    },
                  ])}
                />
                <RootStack.Screen
                  name={RootNames.SelectAddMethod}
                  component={SelectAddMethod}
                  options={mergeScreenOptions2024([
                    {
                      headerShown: true,
                      headerTitle: t(
                        'page.nextComponent.addAddress.selectAddMethod',
                      ),
                    },
                  ])}
                />
                <RootStack.Screen
                  name={RootNames.Backup}
                  component={Backup}
                  options={mergeScreenOptions2024([
                    {
                      headerShown: true,
                      headerTitle: t('screens.addressStackTitle.ChooseBackup'),
                    },
                  ])}
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
              <AppNavigationDeferredGlobals
                slot="navigation-post"
                enabled={shouldRenderDeferredGlobals}
              />
            </NavigationContainer>
          </NavigationIndependentTree>
        </View>
        {shouldRenderDeferredGlobals ? <WideScreenDebugPanel /> : null}
      </View>
      <AppNavigationDeferredGlobals
        slot="overlay"
        enabled={shouldRenderDeferredGlobals}
      />
      <BackgroundSecureBlurView />
    </AutoLockView.ForAppNav>
  );
}

const appNavigationStyles = StyleSheet.create({
  layout: {
    flex: 1,
    flexDirection: 'row',
    minWidth: 0,
  },
  mainPane: {
    flex: 1,
    minWidth: 0,
    height: '100%',
  },
});

function AccountNavigator() {
  const { mergeScreenOptions } = useStackScreenConfig();
  const colors = useThemeColors();

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
