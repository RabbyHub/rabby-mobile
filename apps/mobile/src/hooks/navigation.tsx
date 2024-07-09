import React, { useCallback, useEffect, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { atom, useAtomValue, useSetAtom } from 'jotai';

import {
  NativeStackNavigationOptions,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import { useThemeColors } from '@/hooks/theme';
import { getReadyNavigationInstance, navigationRef } from '@/utils/navigation';
import { CustomTouchableOpacity } from '@/components/CustomTouchableOpacity';

import { default as RcIconHeaderBack } from '@/assets/icons/header/back-cc.svg';
import { AppRootName, RootNames, makeHeadersPresets } from '@/constant/layout';
import {
  NavigationContainerRef,
  useNavigation,
} from '@react-navigation/native';

import type { RootStackParamsList } from '@/navigation-type';
import { useIOSScreenCapture, usePreventScreenshot } from './native/security';
import DeviceUtils from '@/core/utils/device';
import RNScreenshotPrevent from '@/core/native/RNScreenshotPrevent';
import { apisLock } from '@/core/apis';

type NavigationInstance =
  | NativeStackScreenProps<RootStackParamsList>['navigation']
  | NavigationContainerRef<RootStackParamsList>;

// const LeftBackIcon = makeThemeIconFromCC(RcIconHeaderBack, {
//   onLight: ThemeColors.light['neutral-body'],
//   onDark: ThemeColors.dark['neutral-body'],
// });

const currentRouteNameAtom = atom<AppRootName | string | undefined>(undefined);
export function useCurrentRouteName() {
  return {
    currentRouteName: useAtomValue(currentRouteNameAtom),
  };
}

export function useSetCurrentRouteName() {
  return {
    setCurrentRouteName: useSetAtom(currentRouteNameAtom),
  };
}

const navigationReadyAtom = atom<boolean>(false);
export function useNavigationReady() {
  const appNavigationReady = useAtomValue(navigationReadyAtom);

  return { appNavigationReady };
}
export function useSetNavigationReady() {
  const setNavigationReady = useSetAtom(navigationReadyAtom);

  return { setNavigationReady };
}

const hitSlop = {
  top: 10,
  bottom: 10,
  left: 10,
  right: 10,
};

export const useStackScreenConfig = (): NativeStackNavigationOptions => {
  const colors = useThemeColors();

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

  const headerPresets = makeHeadersPresets({ colors });

  return {
    animation: 'slide_from_right',
    contentStyle: {
      // backgroundColor: colors.bgChat,
    },
    ...headerPresets.onlyTitle,
    headerTitleStyle: {
      ...(headerPresets.onlyTitle.headerTitleStyle as object),
      color: colors['neutral-title-1'],
      fontWeight: 'normal',
    },
    headerTintColor: colors['neutral-bg-1'],
    headerLeft: ({ tintColor }) => (
      <CustomTouchableOpacity
        style={styles.backButtonStyle}
        hitSlop={hitSlop}
        onPress={navBack}>
        <RcIconHeaderBack
          width={24}
          height={24}
          color={tintColor || colors['neutral-body']}
        />
      </CustomTouchableOpacity>
    ),
  };
};

const styles = StyleSheet.create({
  headerTitleStyle: {
    fontSize: 20,
    fontWeight: 'bold',
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

export function resetNavigationTo(
  navigation: NavigationInstance,
  type: 'Home' | 'Unlock' = 'Home',
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
      break;
    }
    case 'Unlock': {
      navigation.reset({
        index: 0,
        routes: [{ name: RootNames.Unlock, params: {} }],
      });
      break;
    }
  }
}

export async function requestLockWalletAndBackToUnlockScreen() {
  const isUnlocked = apisLock.isUnlocked();
  if (isUnlocked) {
    const lockInfo = await apisLock.getRabbyLockInfo();
    if (!lockInfo.isUseCustomPwd) return;

    await apisLock.lockWallet();
  }

  console.debug('will back to unlock screen');
  const navigation = getReadyNavigationInstance();
  if (navigation) resetNavigationTo(navigation, 'Unlock');
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

const isIOS = DeviceUtils.isIOS();
export const enum ProtectetType {
  DefaultBlur = 1,
  SafeTipModal = 2,
}

type ProtectedConf = {
  iosBlurType: ProtectetType | null;
  onCancel?: (ctx: { navigation?: NavigationInstance | null }) => void;
};
const defaultProtectedConf: ProtectedConf = {
  iosBlurType: ProtectetType.DefaultBlur,
  onCancel: ctx => {
    ctx.navigation?.goBack();
  },
};
const PROTECTED_SCREENS: {
  [P in AppRootName]?: ProtectedConf;
} = {
  [RootNames.CreateMnemonic]: {
    ...defaultProtectedConf.onCancel,
    iosBlurType: ProtectetType.SafeTipModal,
  },
  [RootNames.ImportMnemonic]: {
    ...defaultProtectedConf.onCancel,
    iosBlurType: ProtectetType.SafeTipModal,
  },
  [RootNames.ImportPrivateKey]: {
    ...defaultProtectedConf.onCancel,
    iosBlurType: ProtectetType.SafeTipModal,
  },

  [RootNames.BackupMnemonic]: {
    ...defaultProtectedConf.onCancel,
    iosBlurType: ProtectetType.SafeTipModal,
  },
  [RootNames.BackupPrivateKey]: {
    ...defaultProtectedConf.onCancel,
    iosBlurType: ProtectetType.SafeTipModal,
  },
};

export function useAtSensitiveScreen() {
  const currentRouteName = useAtomValue(currentRouteNameAtom);

  return useMemo(() => {
    const result = {
      $routeName: currentRouteName,
      $protectedConf: { ...defaultProtectedConf },
      atSensitiveScreen: false,
      // protectedBySafeTipModal: false,
      // protectedByIOSBlurView: false,
    };

    if (!currentRouteName || !PROTECTED_SCREENS[currentRouteName])
      return result;

    result.$protectedConf.iosBlurType =
      PROTECTED_SCREENS[currentRouteName]?.iosBlurType ??
      ProtectetType.DefaultBlur;
    result.atSensitiveScreen = !!PROTECTED_SCREENS[currentRouteName];
    // result.protectedBySafeTipModal = result.$protectedConf.iosBlurType === ProtectetType.SafeTipModal;
    // result.protectedByIOSBlurView = result.$protectedConf.iosBlurType === ProtectetType.DefaultBlur;

    return result;
  }, [currentRouteName]);
}
/**
 * @description call this hook only once on the top level of your app
 */
export function useAppPreventScreenshotOnScreen() {
  const { atSensitiveScreen, $protectedConf } = useAtSensitiveScreen();

  usePreventScreenshot(atSensitiveScreen);

  const { isBeingCaptured } = useIOSScreenCapture({ isTop: true });

  useEffect(() => {
    if (!isIOS) return;
    if ($protectedConf.iosBlurType !== ProtectetType.DefaultBlur) return;

    if (isBeingCaptured && atSensitiveScreen) {
      RNScreenshotPrevent.iosProtectFromScreenRecording();
    } else {
      RNScreenshotPrevent.iosUnprotectFromScreenRecording();
    }
  }, [$protectedConf.iosBlurType, isBeingCaptured, atSensitiveScreen]);
}
