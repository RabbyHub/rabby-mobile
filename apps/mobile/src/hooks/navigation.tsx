import React, { useCallback, useEffect, useMemo } from 'react';
import { Alert, StyleSheet } from 'react-native';
import { atom, useAtomValue, useSetAtom } from 'jotai';
import { debounce, merge } from 'lodash';

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
import {
  useIOSScreenRecording,
  useIOSScreenshotted,
  usePreventScreenshot,
} from './native/security';
import RNScreenshotPrevent from '@/core/native/RNScreenshotPrevent';
import { apisLock } from '@/core/apis';
import { IS_ANDROID, IS_IOS } from '@/core/native/utils';
import RNTimeChanged from '@/core/native/RNTimeChanged';

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

type ScreenOptions = Omit<NativeStackNavigationOptions, 'headerTitleStyle'> & {
  headerTitleStyle: NativeStackNavigationOptions['headerTitleStyle'] & object;
};
export const useStackScreenConfig = () => {
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

  const mergeScreenOptions = useCallback(
    (...optsList: Partial<ScreenOptions>[]) => {
      const screenOptions: ScreenOptions = {
        animation: 'slide_from_right',
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

      return merge(
        {},
        screenOptions,
        ...optsList.map(x => ({ ...x })),
      ) as ScreenOptions;
    },
    [headerPresets, colors, navBack],
  );

  return { mergeScreenOptions };
};

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
const defaultProtectedConf: ProtectedConf = {
  iosBlurType: ProtectType.NONE,
  onOk: ctx => {
    ctx.navigation?.goBack();
  },
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
  [RootNames.CreateMnemonicBackup]: getProtectedConf(),
  [RootNames.CreateMnemonicVerify]: getProtectedConf(),
  [RootNames.BackupMnemonic]: getProtectedConf(),
  [RootNames.BackupPrivateKey]: getProtectedConf(),
};

function getAtSensitveScreenInfo(routeName: string | undefined) {
  const result = {
    $routeName: routeName,
    $protectedConf: { ...defaultProtectedConf },
    atSensitiveScreen: false,
  };

  if (!routeName || !PROTECTED_SCREENS[routeName]) return result;

  result.$protectedConf = {
    ...defaultProtectedConf,
    ...PROTECTED_SCREENS[routeName],
  };

  result.atSensitiveScreen = !!PROTECTED_SCREENS[routeName];

  return result;
}

export function useAtSensitiveScreen() {
  const currentRouteName = useAtomValue(currentRouteNameAtom);

  return useMemo(
    () => getAtSensitveScreenInfo(currentRouteName),
    [currentRouteName],
  );
}
/**
 * @description call this hook only once on the top level of your app
 */
export function useAppPreventScreenshotOnScreen() {
  const { atSensitiveScreen, $protectedConf } = useAtSensitiveScreen();

  usePreventScreenshot(atSensitiveScreen);

  const { isBeingCaptured } = useIOSScreenRecording({
    isTop: true,
  });
  useIOSScreenshotted({ isTop: true });

  // protect from screen recording
  useEffect(() => {
    if (!IS_IOS) return;
    if ($protectedConf.iosBlurType === ProtectType.SafeTipModal) return;

    if (isBeingCaptured && atSensitiveScreen) {
      RNScreenshotPrevent.iosProtectFromScreenRecording();
    } else {
      RNScreenshotPrevent.iosUnprotectFromScreenRecording();
    }
  }, [$protectedConf.iosBlurType, isBeingCaptured, atSensitiveScreen]);
}

type OnTimeChangedCtx = Parameters<
  Parameters<typeof RNTimeChanged.subscribeTimeChanged>[0]
>[0];
const handleTimeChanged = debounce(async (ctx: OnTimeChangedCtx) => {
  const result = await requestLockWalletAndBackToUnlockScreen();
  if (result.canLockWallet) {
    Alert.alert(
      'Auto Lock',
      `Time settings changed, auto lock wallet for security.`,
    );
  } else {
    Alert.alert(
      'Warning',
      `Time settings changed, will quit app for security.`,
      [
        {
          text: 'OK',
          onPress: () => {
            RNTimeChanged.exitAppForSecurity();
          },
        },
      ],
    );
  }
}, 1000);

RNTimeChanged.subscribeTimeChanged(handleTimeChanged);
