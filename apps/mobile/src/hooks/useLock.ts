import React, { useCallback, useMemo } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';

const isAndroid = Platform.OS === 'android';
const isIOS = Platform.OS === 'ios';

import { atom, useAtom, useAtomValue, useSetAtom } from 'jotai';
import { keyringService } from '@/core/services';
import { apisLock } from '@/core/apis';
import { PasswordStatus } from '@/core/apis/lock';

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
  const [{ appUnlocked }, setAppLock] = useAtom(appLockAtom);

  return {
    isAppUnlocked: appUnlocked,
    setAppLock,
  };
}

const tryAutoUnlockPromiseRef = {
  current: apisLock.tryAutoUnlockRabbyMobile(),
};

/**
 * @description only use this hooks on the top level of your app
 */
export function useTryUnlockAppOnTop() {
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

const appStatusAtom = atom<{
  status: AppStateStatus;
  // iosStatus: AppStateStatus;
}>({
  status: tryGetAppStatus(),
  // iosStatus: FALLBACK_STATE,
});

export function useIsOnBackground() {
  const appState = useAtomValue(appStatusAtom);

  const isOnBackground = useMemo(() => {
    if (isIOS) {
      return [
        'inactive',
        /* not possible for our app, but just write here */
        'background',
      ].includes(appState.status);
    }

    return appState.status === 'background';
  }, [appState.status]);

  return {
    isOnBackground,
  };
}

/**
 * @description call this hooks on the top level of your app to handle background state
 */
export function useSecureOnBackground() {
  const setAppStatus = useSetAtom(appStatusAtom);

  React.useEffect(() => {
    if (!AppState.isAvailable) return;

    if (isAndroid) {
      const subBlur = AppState.addEventListener('blur', nextStatus => {
        setAppStatus({ status: nextStatus });
      });
      const subFocus = AppState.addEventListener('focus', nextStatus => {
        setAppStatus({ status: nextStatus });
      });

      return () => {
        subBlur.remove();
        subFocus.remove();
      };
    } else if (isIOS) {
      const subChange = AppState.addEventListener('change', nextStatus => {
        setAppStatus({ status: nextStatus });
      });

      return () => {
        subChange.remove();
      };
    }
  }, [setAppStatus]);
}
