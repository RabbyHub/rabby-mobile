import React, { useCallback, useEffect, useMemo } from 'react';
import { Alert, AppState, Platform, StyleSheet } from 'react-native';
import { debounce, get, merge } from 'lodash';

import type {
  NativeStackHeaderLeftProps,
  NativeStackNavigationOptions,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import { apisTheme, useGetBinaryMode } from '../hooks/theme';
import {
  getReadyNavigationInstance,
  navigationRef,
  naviPush,
  naviReplace,
} from '@/utils/navigation';
import { CustomTouchableOpacity } from '@/components/CustomTouchableOpacity';

import { default as RcIconHeaderBack } from '@/assets/icons/header/back-cc.svg';
import type { AppRootName } from '@/constant/layout';
import { RootNames, makeHeadersPresets } from '@/constant/layout';
import { APP_FEATURE_SWITCH } from '@/constant';
import type { NavigationContainerRef } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';

import type { RootStackParamsList } from '@/navigation-type';
import * as apisLock from '@/core/apis/lock';
import * as apisAccount from '@/core/apis/account';
import { IS_IOS } from '@/core/native/utils';
import {
  cleanSpecialSoloWeightFont,
  RoundedFontStyles,
} from '@/core/utils/fonts';
import type { BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import { zCreate } from '@/core/utils/reexports';
import type { UpdaterOrPartials } from '@/core/utils/store';
import {
  makeAvoidParallelAsyncFunc,
  resolveValFromUpdater,
} from '@/core/utils/store';
import { RefLikeObject } from '@/utils/type';
import { perfEvents } from '@/core/utils/perf';
import type { CollapsibleRef } from 'react-native-collapsible-tab-view';
import { autoLockEvent } from '@/core/apis/autoLock';
import { notificationEvents } from '@/core/notifications/data';
import {
  prepareTxHistoryDisplayUIData,
  txResultToToHistoryDisplayItem,
} from '@/utils/transaction';
// import { SampleNotifiedTxResult } from '@/core/notifications/sample-data';
import { bindKeyringEventAfterRegistration } from '@/core/serviceApi/keyring';
import { getPinnedTokenSnapshot } from '@/core/serviceApi/preference';
import {
  getTransactionHistoryCustomTxItemMap,
  getTransactionHistoryTransactions,
} from '@/core/serviceApi/transactionHistory';
import { browserApis } from './browser/useBrowser';
import { notificationOpenapi } from '@/core/notifications/openapi';
import { toast, toastLoading } from '@/components2024/Toast';
import i18next from 'i18next';
import { switchSceneCurrentAccount } from './accountsSwitcher';
import { findMyAccountByOwnerAddress } from '@/core/notifications/utils';
import { makeMutable, runOnJS } from 'react-native-reanimated';
import PQueue from 'p-queue';
import { resolveWalletEntryDestination } from '@/core/utils/walletEntryState';
import { createAutoUnlockGate } from '@/utils/autoUnlockGate';

type NavigationInstance =
  | NativeStackScreenProps<RootStackParamsList>['navigation']
  | NavigationContainerRef<RootStackParamsList>;

type NavigationRouteStore = {
  currentRouteName: AppRootName | string | undefined;
};
const navigationRouteStore = zCreate<NavigationRouteStore>(() => ({
  currentRouteName: undefined,
}));
function setCurrentRouteName(
  valOrFunc: UpdaterOrPartials<NavigationRouteStore['currentRouteName']>,
) {
  navigationRouteStore.setState(prev => {
    const { newVal, changed } = resolveValFromUpdater(
      prev.currentRouteName,
      valOrFunc,
    );

    if (changed) return { ...prev, currentRouteName: newVal };

    return prev;
  });
}
perfEvents.addListener('EVENT_ROUTE_CHANGE', ({ currentRouteName }) => {
  setCurrentRouteName(currentRouteName as AppRootName | string | undefined);
});

autoLockEvent.addListener('timeout', ctx => {
  const routeName = navigationRouteStore.getState().currentRouteName;

  const atUnlock = routeName === RootNames.Unlock;
  if (atUnlock) {
    ctx.delayLock();
  } else {
    requestExpireUnlockSessionAndBackToUnlockScreen();
  }
});

export function useCurrentRouteName() {
  return {
    currentRouteName: navigationRouteStore(s => s.currentRouteName),
  };
}

const hitSlop = {
  top: 10,
  bottom: 10,
  left: 10,
  right: 10,
};

export function navBack() {
  const navigation = navigationRef.current;
  if (navigation?.canGoBack()) {
    navigation.goBack();
  } else {
    navigationRef.resetRoot({
      index: 0,
      routes: [{ name: RootNames.Home }],
    });
  }
}

/**
 * Header back control with no baked-in layout compensation.
 *
 * Renders a plain 24x24 icon box, so whoever renders the header row owns every
 * inset explicitly. Screens that draw their own header (`header: () => ...`)
 * must use this instead of the deprecated `HeaderBackPressable`, otherwise the
 * compensation margin below silently shrinks the leading slot and pulls centred
 * sibling content off the screen centre (QA 1344).
 *
 * Where the compensation came from: `HeaderBackPressable` was written for
 * controls hosted by a native header element, where iOS 26 +
 * react-native-screens stop applying the system bar-item inset (#1283). It
 * compensates from the inside (`marginLeft: -16` + `paddingLeft: 16`), which is
 * only correct while the host supplies that same 16pt leading inset. In a JS
 * header the negative margin has no such inset to cancel: the slot collapses
 * from 24pt to 8pt and everything after it shifts.
 *
 * If this control is ever dropped into a host that does (or does not) provide a
 * bar-item inset, compensate at the call site - pass `style` (a
 * `marginLeft`/`paddingLeft`) or wrap it in a sized slot - and never re-add the
 * inset inside the component itself.
 */
export function HeaderBackButton({
  tintColor,
  style,
  hitSlop: hitSlopProp,
  ...touchableProps
}: Pick<NativeStackHeaderLeftProps, 'tintColor'> &
  RNViewProps & { hitSlop?: typeof hitSlop }) {
  const themeMode = useGetBinaryMode();
  const { colors2024 } = apisTheme.getColors2024(themeMode);
  return (
    <CustomTouchableOpacity
      // Native-stack header controls need native gesture arbitration on Fabric.
      as="RNGHTouchableOpacity"
      {...touchableProps}
      style={[styles.headerBackButtonStyle, style]}
      hitSlop={hitSlopProp ?? hitSlop}
      onPress={navBack}>
      <RcIconHeaderBack
        width={24}
        height={24}
        color={tintColor || colors2024['neutral-body']}
      />
    </CustomTouchableOpacity>
  );
}

/**
 * @deprecated Bakes a native-bar-item inset compensation into the control
 * (`marginLeft: -16` + `paddingLeft: 16`). Kept only for controls hosted by a
 * native header element (Android `headerLeft`). Any screen that renders its own
 * header row must use `HeaderBackButton` and apply its own container/padding.
 */
export function HeaderBackPressable({
  tintColor,
  style,
  ...touchableProps
}: Pick<NativeStackHeaderLeftProps, 'tintColor'> & RNViewProps) {
  const themeMode = useGetBinaryMode();
  const { colors2024 } = apisTheme.getColors2024(themeMode);
  return (
    <CustomTouchableOpacity
      // Native-stack header controls need native gesture arbitration on Fabric.
      as="RNGHTouchableOpacity"
      {...touchableProps}
      style={[styles.backButtonStyle, style]}
      hitSlop={hitSlop}
      onPress={navBack}>
      <RcIconHeaderBack
        width={24}
        height={24}
        color={tintColor || colors2024['neutral-body']}
      />
    </CustomTouchableOpacity>
  );
}

type ScreenOptions = Omit<NativeStackNavigationOptions, 'headerTitleStyle'> & {
  headerTitleStyle: NativeStackNavigationOptions['headerTitleStyle'] & object;
};

const IOS_LIQUID_GLASS_HEADER_OPTIONS = {
  headerLeftBackgroundVisible: false,
  headerRightBackgroundVisible: false,
} as const;

export const useStackScreenConfig = () => {
  const appThemeMode = useGetBinaryMode();

  /** @deprecated for new screen use mergeScreenOptions2024 instead */
  const mergeScreenOptions = useCallback(
    (...optsList: Partial<ScreenOptions>[]) => {
      const { colors, colors2024 } = apisTheme.getColors2024(appThemeMode);
      const headerPresets = makeHeadersPresets({ colors, colors2024 });

      const screenOptions: ScreenOptions = {
        animation: IS_IOS ? 'slide_from_right' : 'none',
        animationDuration: 200,
        ...IOS_LIQUID_GLASS_HEADER_OPTIONS,
        ...headerPresets.onlyTitle,
        // Native bar button item: UIKit owns the layout (correct on every
        // device) and hidesSharedBackground keeps the iOS 26 glass capsule off.
        unstable_headerLeftItems: IS_IOS ? renderNativeBackItems : undefined,
        headerTitleStyle: {
          ...(headerPresets.onlyTitle.headerTitleStyle as object),
          color: colors['neutral-title-1'],
          fontWeight: '500',
        },
        // headerTintColor: colors['neutral-bg-1'],
        headerTintColor: colors['neutral-title-1'],
        // iOS uses the native bar button item above; Android keeps the custom
        // headerLeft because `onlyTitle` sets headerBackVisible: false and the
        // custom control also provides the navBack fallback on first routes.
        ...(IS_IOS
          ? {}
          : {
              headerLeft: ({ tintColor }: { tintColor?: string }) => (
                <CustomTouchableOpacity
                  as="RNGHTouchableOpacity"
                  style={styles.backButtonStyle}
                  hitSlop={24}
                  onPress={navBack}>
                  <RcIconHeaderBack
                    width={24}
                    height={24}
                    color={tintColor || colors['neutral-body']}
                  />
                </CustomTouchableOpacity>
              ),
            }),
      };

      const result = merge(
        {},
        screenOptions,
        ...optsList.map(x => ({ ...x })),
      ) as ScreenOptions;

      result.headerTitleStyle =
        cleanSpecialSoloWeightFont(result.headerTitleStyle) ||
        result.headerTitleStyle;

      return result;
    },
    [appThemeMode],
  );

  const mergeScreenOptions2024 = useCallback(
    (optsList: Partial<ScreenOptions>[], options?: any) => {
      const { colors, colors2024 } = apisTheme.getColors2024(appThemeMode);
      const headerPresets = makeHeadersPresets({ colors, colors2024 });

      const screenOptions: ScreenOptions = {
        animation: IS_IOS ? 'slide_from_right' : 'none',
        animationDuration: 200,
        ...IOS_LIQUID_GLASS_HEADER_OPTIONS,
        ...headerPresets.onlyTitle,
        unstable_headerLeftItems: IS_IOS ? renderNativeBackItems : undefined,
        headerTitleStyle: {
          ...(headerPresets.onlyTitle.headerTitleStyle as object),
          color: colors2024['neutral-title-1'],
          ...RoundedFontStyles.heavy,
          fontSize: 20,
        },
        headerTintColor: colors2024['neutral-title-1'],
        // iOS uses the native bar button item above; Android keeps the custom
        // back control for the same reasons as `mergeScreenOptions`.
        ...(IS_IOS
          ? {}
          : {
              headerLeft: ({ tintColor }: { tintColor?: string }) => (
                <HeaderBackPressable tintColor={tintColor} />
              ),
            }),
      };

      const result = merge(
        {},
        screenOptions,
        ...optsList.map(x => ({ ...x })),
      ) as ScreenOptions;

      result.headerTitleStyle =
        cleanSpecialSoloWeightFont(result.headerTitleStyle) ||
        result.headerTitleStyle;

      return result;
    },
    [appThemeMode],
  );

  return { mergeScreenOptions, mergeScreenOptions2024 };
};

export function useBottomTabScreenConfig() {
  const appThemeMode = useGetBinaryMode();

  const mergeBottomTabOptions2024 = useCallback(
    (optsList: Partial<BottomTabNavigationOptions>[] = [], options?: any) => {
      const { colors, colors2024 } = apisTheme.getColors2024(appThemeMode);
      const headerPresets = makeHeadersPresets({ colors, colors2024 });

      const bottomTabOptions: BottomTabNavigationOptions = {
        headerTitleAlign: 'center',
        headerStyle: {
          backgroundColor: 'transparent',
        },
        headerTransparent: true,
        headerTitleStyle: {
          ...(headerPresets.onlyTitle.headerTitleStyle as object),
          color: colors2024['neutral-title-1'],
          ...RoundedFontStyles.heavy,
          fontSize: 20,
        },
        headerTintColor: colors2024['neutral-title-1'],
        headerLeft: ({ tintColor }) => (
          <HeaderBackPressable tintColor={tintColor} />
        ),
      };

      const result = merge(
        {},
        bottomTabOptions,
        ...optsList.map(x => ({ ...x })),
      ) as BottomTabNavigationOptions;

      result.headerTitleStyle =
        cleanSpecialSoloWeightFont(result.headerTitleStyle as any) ||
        result.headerTitleStyle;

      return result;
    },
    [appThemeMode],
  );

  return { mergeBottomTabOptions2024 };
}

// NOTE: `unstable_headerLeftItems` is the native-stack bridge to RNScreens'
// `headerLeftBarButtonItems`. It gives UIKit ownership of the bar item layout
// (correct on every device) and lets us pass `hidesSharedBackground` to drop the
// iOS 26 glass capsule. Re-check this prop name on every @react-navigation
// upgrade; if it is renamed/removed, fall back to a custom headerLeft with a
// device-independent layout rather than a fixed offset.
// The native bar item's leading inset matches the custom header's (16pt), so
// the only difference was the SF Symbol's own optical padding: it pushed the
// glyph ~8pt right of the app icon. Use the same 24pt chevron artwork as the
// JS header so both paths render at the same x on every device.
const renderNativeBackItems: NonNullable<
  NativeStackNavigationOptions['unstable_headerLeftItems']
> = ({ tintColor }) => {
  // iOS 26 hands the native bar item a ~6pt smaller leading inset than iOS 27
  // (16pt vs 22pt), so the same artwork lands left of the JS header pages on
  // iOS 26 (QA 1360: iPhone 15 / iOS 26.5). Pad the artwork by that delta on
  // iOS 26 only; iOS 27 keeps the original 44pt canvas.
  const isIOS26 = Platform.OS === 'ios' && Platform.Version < 27;

  return [
    {
      type: 'button',
      label: '',
      // A 44x24 image (chevron drawn in the leading 24pt) keeps the standard
      // 44pt tap target while making the glyph start at the item's leading edge,
      // which is the same 16pt inset the JS header used. No offset needed.
      // Keep the PNG alpha anti-aliased: a hard 0/255 alpha export makes UIKit
      // render the diagonal stroke with visible stair-steps (QA 1359).
      icon: {
        type: 'xcasset',
        name: isIOS26 ? 'HeaderBackChevronIOS26' : 'HeaderBackChevron',
      },
      width: isIOS26 ? 50 : 44,
      tintColor,
      hidesSharedBackground: true,
      onPress: navBack,
    },
  ];
};

const styles = StyleSheet.create({
  // Plain icon box for JS-rendered custom headers; the caller aligns it.
  headerBackButtonStyle: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonStyle: {
    // width: 56,
    // height: 56,
    alignItems: 'center',
    flexDirection: 'row',
    marginLeft: -16,
    paddingLeft: 16,
  },
});

export function useRabbyAppNavigation<
  K extends NativeStackScreenProps<RootStackParamsList>['navigation'],
>() {
  return useNavigation<K>();
}

const tabIndexStore = zCreate<{ tabIndex: number }>(() => ({ tabIndex: 0 }));
export function useHomeTabIndex() {
  const tabIndex = tabIndexStore(s => s.tabIndex);

  return {
    tabIndex,
    setTabIndex: apisHomeTabIndex.setTabIndex,
  };
}

export const enum HomeTabName {
  overview = 'overview',
  token = 'token',
  defi = 'defi',
  nft = 'nft',
}
export const TabbarLabels: {
  [P in HomeTabName]: {
    index: number;
    label: string;
  };
} = {
  [HomeTabName.overview]: { index: 0, label: '' },
  [HomeTabName.token]: { index: 1, label: 'Token' },
  [HomeTabName.defi]: { index: 2, label: 'DeFi' },
  [HomeTabName.nft]: { index: 3, label: 'NFT' },
};
const homeTabScrollerRef = React.createRef<CollapsibleRef<string>>();
// const tabIndexRef: RefLikeObject<number> = { current: 0 };
const tabIndexSvs = {
  current: 0,
  svIndexDecimal: makeMutable(0),
  svTabName: makeMutable(HomeTabName.overview),
};
export const apisHomeTabIndex = {
  get homeTabScrollerRef() {
    return homeTabScrollerRef;
  },
  // get tabIndex() {
  //   return svTabIndexDecimal.value;
  // },
  get svTabIndexDecimal() {
    return tabIndexSvs.svIndexDecimal;
  },
  get svTabName() {
    return tabIndexSvs.svTabName;
  },
  onTabSvsChange: (val: number, tabName?: HomeTabName) => {
    'worklet';
    tabIndexSvs.svIndexDecimal.value = val;
    tabIndexSvs.current = Math.floor(val);
    if (tabName) {
      tabIndexSvs.svTabName.value = tabName;
    }
  },
  isHomeAtFirstTab() {
    return tabIndexSvs.svIndexDecimal.value === 0;
  },
  setTabIndex(val: number, processJump = false) {
    'worklet';
    if (processJump) {
      homeTabScrollerRef.current?.setIndex(val);
    } else {
      tabIndexSvs.svIndexDecimal.value = val;
      tabIndexSvs.current = val;
      runOnJS(() => tabIndexStore.setState({ tabIndex: val }))();
    }
  },
};

export function resetNavigationTo(
  navigation: NavigationInstance,
  type: 'Home' | 'Unlock' | 'GetStarted' = 'Home',
) {
  switch (type) {
    default:
    case 'Home': {
      navigation.reset({
        index: 0,
        routes: [
          {
            name: RootNames.StackRoot,
            params: {
              screen: RootNames.Home,
            },
          },
        ],
      });
      apisHomeTabIndex.setTabIndex(0);
      break;
    }
    case 'Unlock': {
      perfEvents.emit('GLOBAL_CLEAR_ALL_COVERED_COMPONENTS');
      navigation.reset({
        index: 0,
        routes: [
          {
            name: RootNames.Unlock,
            params: {
              disableAutoTriggerUnlock: true,
            },
          },
        ],
      });
      unlockUIState.finishedUnlockResetNav = false;
      // if (
      //   getLatestNavigationName() === RootNames.BrowserScreen ||
      //   getLatestNavigationName() === RootNames.BrowserManageScreen
      // ) {
      //   navigation.dispatch(TabActions.jumpTo(RootNames.StackMain));
      // }

      break;
    }
    case 'GetStarted': {
      navigation.reset({
        index: 0,
        routes: [
          {
            name: RootNames.StackGetStarted,
            params: {
              screen: RootNames.GetStarted,
            },
          },
        ],
      });
      break;
    }
  }
}

export const resetNavigationOnTopOfHome: typeof naviReplace = (
  stack,
  params?,
) => {
  const navigation = getReadyNavigationInstance();
  if (!navigation) return;

  navigation.reset({
    index: 0,
    routes: [
      {
        name: RootNames.StackRoot,
        params: {
          screen: RootNames.Home,
        },
      },
      {
        name: stack,
        params: params || {},
      },
    ],
  });
  apisHomeTabIndex.setTabIndex(0);
};

export const requestLockWallet = makeAvoidParallelAsyncFunc(async () => {
  const lockInfo = await apisLock.getRabbyLockInfo();
  const result = { canLockWallet: false };
  if (!lockInfo.isUseCustomPwd) return result;

  const isUnlocked = apisLock.isUnlocked();
  if (isUnlocked) {
    result.canLockWallet = true;
    await apisLock.lockWallet();
  }

  return result;
});

export const requestLockWalletAndBackToUnlockScreen =
  makeAvoidParallelAsyncFunc(async () => {
    const lockInfo = await apisLock.getRabbyLockInfo();
    const result = { canLockWallet: false };
    if (!lockInfo.isUseCustomPwd) return result;

    if (apisLock.isUnlocked()) {
      result.canLockWallet = true;
      await apisLock.lockWallet();
    } else {
      result.canLockWallet = true;
      apisLock.clearUnlockTime();
    }

    console.debug('will back to unlock screen');
    const navigation = getReadyNavigationInstance();
    if (navigation) resetNavigationTo(navigation, 'Unlock');

    return result;
  });

export const requestExpireUnlockSessionAndBackToUnlockScreen =
  makeAvoidParallelAsyncFunc(async () => {
    const lockInfo = await apisLock.getRabbyLockInfo();
    const result = { canLockWallet: false };
    if (!lockInfo.isUseCustomPwd) return result;

    if (apisLock.isUnlocked()) {
      result.canLockWallet = true;
      await apisLock.lockWallet();
    } else {
      apisLock.clearUnlockTime();
    }

    console.debug('will expire unlock session and back to unlock screen');
    const navigation = getReadyNavigationInstance();
    if (navigation) resetNavigationTo(navigation, 'Unlock');

    return result;
  });

export const requestLockWalletAndBackToHomeScreen = makeAvoidParallelAsyncFunc(
  async () => {
    const result = await requestLockWallet();
    if (!result.canLockWallet) return result;

    console.debug('will back to home screen');
    const navigation = getReadyNavigationInstance();
    if (navigation) {
      const hasAccountsInKeyring = await apisAccount.hasVisibleAccounts();
      resetNavigationTo(
        navigation,
        hasAccountsInKeyring ? 'Home' : 'GetStarted',
      );
    }

    return result;
  },
);

type ResetNaviOnUIUnlockFn = (ctx: {
  navigation: NavigationInstance;
  hasUnlockOnce: boolean;
  /**
   * @description if not provided, means default action has been taken
   * @returns
   */
  defaultAction?: () => void;
}) => Promise<void> | void;

const unlockUIState = {
  unlockOnceRef: false,
  finishedUnlockResetNav: false,
  resetNaviOnTopOfHomeWhenUnlockRef: null as null | ResetNaviOnUIUnlockFn,
};
const autoUnlockGate = createAutoUnlockGate({
  isAtUnlock: () =>
    navigationRouteStore.getState().currentRouteName === RootNames.Unlock,
  dispatch: () => perfEvents.emit('AUTO_TRIGGER_UNLOCK'),
});
perfEvents.addListener('EVENT_ROUTE_CHANGE', ({ currentRouteName }) => {
  if (currentRouteName === RootNames.Unlock) {
    autoUnlockGate.dispatchIfReady();
  }
});
bindKeyringEventAfterRegistration('lock', () => {
  unlockUIState.finishedUnlockResetNav = false;
  autoUnlockGate.clearPending();
});
export class UnlockUIManager {
  static triggerAutoUnlock(options?: { bypassPresentationReady?: boolean }) {
    autoUnlockGate.request(options);
  }

  static setAutoUnlockScreenReady(ready: boolean) {
    autoUnlockGate.setScreenReady(ready);
  }

  static setAutoUnlockPresentationReady(ready: boolean) {
    autoUnlockGate.setPresentationReady(ready);
  }

  static markUnlockedOnce() {
    unlockUIState.unlockOnceRef = true;
  }

  static queueResetNaviOnTopOfHomeWhenUnlock(
    fn: ResetNaviOnUIUnlockFn,
    options?: { forceWaitUnlock?: boolean },
  ) {
    const navigation = getReadyNavigationInstance();
    if (!navigation) return;

    // previous reset nav has been processed, do it immediately
    if (unlockUIState.finishedUnlockResetNav && !options?.forceWaitUnlock) {
      fn({
        navigation,
        hasUnlockOnce: unlockUIState.unlockOnceRef,
      });
      return;
    } else {
      unlockUIState.resetNaviOnTopOfHomeWhenUnlockRef = async ctx => {
        const ret = await fn(ctx);
        unlockUIState.finishedUnlockResetNav = true;
        unlockUIState.resetNaviOnTopOfHomeWhenUnlockRef = null;
        return ret;
      };
    }
  }

  static clearQueuedResetNaviOnTopOfHomeWhenUnlock() {
    unlockUIState.resetNaviOnTopOfHomeWhenUnlockRef = null;
  }

  static async resetNavOnUIUnlock() {
    const navigation = getReadyNavigationInstance();
    if (!navigation) return;

    const hasUnlockOnce = unlockUIState.unlockOnceRef;
    const defaultAction = async () => {
      if (
        unlockUIState.finishedUnlockResetNav ||
        navigationRouteStore.getState().currentRouteName !== RootNames.Unlock
      )
        return;
      let hasVisibleAccounts: boolean | null = null;
      try {
        hasVisibleAccounts = await apisAccount.hasVisibleAccounts();
      } catch (error) {
        console.error(
          'UnlockUIManager.resetNavOnUIUnlock::account-check-error',
          error,
        );
      }
      const destination = resolveWalletEntryDestination({
        accountState:
          hasVisibleAccounts === null
            ? 'unknown'
            : hasVisibleAccounts
            ? 'available'
            : 'empty',
        isAppUnlocked: true,
        isUnlockSessionValid: true,
      });
      resetNavigationTo(navigation, destination || 'Home');
      unlockUIState.finishedUnlockResetNav = true;
    };
    if (unlockUIState.resetNaviOnTopOfHomeWhenUnlockRef) {
      await unlockUIState.resetNaviOnTopOfHomeWhenUnlockRef({
        navigation,
        hasUnlockOnce,
        defaultAction,
      });
    } else {
      await defaultAction();
    }
  }
}

export function usePreventGoBack({
  navigation,
  shouldGoback,
}: {
  navigation?: ReturnType<typeof useRabbyAppNavigation>;
  shouldGoback: (() => boolean) | React.RefObject<boolean | null>;
}) {
  const shouldPreventFn = useCallback(() => {
    if (typeof shouldGoback === 'function') {
      return !shouldGoback();
    }

    return !shouldGoback.current;
  }, [shouldGoback]);

  const registerPreventEffect = useCallback(() => {
    if (!navigation) return;

    const listener: Parameters<
      typeof navigation.addListener<'beforeRemove'>
    >[1] = e => {
      if (shouldPreventFn()) {
        // Prevent default behavior of leaving the screen
        e.preventDefault();

        return false;
      }
    };

    navigation.addListener('beforeRemove', listener);

    return () => {
      navigation.removeListener('beforeRemove', listener);
    };
  }, [navigation, shouldPreventFn]);

  return {
    registerPreventEffect,
  };
}

export function startSubscribeRemoteNotification() {
  if (!APP_FEATURE_SWITCH.transactionNotification) {
    return;
  }

  function earlyReturnL1<T = any>(retValue?: T) {
    return retValue;
  }

  const notificationProcessQueue = new PQueue({ concurrency: 1 });

  const canOpenNotificationTransaction = () =>
    apisLock.isUnlocked() || apisLock.isUnlockSessionValid();

  notificationEvents.subscribe(
    'onParsedReceivedData',
    async ({ parsedData }) => {
      console.debug(
        '[notifications] [startSubscribeRemoteNotification] onParsedReceivedData:: parsedData',
        parsedData,
      );

      notificationProcessQueue.add(async () => {
        console.debug(
          '[notifications] [startSubscribeRemoteNotification] queue start processing parsedData',
          parsedData,
        );

        const ownerAddress = parsedData.txInfo?.ownerAddress;
        if (!ownerAddress) {
          toast.info(i18next.t('notifications.unknownAddressFromTransaction'), {
            duration: 8 * 1000,
            hideOnPress: true,
          });
          return earlyReturnL1();
        }

        const txDetailPromise = notificationOpenapi
          .getUserTxDetail({
            chainId: parsedData.txInfo?.chainServerId || '',
            txId: parsedData.txInfo?.txHash || '',
            userAddr: ownerAddress || '',
          })
          .catch(error => {
            console.debug(
              '[notifications] [startSubscribeRemoteNotification] Failed to get tx detail:',
            );
            console.error(error);
            return null;
          });

        const openNotificationTransaction = async (ctx?: {
          defaultAction?: () => void;
        }) => {
          const foundAccount = await findMyAccountByOwnerAddress(ownerAddress);
          const hideToastRef = {
            current: toastLoading(
              i18next.t('notifications.loadingTransaction'),
              {
                duration: 3 * 1000,
              },
            ),
          };

          const earlyReturn = (shouldExecuteDefaultAction = false) => {
            earlyReturnL1();
            hideToastRef.current();
            if (shouldExecuteDefaultAction) {
              ctx?.defaultAction?.();
            }
          };

          if (!foundAccount) {
            console.debug(
              '[notifications] [startSubscribeRemoteNotification] No matched account found for ownerAddress:',
              ownerAddress,
            );
            toast.error(i18next.t('notifications.noTransactionOwnerAddress'), {
              duration: 8 * 1000,
              hideOnPress: true,
            });
            return earlyReturn(true);
          }

          const txDetail = await txDetailPromise;

          console.debug('[notifications] txDetail', txDetail);

          if (!txDetail) {
            const warnMsg = `[notifications] [startSubscribeRemoteNotification] No tx detail found for txHash: ${parsedData.txInfo?.txHash} on chainId: ${parsedData.txInfo?.chainServerId}`;
            console.warn(warnMsg);

            const currentRouteName =
              navigationRouteStore.getState().currentRouteName;
            const needReplace = currentRouteName === RootNames.History;
            const naviFn = needReplace ? naviReplace : naviPush;

            await switchSceneCurrentAccount('History', foundAccount);
            hideToastRef.current();
            naviFn(RootNames.StackTransaction, {
              screen: RootNames.History,
              params: {
                isForMultipleAddress: false,
              },
            });

            return earlyReturn(false);
          }

          hideToastRef.current();

          const pinedQueue = getPinnedTokenSnapshot();
          const [customTxItemsMap, transactions] = await Promise.all([
            getTransactionHistoryCustomTxItemMap(),
            getTransactionHistoryTransactions(),
          ]);
          const historyDisplayItem = txResultToToHistoryDisplayItem({
            address: parsedData.txInfo?.ownerAddress || '',
            res: txDetail,
            pinedQueue,
            customTxItemsMap,
            transactions,
          })[0];
          console.debug(
            '[notifications] [startSubscribeRemoteNotification] received parsedData',
            historyDisplayItem,
          );
          if (!historyDisplayItem) {
            toast.show(i18next.t('notifications.noTransactionDetail'), {
              duration: 8 * 1000,
              hideOnPress: true,
            });
            return earlyReturn(true);
          }
          earlyReturn(false);

          const currentRouteName =
            navigationRouteStore.getState().currentRouteName;
          const needReplace = currentRouteName === RootNames.HistoryDetail;

          const naviFn = needReplace ? naviReplace : naviPush;
          naviFn(RootNames.StackTransaction, {
            screen: RootNames.HistoryDetail,
            params: {
              isForMultipleAddress: false,
              data: historyDisplayItem,
              title:
                prepareTxHistoryDisplayUIData(historyDisplayItem).formatTitle,
              treatSmallAssetsAsScam: false,
            },
          });

          perfEvents.emit('GLOBAL_CLEAR_ALL_COVERED_COMPONENTS');
        };

        if (canOpenNotificationTransaction()) {
          await openNotificationTransaction();
          return earlyReturnL1();
        }

        UnlockUIManager.queueResetNaviOnTopOfHomeWhenUnlock(
          ctx =>
            openNotificationTransaction({
              defaultAction: ctx.defaultAction,
            }),
          { forceWaitUnlock: true },
        );
        await requestExpireUnlockSessionAndBackToUnlockScreen();
        UnlockUIManager.triggerAutoUnlock();
        return earlyReturnL1();
      });
    },
  );
}
