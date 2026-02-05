import React, { useCallback, useEffect, useMemo } from 'react';
import { Alert, AppState, StyleSheet } from 'react-native';
import { get, merge } from 'lodash';

import {
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
import { AppRootName, RootNames, makeHeadersPresets } from '@/constant/layout';
import {
  NavigationContainerRef,
  useNavigation,
} from '@react-navigation/native';

import type { RootStackParamsList } from '@/navigation-type';
import { setIOSScreenCapture } from './native/security';
import RNScreenshotPrevent from '@/core/native/RNScreenshotPrevent';
import { apisAccount, apisLock } from '@/core/apis';
import { IS_IOS } from '@/core/native/utils';
import {
  atSensitiveSceneState,
  bottomSheetModalSecurityApis,
} from '@/components2024/GlobalBottomSheetModal/security';
import { getExpScreenCapture, useExpScreenCapture } from './appSettings';
import { cleanSpecialSoloWeightFont } from '@/core/utils/fonts';
import { BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import { zCreate } from '@/core/utils/reexports';
import { resolveValFromUpdater, UpdaterOrPartials } from '@/core/utils/store';
import { RefLikeObject } from '@/utils/type';
import { perfEvents } from '@/core/utils/perf';
import { useShallow } from 'zustand/react/shallow';
import { CollapsibleRef } from 'react-native-collapsible-tab-view';
import { autoLockEvent } from '@/core/apis/autoLock';
import { notificationEvents } from '@/core/notifications/data';
import {
  prepareTxHistoryDisplayUIData,
  txResultToToHistoryDisplayItem,
} from '@/utils/transaction';
// import { SampleNotifiedTxResult } from '@/core/notifications/sample-data';
import { preferenceService, transactionHistoryService } from '@/core/services';
import { browserApis } from './browser/useBrowser';
import { notificationOpenapi } from '@/core/notifications/openapi';
import { toast, toastLoading } from '@/components2024/Toast';
import i18next from 'i18next';
import { switchSceneCurrentAccount } from './accountsSwitcher';
import { findMyAccountByOwnerAddress } from '@/core/notifications/utils';

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
  if (!atUnlock) {
    requestLockWalletAndBackToUnlockScreen();
  } else {
    ctx.delayLock();
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

export function HeaderBackPressable({
  style,
  ...props
}: Pick<NativeStackHeaderLeftProps, 'tintColor'> & RNViewProps) {
  const themeMode = useGetBinaryMode();
  const { colors2024 } = apisTheme.getColors2024(themeMode);
  return (
    <CustomTouchableOpacity
      style={[styles.backButtonStyle, style]}
      hitSlop={hitSlop}
      onPress={navBack}>
      <RcIconHeaderBack
        width={24}
        height={24}
        color={props.tintColor || colors2024['neutral-body']}
      />
    </CustomTouchableOpacity>
  );
}

type ScreenOptions = Omit<NativeStackNavigationOptions, 'headerTitleStyle'> & {
  headerTitleStyle: NativeStackNavigationOptions['headerTitleStyle'] & object;
};
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
        ...headerPresets.onlyTitle,
        headerTitleStyle: {
          ...(headerPresets.onlyTitle.headerTitleStyle as object),
          color: colors['neutral-title-1'],
          fontWeight: '500',
        },
        // headerTintColor: colors['neutral-bg-1'],
        headerTintColor: colors['neutral-title-1'],
        headerLeft: ({ tintColor }) => (
          <CustomTouchableOpacity
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
        ...headerPresets.onlyTitle,
        headerTitleStyle: {
          ...(headerPresets.onlyTitle.headerTitleStyle as object),
          color: colors2024['neutral-title-1'],
          fontWeight: '900',
          fontFamily: 'SF Pro Rounded',
          fontSize: 20,
        },
        headerTintColor: colors2024['neutral-title-1'],
        headerLeft: ({ tintColor }) => (
          <HeaderBackPressable tintColor={tintColor} />
        ),
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
          fontWeight: '800',
          fontFamily: 'SF Pro Rounded',
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

const styles = StyleSheet.create({
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
const homeTabScrollerRef = React.createRef<CollapsibleRef<string>>();
const tabIndexRef: RefLikeObject<number> = { current: 0 };
export const apisHomeTabIndex = {
  get homeTabScrollerRef() {
    return homeTabScrollerRef;
  },
  get tabIndex() {
    return tabIndexRef.current;
  },
  isHomeAtFirstTab() {
    return tabIndexRef.current === 0;
  },
  setTabIndex(val: number, processJump = false) {
    tabIndexRef.current = val;
    tabIndexStore.setState({ tabIndex: val });

    if (processJump) {
      homeTabScrollerRef.current?.setIndex(val);
    }
  },
};

export function resetNavigationTo(
  navigation: NavigationInstance,
  type: 'Home' | 'Unlock' | 'GetStartedScreen2024' = 'Home',
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
      navigation.reset({
        index: 0,
        routes: [{ name: RootNames.Unlock, params: {} }],
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
    case 'GetStartedScreen2024': {
      navigation.reset({
        index: 0,
        routes: [
          {
            name: RootNames.StackGetStarted,
            params: {
              screen: RootNames.GetStartedScreen2024,
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

export async function requestLockWalletAndBackToUnlockScreen(): Promise<{
  canLockWallet: boolean;
}> {
  const lockInfo = await apisLock.getRabbyLockInfo();
  const result = { canLockWallet: false };
  if (!lockInfo.isUseCustomPwd) return result;

  const isUnlocked = apisLock.isUnlocked();
  if (isUnlocked) {
    result.canLockWallet = true;
    await apisLock.lockWallet();
  }

  console.debug('will back to unlock screen');
  const navigation = getReadyNavigationInstance();
  if (navigation) resetNavigationTo(navigation, 'Unlock');

  return result;
}

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
// keyringService.addListener('lock', () => {
//   unlockUIState.finishedUnlockResetNav = false;
// });
export class UnlockUIManager {
  static markUnlockedOnce() {
    unlockUIState.unlockOnceRef = true;
  }

  static queueResetNaviOnTopOfHomeWhenUnlock(fn: ResetNaviOnUIUnlockFn) {
    const navigation = getReadyNavigationInstance();
    if (!navigation) return;

    // previous reset nav has been processed, do it immediately
    if (unlockUIState.finishedUnlockResetNav) {
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

  static async resetNavOnUIUnlock() {
    const navigation = getReadyNavigationInstance();
    if (!navigation) return;

    const hasUnlockOnce = unlockUIState.unlockOnceRef;
    const defaultAction = async () => {
      const hasAccountsInKeyring = await apisAccount.hasVisibleAccounts();

      resetNavigationTo(
        navigation,
        !hasAccountsInKeyring && !hasUnlockOnce
          ? RootNames.GetStartedScreen2024
          : RootNames.Home,
      );
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
  shouldGoback: (() => boolean) | React.RefObject<boolean>;
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

export const enum ProtectType {
  NONE = 0,
  SafeTipModal = 1,
}

export type ProtectedConf = {
  iosBlurType: ProtectType | null;
  // alertOnScreenShot?: {
  //   title: string;
  //   message: string;
  // };
  warningScreenshotBackup: boolean;
  onOk?: (ctx: { navigation?: NavigationInstance | null }) => void;
};
const defaultOnOk = ctx => {
  ctx.navigation?.goBack();
};
const defaultProtectedConf: ProtectedConf = {
  iosBlurType: ProtectType.NONE,
  onOk: defaultOnOk,
  warningScreenshotBackup: false,
};
function getProtectedConf() {
  return {
    ...defaultProtectedConf,
    warningScreenshotBackup: true,
    iosBlurType: ProtectType.SafeTipModal,
  };
}

const PROTECTED_SCREENS: {
  [P in AppRootName]?: ProtectedConf;
} = {
  [RootNames.CreateMnemonic]: getProtectedConf(),
  [RootNames.ImportMnemonic]: getProtectedConf(),
  [RootNames.ImportPrivateKey]: getProtectedConf(),
  [RootNames.ImportMnemonic2024]: getProtectedConf(),
  [RootNames.ImportPrivateKey2024]: getProtectedConf(),
  [RootNames.CreateMnemonicBackup]: getProtectedConf(),
  [RootNames.CreateMnemonicVerify]: getProtectedConf(),
  [RootNames.BackupPrivateKey]: getProtectedConf(),
};

function getAtSensitiveScreenInfo(routeName: string | undefined) {
  const result = {
    // $routeName: routeName,
    $protectedConf: { ...defaultProtectedConf },
    _atSensitiveScreen: false,
  };

  if (!routeName || !PROTECTED_SCREENS[routeName]) return result;

  result.$protectedConf = {
    ...defaultProtectedConf,
    ...PROTECTED_SCREENS[routeName],
  };

  result._atSensitiveScreen = !!PROTECTED_SCREENS[routeName];

  return result;
}

type AtSensitiveScreenInfo = ReturnType<typeof getAtSensitiveScreenInfo>;
type AtSensitiveScreenState = {
  anySensitiveModalOpened: boolean;
  screenInfo: AtSensitiveScreenInfo;
};
const atSensitiveScreenStore = zCreate<AtSensitiveScreenState>(() => ({
  anySensitiveModalOpened: false,
  screenInfo: getAtSensitiveScreenInfo(undefined),
}));

function setAtSensitiveScreenInfo(
  valOrFunc: UpdaterOrPartials<AtSensitiveScreenInfo>,
) {
  atSensitiveScreenStore.setState(prev => {
    const { newVal, changed } = resolveValFromUpdater(
      prev.screenInfo,
      valOrFunc,
      {
        strict: true,
      },
    );

    if (!changed) return prev;

    return { ...prev, screenInfo: newVal };
  });
}

perfEvents.addListener('EVENT_ROUTE_CHANGE', ({ currentRouteName }) => {
  setAtSensitiveScreenInfo(getAtSensitiveScreenInfo(currentRouteName));
});

atSensitiveSceneState.subscribe(s => {
  const anySensitiveModalOpened =
    bottomSheetModalSecurityApis.isAnySensitiveModalOpened(s);

  atSensitiveScreenStore.setState(prev => {
    if (prev.anySensitiveModalOpened === anySensitiveModalOpened) {
      return prev;
    }
    return {
      ...prev,
      anySensitiveModalOpened,
    };
  });
});

export function useAtSensitiveScene() {
  return atSensitiveScreenStore(useShallow(s => getAtSensitiveScene(s)));
}

export function getAtSensitiveScene(s = atSensitiveScreenStore.getState()) {
  const srnInfo = s.screenInfo;
  const anySensitiveModalOpened = s.anySensitiveModalOpened;

  return {
    anySensitiveModalOpened,
    atSensitiveScene: srnInfo._atSensitiveScreen || anySensitiveModalOpened,
    iosBlurType: srnInfo.$protectedConf.iosBlurType,
    warningScreenshotBackup: srnInfo.$protectedConf.warningScreenshotBackup,
    onOk: srnInfo.$protectedConf.onOk,
  };
}

export function startSubscribeAtSensitiveScene() {
  atSensitiveScreenStore.subscribe(s => {
    const shouldPreventScreenCapturing =
      getAtSensitiveScene(s).atSensitiveScene &&
      !getExpScreenCapture().forceAllowScreenshot;

    perfEvents.emit('CHANGE_PREVENT_SCREENSHOT', shouldPreventScreenCapturing);
  });
}

export function startSubscribeIOSJustScreenshotted() {
  const subscription = RNScreenshotPrevent.onUserDidTakeScreenshot(() => {
    const setScreenshotted = (val?: boolean) =>
      setIOSScreenCapture(prev => ({ ...prev, isScreenshotJustNow: !!val }));

    setScreenshotted(getAtSensitiveScene().warningScreenshotBackup);
  });

  return subscription;
}

export function startSubscribeIOSScreenRecording() {
  if (!IS_IOS && !__DEV__) return;

  const subscription = RNScreenshotPrevent.iosOnScreenCaptureChanged(ctx => {
    setIOSScreenCapture(prev => ({
      ...prev,
      isBeingCaptured: ctx.isBeingCaptured,
    }));

    if (!IS_IOS && !__DEV__) return;
    const atSensitiveInfo = getAtSensitiveScene();
    if (atSensitiveInfo.iosBlurType === ProtectType.SafeTipModal) return;

    const forceAllowScreenshot = getExpScreenCapture().forceAllowScreenshot;
    const shouldPreventScreenCapturing =
      atSensitiveInfo.atSensitiveScene && !forceAllowScreenshot;

    if (ctx.isBeingCaptured && shouldPreventScreenCapturing) {
      RNScreenshotPrevent.iosProtectFromScreenRecording();
    } else {
      RNScreenshotPrevent.iosUnprotectFromScreenRecording();
    }
  });

  return subscription;
}

export function startSubscribeRemoteNotification() {
  notificationEvents.subscribe(
    'onParsedReceivedData',
    async ({ parsedData }) => {
      console.debug(
        '[notifications] [startSubscribeRemoteNotification] onParsedReceivedData:: parsedData',
        parsedData,
      );
      const ownerAddress = parsedData.txInfo?.ownerAddress;
      if (!ownerAddress) return;
      // TODO: check if my own address
      const foundAccount = await findMyAccountByOwnerAddress(ownerAddress);
      if (!foundAccount) {
        console.debug(
          '[notifications] [startSubscribeRemoteNotification] No matched account found for ownerAddress:',
          ownerAddress,
        );
        return;
      }

      console.debug(
        '[notifications] onParsedReceivedData:: parsedData',
        parsedData,
      );
      const txDetailPromise = notificationOpenapi
        .getUserTxDetail({
          chainId: parsedData.txInfo?.chainServerId || '',
          txId: parsedData.txInfo?.txHash || '',
          userAddr: foundAccount.address || '',
        })
        .catch(error => {
          console.debug(
            '[notifications] [startSubscribeRemoteNotification] Failed to get tx detail:',
          );
          console.error(error);
          return null;
        });

      UnlockUIManager.queueResetNaviOnTopOfHomeWhenUnlock(async ctx => {
        let txDetail = null as null | Awaited<typeof txDetailPromise>;
        const hideToastRef = {
          current: toastLoading(i18next.t('notifications.loadingTransaction'), {
            duration: 3 * 1000,
          }),
        };
        txDetail = await txDetailPromise;

        console.debug('[notifications] txDetail', txDetail);

        if (!txDetail) {
          const warnMsg = `[notifications] [startSubscribeRemoteNotification] No tx detail found for txHash: ${parsedData.txInfo?.txHash} on chainId: ${parsedData.txInfo?.chainServerId}`;
          console.warn(warnMsg);

          const currentRouteName =
            navigationRouteStore.getState().currentRouteName;
          const needReplace = currentRouteName === RootNames.History;
          const naviFn = ctx.defaultAction
            ? resetNavigationOnTopOfHome
            : needReplace
            ? naviReplace
            : naviPush;

          await switchSceneCurrentAccount('History', foundAccount);
          hideToastRef.current();
          naviFn(RootNames.StackTransaction, {
            screen: RootNames.History,
            params: {
              isForMultipleAddress: false,
            },
          });

          return;
        }

        hideToastRef.current();

        const pinedQueue = preferenceService.getPinToken();
        const customTxItemsMap = transactionHistoryService.getCustomTxItemMap();
        const historyDisplayItem = txResultToToHistoryDisplayItem({
          address: parsedData.txInfo?.ownerAddress || '',
          res: txDetail,
          pinedQueue,
          customTxItemsMap,
        })[0];
        console.debug(
          '[notifications] [startSubscribeRemoteNotification] received parsedData',
          historyDisplayItem,
        );
        if (!historyDisplayItem) return;

        const currentRouteName =
          navigationRouteStore.getState().currentRouteName;
        const needReplace = currentRouteName === RootNames.HistoryDetail;

        const naviFn = ctx.defaultAction
          ? resetNavigationOnTopOfHome
          : needReplace
          ? naviReplace
          : naviPush;
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
      });
    },
  );
}
