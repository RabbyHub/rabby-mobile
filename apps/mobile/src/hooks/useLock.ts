import React from 'react';
import { AppState, Platform } from 'react-native';

// import {
//   blockScreen as RNBSBlockScree,
//   unblockScreen as RNBSUnBlockScree
// } from 'react-native-background-secure';

// const isAndroid = Platform.OS === 'android';
// function blockScreen() {
//   if (isAndroid) {
//     RNBSBlockScree();
//   }
// }

// function unblockScreen() {
//   if (isAndroid) {
//     RNBSUnBlockScree();
//   }
// }

import { atom, useAtom } from 'jotai';

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

const isOnBackgroundAtom = atom<boolean>(false);
export function useIsOnBackground() {
  const [isOnBackground] = useAtom(isOnBackgroundAtom);
  return { isOnBackground };
}
/**
 * @description call this hooks on the top level of your app to handle background state
 */
export function useSecureOnBackground() {
  const appStateRef = React.useRef(AppState.currentState);
  const [_isOnBackground, setIsOnBackground] = useAtom(isOnBackgroundAtom);

  React.useEffect(() => {
    if (!AppState.isAvailable) return;

    const subBlur = AppState.addEventListener('blur', nextAppState => {
      appStateRef.current = nextAppState;
      setIsOnBackground(true);
    });
    const subFocus = AppState.addEventListener('focus', nextAppState => {
      appStateRef.current = nextAppState;
      setIsOnBackground(false);
    });

    return () => {
      subBlur.remove();
      subFocus.remove();
    };
  }, [setIsOnBackground]);

  return {
    appState: appStateRef.current,
  };
}
