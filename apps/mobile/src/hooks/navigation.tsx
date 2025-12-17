import React, { useCallback, useEffect, useMemo } from 'react';
import { Alert, StyleSheet } from 'react-native';
import { merge } from 'lodash';

import {
  NativeStackNavigationOptions,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import { apisTheme, useGetBinaryMode } from '../hooks/theme';
import { getReadyNavigationInstance, navigationRef } from '@/utils/navigation';
import { CustomTouchableOpacity } from '@/components/CustomTouchableOpacity';

import { default as RcIconHeaderBack } from '@/assets/icons/header/back-cc.svg';
import { AppRootName, RootNames, makeHeadersPresets } from '@/constant/layout';
import {
  NavigationContainerRef,
  useNavigation,
} from '@react-navigation/native';

import type { RootStackParamsList } from '@/navigation-type';
import {
  useIOSScreenRecording,
  useIOSScreenshotted,
  usePreventScreenshot,
} from './native/security';
import RNScreenshotPrevent from '@/core/native/RNScreenshotPrevent';
import { apisLock } from '@/core/apis';
import { IS_IOS } from '@/core/native/utils';
import {
  atSensitiveSceneState,
  bottomSheetModalSecurityApis,
} from '@/components2024/GlobalBottomSheetModal/security';
import { useExpScreenCapture } from './appSettings';
import { cleanSpecialSoloWeightFont } from '@/core/utils/fonts';
import { BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import { zCreate } from '@/core/utils/reexports';
import { resolveValFromUpdater, UpdaterOrPartials } from '@/core/utils/store';
import { RefLikeObject } from '@/utils/type';
import { perfEvents } from '@/core/utils/perf';

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

type ScreenOptions = Omit<NativeStackNavigationOptions, 'headerTitleStyle'> & {
  headerTitleStyle: NativeStackNavigationOptions['headerTitleStyle'] & object;
};
export const useStackScreenConfig = () => {
  const appThemeMode = useGetBinaryMode();

  const navBack = useCallback(() => {
    const navigation = navigationRef.current;
    if (navigation?.canGoBack()) {
      navigation.goBack();
    } else {
      navigationRef.resetRoot({
        index: 0,
        routes: [{ name: 'Root' }],
      });
    }
  }, []);

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
    [appThemeMode, navBack],
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
          <CustomTouchableOpacity
            style={styles.backButtonStyle}
            hitSlop={hitSlop}
            onPress={navBack}>
            <RcIconHeaderBack
              width={24}
              height={24}
              color={tintColor || colors2024['neutral-body']}
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
    [appThemeMode, navBack],
  );

  return { mergeScreenOptions, mergeScreenOptions2024 };
};

export function useBottomTabScreenConfig() {
  const appThemeMode = useGetBinaryMode();

  const navBack = useCallback(() => {
    const navigation = navigationRef.current;
    if (navigation?.canGoBack()) {
      navigation.goBack();
    } else if (navigation) {
      resetNavigationTo(navigation, 'Home');
    }
  }, []);

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
          <CustomTouchableOpacity
            style={styles.backButtonStyle}
            hitSlop={hitSlop}
            onPress={navBack}>
            <RcIconHeaderBack
              width={24}
              height={24}
              color={tintColor || colors2024['neutral-body']}
            />
          </CustomTouchableOpacity>
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
    [appThemeMode, navBack],
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
const tabIndexRef: RefLikeObject<number> = { current: 0 };
export const apisHomeTabIndex = {
  get tabIndex() {
    return tabIndexRef.current;
  },
  isHomeAtFirstTab() {
    return tabIndexRef.current === 0;
  },
  setTabIndex(val: number) {
    tabIndexRef.current = val;
    tabIndexStore.setState({ tabIndex: val });
  },
};

export function resetNavigationTo(
  navigation: NavigationInstance,
  type: 'Home' | 'Unlock' | 'GetStarted2024' = 'Home',
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
      // if (
      //   getLatestNavigationName() === RootNames.BrowserScreen ||
      //   getLatestNavigationName() === RootNames.BrowserManageScreen
      // ) {
      //   navigation.dispatch(TabActions.jumpTo(RootNames.StackMain));
      // }

      break;
    }
    case 'GetStarted2024': {
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

async function canLockWallet() {
  const lockInfo = await apisLock.getRabbyLockInfo();
  return lockInfo.isUseCustomPwd;
}

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
  const srnInfo = atSensitiveScreenStore(s => s.screenInfo);
  const anySensitiveModalOpened = atSensitiveScreenStore(
    s => s.anySensitiveModalOpened,
  );

  return {
    anySensitiveModalOpened,
    atSensitiveScene: srnInfo._atSensitiveScreen || anySensitiveModalOpened,
    iosBlurType: srnInfo.$protectedConf.iosBlurType,
    warningScreenshotBackup: srnInfo.$protectedConf.warningScreenshotBackup,
    onOk: srnInfo.$protectedConf.onOk,
  };
}

/**
 * @description call this hook only once on the top level of your app
 */
export function useAppPreventScreenshotOnScreen({
  isTop = false,
}: {
  isTop?: boolean;
}) {
  const { atSensitiveScene, iosBlurType } = useAtSensitiveScene();
  const { forceAllowScreenshot } = useExpScreenCapture();
  const shouldPreventScreenCapturing =
    atSensitiveScene && !forceAllowScreenshot;

  usePreventScreenshot(shouldPreventScreenCapturing, { isTop });

  const { isBeingCaptured } = useIOSScreenRecording({ isTop });
  useIOSScreenshotted({ isTop });

  // protect from screen recording
  useEffect(() => {
    if (!isTop) return;

    if (!IS_IOS) return;
    if (iosBlurType === ProtectType.SafeTipModal) return;

    if (isBeingCaptured && shouldPreventScreenCapturing) {
      RNScreenshotPrevent.iosProtectFromScreenRecording();
    } else {
      RNScreenshotPrevent.iosUnprotectFromScreenRecording();
    }
  }, [isTop, iosBlurType, isBeingCaptured, shouldPreventScreenCapturing]);
}
