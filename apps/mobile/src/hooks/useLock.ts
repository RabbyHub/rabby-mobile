import React, { useCallback, useMemo } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { atom, useAtom, useAtomValue, useSetAtom } from 'jotai';

import { keyringService } from '@/core/services';
import { apisLock } from '@/core/apis';
import { PasswordStatus } from '@/core/apis/lock';
import { useRabbyAppNavigation } from './navigation';
import { useFocusEffect } from '@react-navigation/native';
import { SettingNavigatorParamList } from '@/navigation-type';
import { RootNames } from '@/constant/layout';
import { APP_FEATURE_SWITCH } from '@/constant';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import RNScreenshotPrevent from '@/core/native/RNScreenshotPrevent';

const isAndroid = Platform.OS === 'android';
const isIOS = Platform.OS === 'ios';

// import {
//   nativeBlockScreen,
//   nativeUnblockScreen,
// } from '@/core/native/ReactNativeSecurity';

const appLockAtom = atom({
  appUnlocked: false,
  pwdStatus: PasswordStatus.Unknown,
});
appLockAtom.onMount = setAppLock => {
  setAppLock(prev => ({
    ...prev,
    appUnlocked: keyringService.isUnlocked(),
  }));
};

export function useAppUnlocked() {
  const [{ appUnlocked, pwdStatus }, setAppLock] = useAtom(appLockAtom);

  // const hasSetupCustomPassword = useMemo(() => {
  //   return pwdStatus === PasswordStatus.Custom;
  // }, [pwdStatus]);

  return {
    isAppUnlocked: appUnlocked,
    // hasSetupCustomPassword,
    setAppLock,
  };
}

export function usePasswordStatus() {
  const { pwdStatus } = useAtomValue(appLockAtom);

  return {
    pwdStatus,
    isUseBuiltinPwd: pwdStatus === PasswordStatus.UseBuiltIn,
    isUseCustomPwd: pwdStatus === PasswordStatus.Custom,
  };
}

const tryAutoUnlockPromiseRef = {
  current: apisLock.tryAutoUnlockRabbyMobileWithUpdateUnlockTime(),
};

/**
 * @description only use this hooks on the top level of your app
 */
export function useTryUnlockAppWithBuiltinOnTop() {
  const { setAppLock } = useAppUnlocked();

  const getTriedUnlock = React.useCallback(async () => {
    return tryAutoUnlockPromiseRef.current.then(async result => {
      setAppLock({
        appUnlocked: keyringService.isUnlocked(),
        pwdStatus: result.lockInfo.pwdStatus,
      });
      return result;
    });
  }, [setAppLock]);

  return { getTriedUnlock };
}

export function useLoadLockInfo(options?: { autoFetch?: boolean }) {
  const [appLock, setAppLock] = useAtom(appLockAtom);
  const isLoadingRef = React.useRef(false);

  const { autoFetch } = options || {};

  const fetchLockInfo = useCallback(async () => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;

    try {
      const response = await apisLock.getRabbyLockInfo();

      setAppLock({
        appUnlocked: keyringService.isUnlocked(),
        pwdStatus: response.pwdStatus,
      });

      return response;
    } catch (error) {
      console.error(error);
    } finally {
      isLoadingRef.current = false;
    }
  }, [setAppLock]);

  React.useEffect(() => {
    if (autoFetch) {
      fetchLockInfo();
    }
  }, [autoFetch, fetchLockInfo]);

  const { isUseBuiltinPwd, isUseCustomPwd } = React.useMemo(() => {
    return {
      isUseBuiltinPwd: appLock.pwdStatus === PasswordStatus.UseBuiltIn,
      isUseCustomPwd: appLock.pwdStatus === PasswordStatus.Custom,
    };
  }, [appLock.pwdStatus]);

  return {
    isLoading: isLoadingRef.current,
    isUseBuiltinPwd,
    isUseCustomPwd,
    lockInfo: appLock,
    fetchLockInfo,
  };
}

const FALLBACK_STATE: AppStateStatus = isIOS ? 'unknown' : 'active';
function tryGetAppStatus() {
  try {
    if (!AppState.isAvailable) return FALLBACK_STATE;

    return AppState.currentState;
  } catch (err) {
    return FALLBACK_STATE;
  }
}

const appStateAtom = atom<{
  current: AppStateStatus;
  androidPaused: boolean;
  // iosStatus: AppStateStatus;
}>({
  current: tryGetAppStatus(),
  androidPaused: false,
  // iosStatus: FALLBACK_STATE,
});

function isInactive(appStatus: AppStateStatus) {
  return [
    'inactive',
    /* not possible for our ios app, but just write here */
    'background',
  ].includes(appStatus);
}

export function useIsOnBackground() {
  const appState = useAtomValue(appStateAtom);

  const isOnBackground = useMemo(() => {
    if (isIOS) {
      return isInactive(appState.current);
    }

    return isInactive(appState.current) /*  && appState.androidPaused */;
  }, [appState]);

  return {
    isOnBackground,
  };
}

/**
 * @description call this hooks on the top level of your app to handle background state
 */
export function useSecureOnBackground() {
  const setAppStatus = useSetAtom(appStateAtom);

  React.useEffect(() => {
    if (isAndroid) {
      const subBlur = AppState.addEventListener('blur', () => {
        // setAppStatus(prev => ({ ...prev, current: 'inactive' }));
      });
      const subFocus = AppState.addEventListener('focus', () => {
        // setAppStatus(prev => ({ ...prev, current: 'active' }));
      });
      /**
       * @why not AppState.addEventListener('blur'|'focus', ...)
       *
       * because the blur and focus event will be triggered on <Modal /> component shown.
       */
      const subChanged = RNScreenshotPrevent.androidOnLifeCycleChanged(ret => {
        setAppStatus(prev => ({
          ...prev,
          androidPaused: ['pause', 'prepaused'].includes(ret.state),
        }));
      });

      return () => {
        subBlur.remove();
        subFocus.remove();
        subChanged.remove();
      };
    } else if (isIOS && AppState.isAvailable) {
      /** @see https://reactnative.dev/docs/appstate#change */
      const subChange = AppState.addEventListener('change', nextStatus => {
        // if (isInactive(nextStatus)) nativeBlockScreen();
        // else nativeUnblockScreen();

        setAppStatus(prev => ({ ...prev, current: nextStatus }));
      });

      return () => {
        subChange.remove();
      };
    }
  }, [setAppStatus]);
}

type SwitchToggleType =
  import('@/components/customized/Switch').SwitchToggleType;
export const sheetModalRefsNeedLock = {
  switchBiometricsRef: React.createRef<SwitchToggleType>(),
  selectAutolockTimeRef: React.createRef<BottomSheetModal>(),
};
const setPasswordFirstAtom = atom({
  isOnSettingsWaiting: false,
});
export function useSetPasswordFirstState() {
  const [{ isOnSettingsWaiting }, updateSetPasswordFirst] =
    useAtom(setPasswordFirstAtom);

  // const updateSetPasswordFirst = useCallback(
  //   (state: { isOnSettingsWaiting: boolean }) => {
  //     _updateSetPasswordFirst(prev => ({
  //       ...prev,
  //       ...state,
  //     }));
  //   },
  //   [navigation, _updateSetPasswordFirst],
  // );

  return {
    isOnSettingsWaiting,
    updateSetPasswordFirst,
  };
}
export function useSetPasswordFirst() {
  const navigation = useRabbyAppNavigation();
  const { lockInfo, fetchLockInfo } = useLoadLockInfo();
  // const { updateSetPasswordFirst } = useSetPasswordFirstState();

  useFocusEffect(
    useCallback(() => {
      fetchLockInfo();
    }, [fetchLockInfo]),
  );
  const shouldRedirectToSetPasswordBefore = React.useCallback(
    ({
      screen,
      onSettingsAction,
    }: {
      screen?: (SettingNavigatorParamList['SetPassword'] & {
        actionAfterSetup: 'backScreen';
      })['replaceScreen'];
      onSettingsAction?: (SettingNavigatorParamList['SetPassword'] & {
        actionAfterSetup: 'onSettings';
      })['actionType'];
    }) => {
      if (!APP_FEATURE_SWITCH.customizePassword) return false;
      if (lockInfo.pwdStatus === PasswordStatus.Custom) return false;

      if (screen) {
        navigation.push(RootNames.StackSettings, {
          screen: RootNames.SetPassword,
          params: {
            actionAfterSetup: 'backScreen',
            replaceStack: RootNames.StackAddress,
            replaceScreen: screen,
          },
        });
        return true;
      } else if (onSettingsAction) {
        // updateSetPasswordFirst({ isOnSettingsWaiting: true });
        navigation.push(RootNames.StackSettings, {
          screen: RootNames.SetPassword,
          params: {
            actionAfterSetup: 'onSettings',
            actionType: onSettingsAction,
          },
        });
        return true;
      }

      return false;
    },
    [navigation, lockInfo],
  );

  return {
    shouldRedirectToSetPasswordBefore,
  };
}
