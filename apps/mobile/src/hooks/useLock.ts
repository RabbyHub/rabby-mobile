import React, { useCallback, useMemo } from 'react';
import type { AppStateStatus } from 'react-native';
import { AppState, Platform } from 'react-native';
import { useShallow } from 'zustand/react/shallow';

import {
  hasPersistedKeyringPublicAccountSnapshot,
  isKeyringUnlockedSnapshot,
  keyringServiceApi,
} from '@/core/serviceApi/keyring';
import { apisAutoLock, apisLock } from '@/core/apis';
import { PasswordStatus } from '@/core/apis/lock';
import { useRabbyAppNavigation } from './navigation';
import { useFocusEffect } from '@react-navigation/native';
import type {
  AddressNavigatorParamList,
  SettingNavigatorParamList,
} from '@/navigation-type';
import { RootNames } from '@/constant/layout';
import { APP_FEATURE_SWITCH } from '@/constant';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import RNScreenshotPrevent from '@/core/native/RNScreenshotPrevent';
import { zCreate } from '@/core/utils/reexports';
import { naviPush } from '@/utils/navigation';
import type { UpdaterOrPartials } from '@/core/utils/store';
import {
  makeAvoidParallelAsyncFunc,
  resolveValFromUpdater,
} from '@/core/utils/store';
import type { RefLikeObject } from '@/utils/type';
import {
  getAppLockStateSnapshot,
  storeApiLock,
  useAppLockState,
} from './appLockState';
import { resolveWalletAccountState } from '@/core/utils/walletEntryState';

export { getAppLockStateSnapshot, storeApiLock } from './appLockState';

const isAndroid = Platform.OS === 'android';
const isIOS = Platform.OS === 'ios';

// iife
storeApiLock.setAppLock({
  appUnlocked: isKeyringUnlockedSnapshot(),
  isUnlockSessionValid: apisLock.isUnlockSessionValid(),
});

function syncUnlockSessionValidity() {
  storeApiLock.setAppLock(prev => ({
    ...prev,
    isUnlockSessionValid: apisLock.isUnlockSessionValid(),
  }));
}

apisLock.unlockTimeEvent.addListener('updated', syncUnlockSessionValidity);
apisLock.appLaunchLockEvent.addListener('changed', syncUnlockSessionValidity);

export function useSetAppLock() {
  return { setAppLock: storeApiLock.setAppLock };
}
export function useAppUnlocked() {
  return {
    isAppUnlocked: useAppLockState(state => state.appUnlocked),
    isUnlockSessionValid: useAppLockState(state => state.isUnlockSessionValid),
    hasVisibleAccounts: useAppLockState(state => state.hasVisibleAccounts),
    hasStoredKeyrings: useAppLockState(state => state.hasStoredKeyrings),
    accountState: useAppLockState(state => state.accountState),
    getIsAppUnlocked: storeApiLock.getIsAppUnlocked,
    setAppLock: storeApiLock.setAppLock,
  };
}

export function useIsPostUnlockLockedSession() {
  const appUnlocked = useAppLockState(state => state.appUnlocked);
  const isUnlockSessionValid = useAppLockState(
    state => state.isUnlockSessionValid,
  );

  return !appUnlocked && isUnlockSessionValid;
}

export function getPwdStatus() {
  return getAppLockStateSnapshot().pwdStatus;
}

export function usePasswordStatus() {
  // const { pwdStatus } = useAtomValue(appLockAtom);
  const pwdStatus = useAppLockState(state => state.pwdStatus);

  return {
    pwdStatus,
    isUseBuiltinPwd: pwdStatus === PasswordStatus.UseBuiltIn,
    isUseCustomPwd: pwdStatus === PasswordStatus.Custom,
  };
}

export async function getBootstrapAccountFlags() {
  const [
    visibleAccountsCount,
    hasVault,
    hasEncryptedKeyringData,
    hasUnencryptedKeyringData,
    hasPersistedAccountSnapshot,
  ] = await Promise.all([
    keyringServiceApi.getCountOfAccountsInKeyring(),
    keyringServiceApi.hasVault(),
    keyringServiceApi.hasEncryptedKeyringData(),
    keyringServiceApi.hasUnencryptedKeyringData(),
    hasPersistedKeyringPublicAccountSnapshot(),
  ]);
  const hasVisibleAccounts = visibleAccountsCount > 0;
  const hasStoredKeyrings =
    hasVisibleAccounts ||
    hasVault ||
    hasEncryptedKeyringData ||
    hasUnencryptedKeyringData;

  return {
    hasVisibleAccounts,
    hasStoredKeyrings,
    accountState: resolveWalletAccountState({
      hasVisibleAccounts,
      hasStoredKeyrings,
      hasPersistedAccountSnapshot,
      isKeyringUnlocked: isKeyringUnlockedSnapshot(),
    }),
  };
}

export async function refreshAppLockAccountFlags() {
  const accountFlags = await getBootstrapAccountFlags();
  storeApiLock.setAppLock(prev => ({
    ...prev,
    ...accountFlags,
  }));
  return accountFlags;
}

export const loadBootstrapAppLockState = async () => {
  const [lockInfo, accountFlags] = await Promise.all([
    apisLock.getRabbyLockInfo(),
    getBootstrapAccountFlags(),
  ]);
  const appUnlocked = isKeyringUnlockedSnapshot();
  const isUnlockSessionValid = apisLock.isUnlockSessionValid();

  if (!appUnlocked && isUnlockSessionValid) {
    apisAutoLock.refreshAutolockTimeout();
  }

  const nextState = {
    appUnlocked,
    isUnlockSessionValid,
    ...accountFlags,
    pwdStatus: lockInfo.pwdStatus,
  };

  storeApiLock.setAppLock(nextState);
  return nextState;
};

export const getTriedUnlock = async () => {
  return apisLock
    .tryAutoUnlockRabbyMobileWithUpdateUnlockTime()
    .then(async result => {
      const accountFlags = await getBootstrapAccountFlags();
      if (!isKeyringUnlockedSnapshot() && apisLock.isUnlockSessionValid()) {
        apisAutoLock.refreshAutolockTimeout();
      }
      storeApiLock.setAppLock({
        appUnlocked: isKeyringUnlockedSnapshot(),
        isUnlockSessionValid: apisLock.isUnlockSessionValid(),
        ...accountFlags,
        pwdStatus: result.lockInfo.pwdStatus,
      });
      return result;
    });
};

/**
 * @description only use this hooks on the top level of your app
 */
export function useTryUnlockAppWithBuiltinOnTop() {
  return { getTriedUnlock };
}

const isLoadingRef: RefLikeObject<boolean> = { current: false };
export const fetchLockInfo = makeAvoidParallelAsyncFunc(async () => {
  // if (isLoadingRef.current) return;
  isLoadingRef.current = true;

  try {
    const response = await apisLock.getRabbyLockInfo();
    const accountFlags = await getBootstrapAccountFlags();

    storeApiLock.setAppLock({
      appUnlocked: isKeyringUnlockedSnapshot(),
      isUnlockSessionValid: apisLock.isUnlockSessionValid(),
      ...accountFlags,
      pwdStatus: response.pwdStatus,
    });

    return response;
  } catch (error) {
    console.error(error);
  } finally {
    isLoadingRef.current = false;
  }
});

export async function loadLockInfoOnBootstrap() {
  return fetchLockInfo();
}

export function useLoadLockInfo(options?: { autoFetch?: boolean }) {
  const appLock = useAppLockState(
    useShallow(state => ({
      appUnlocked: state.appUnlocked,
      isUnlockSessionValid: state.isUnlockSessionValid,
      pwdStatus: state.pwdStatus,
    })),
  );

  const { autoFetch } = options || {};

  React.useEffect(() => {
    if (autoFetch) {
      fetchLockInfo();
    }
  }, [autoFetch]);

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

type AppStateState = {
  current: AppStateStatus;
  androidPaused: boolean;
};

const appStateStore = zCreate<AppStateState>((set, get) => {
  return {
    current: tryGetAppStatus(),
    androidPaused: false,
  };
});

function setAppStatus(valOrFunc: UpdaterOrPartials<AppStateState>) {
  appStateStore.setState(prev => resolveValFromUpdater(prev, valOrFunc).newVal);
}

function isInactive(appStatus: AppStateStatus) {
  return [
    'inactive',
    /* not possible for our ios app, but just write here */
    'background',
  ].includes(appStatus);
}

export function useIsOnBackground() {
  // const appState = useAtomValue(appStateAtom);
  const appState = appStateStore(state => state);

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
export function startSubscribeAppStateChange() {
  if (isAndroid) {
    const subBlur = AppState.addEventListener('blur', () => {});
    const subFocus = AppState.addEventListener('focus', () => {});
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
}

type SwitchToggleType =
  import('@/components/customized/Switch').SwitchToggleType;
export const sheetModalRefsNeedLock = {
  switchBiometricsRef: React.createRef<SwitchToggleType>(),
  selectAutolockTimeRef: React.createRef<BottomSheetModal>(),
};

const setPasswordFirstStore = zCreate<{ isOnSettingsWaiting: boolean }>(() => ({
  isOnSettingsWaiting: false,
}));
function setSetPasswordFirst(
  valOrFunc: UpdaterOrPartials<{ isOnSettingsWaiting: boolean }>,
) {
  setPasswordFirstStore.setState(
    prev => resolveValFromUpdater(prev, valOrFunc).newVal,
  );
}
export function useSetPasswordFirstState() {
  const isOnSettingsWaiting = setPasswordFirstStore(s => s.isOnSettingsWaiting);

  return {
    isOnSettingsWaiting,
    updateSetPasswordFirst: setSetPasswordFirst,
  };
}

export const shouldRedirectToSetPasswordBefore2024 = async ({
  backScreen,
  isFirstImportPassword,
}: {
  backScreen: (AddressNavigatorParamList['SetPassword2024'] & {
    actionAfterSetup: 'backScreen';
  })['finishGoToScreen'];
  isFirstImportPassword?: boolean;
}) => {
  if (!APP_FEATURE_SWITCH.customizePassword) {
    return false;
  }
  // if (lockInfo.pwdStatus === PasswordStatus.Custom) {
  //   return false;
  // }
  const shouldAsk = await apisLock.shouldAskSetPassword();
  if (!shouldAsk) {
    return false;
  }

  if (backScreen) {
    naviPush(RootNames.StackAddress, {
      screen: RootNames.SetPassword2024,
      params: {
        title: 'Set Password',
        hideProgress: true,
        finishGoToScreen: backScreen,
        isFirstImportPassword,
        hideBackIcon: isFirstImportPassword,
      },
    });
    return true;
  }
  return false;
};

export function useSetPasswordFirst() {
  const navigation = useRabbyAppNavigation();
  const { lockInfo, fetchLockInfo } = useLoadLockInfo();

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
        actionAfterSetup: 'testkits:fromSettings';
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
        setSetPasswordFirst({ isOnSettingsWaiting: true });
        navigation.push(RootNames.StackSettings, {
          screen: RootNames.SetPassword,
          params: {
            actionAfterSetup: 'testkits:fromSettings',
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
    shouldRedirectToSetPasswordBefore2024,
  };
}
