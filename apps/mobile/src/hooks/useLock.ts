import React, { useMemo } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';

const isAndroid = Platform.OS === 'android';
const isIOS = Platform.OS === 'ios';

import { atom, useAtom, useAtomValue, useSetAtom } from 'jotai';

const appLockAtom = atom({
  appUnlocked: false,
});

export function useIsAppUnlocked() {
  const [{ appUnlocked }] = useAtom(appLockAtom);
  return { isAppUnlocked: appUnlocked };
}

export function useAppUnlocked() {
  const [{ appUnlocked }, setAppLock] = useAtom(appLockAtom);

  return {
    appUnlocked,
    setAppLock,
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
