import { useCallback, useEffect, useMemo } from 'react';
import { BIOMETRY_TYPE } from '@rabby-wallet/react-native-keychain';
import { toast, toastLoading } from '@/components2024/Toast';
import { apisKeychain } from '@/core/apis';
import {
  KEYCHAIN_AUTH_TYPES,
  RequestGenericPurpose,
  isAuthenticatedByBiometrics,
  parseKeychainError,
  type KeychainDebugState,
  type KeychainSupportedBiometryType,
} from '@/core/apis/keychain';
import { useTranslation } from 'react-i18next';
import {
  ValidationBehaviorProps,
  parseValidationBehavior,
} from '@/core/apis/lock';
import { Vibration } from 'react-native';
import { IExtractFromPromise } from '@/utils/type';
import { IS_ANDROID, IS_IOS } from '@/core/native/utils';
import { zCreate } from '@/core/utils/reexports';
import {
  resolveValFromUpdater,
  runIIFEFunc,
  UpdaterOrPartials,
} from '@/core/utils/store';
import { useShallow } from 'zustand/react/shallow';
import { logger } from '@/utils/logger';

type BiometricsInfoState = {
  authEnabled: boolean;
  supportedBiometryType: KeychainSupportedBiometryType;
};
const biometricsInfoStore = zCreate<BiometricsInfoState>(() => ({
  authEnabled: isAuthenticatedByBiometrics(),
  supportedBiometryType: null,
}));
export function setBiometrics(
  valOrFunc: UpdaterOrPartials<BiometricsInfoState>,
) {
  biometricsInfoStore.setState(
    prev => resolveValFromUpdater(prev, valOrFunc).newVal,
  );
}
// iife
runIIFEFunc(() => {
  apisKeychain.getSupportedBiometryType().then(supportedType => {
    setBiometrics(prev => ({ ...prev, supportedBiometryType: supportedType }));
  });
});

function isPrimaryAndroidBiometricsEntryReady(state: KeychainDebugState) {
  if (state.platform !== 'android' || !state.debugSupported) {
    return true;
  }

  return state.hasEntry && state.hasUsername && state.hasPassword;
}

async function checkAndroidBiometricsEntryReady() {
  if (!IS_ANDROID || !isAuthenticatedByBiometrics()) {
    return true;
  }

  try {
    const debugState = await apisKeychain.getKeychainDebugState();
    const ready = isPrimaryAndroidBiometricsEntryReady(debugState);

    if (!ready) {
      logger.warn('[biometrics] Android keychain entry is unavailable', {
        sourceLabel: debugState.sourceLabel,
        hasEntry: debugState.hasEntry,
        hasUsername: debugState.hasUsername,
        hasPassword: debugState.hasPassword,
        resolvedCipherStorageName:
          debugState.platform === 'android'
            ? debugState.resolvedCipherStorageName
            : undefined,
        hasKeystoreAlias:
          debugState.platform === 'android'
            ? debugState.hasKeystoreAlias
            : undefined,
      });
    }

    return ready;
  } catch (error) {
    logger.warn('[biometrics] failed to inspect Android keychain entry', {
      error: error instanceof Error ? error.message : String(error),
    });
    return true;
  }
}

export function disableBiometricsForCurrentSession(reason: string) {
  logger.warn('[biometrics] disabled for current session', { reason });
  setBiometrics(prev => ({ ...prev, authEnabled: false }));
}

async function ensureBiometricsReadyForUnlock() {
  let supportedType = null as KeychainSupportedBiometryType;
  try {
    supportedType = await apisKeychain.getSupportedBiometryType();
  } catch (error) {
    logger.warn('[biometrics] failed to fetch supported biometry type', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const enabledBySetting = isAuthenticatedByBiometrics();
  const entryReady = await checkAndroidBiometricsEntryReady();
  const nextAuthEnabled = enabledBySetting && !!supportedType && entryReady;

  setBiometrics(prev => ({
    ...prev,
    supportedBiometryType:
      supportedType || (nextAuthEnabled ? prev.supportedBiometryType : null),
    authEnabled: nextAuthEnabled,
  }));

  return nextAuthEnabled;
}

export function useBiometricsComputed() {
  const authEnabled = biometricsInfoStore(s => s.authEnabled);
  const supportedBiometryType = biometricsInfoStore(
    s => s.supportedBiometryType,
  );
  const { t } = useTranslation();

  const computed = useMemo(() => {
    const isFaceID = supportedBiometryType === BIOMETRY_TYPE.FACE_ID;
    return {
      isBiometricsEnabled: authEnabled && !!supportedBiometryType,
      settingsAuthEnabled: authEnabled,
      couldSetupBiometrics: !!supportedBiometryType,
      supportedBiometryType,
      defaultTypeLabel: isFaceID
        ? t('page.setting.faceId')
        : IS_IOS
        ? t('page.setting.touchId')
        : t('page.setting.fingerPrint'),
      isFaceID,
    };
  }, [authEnabled, supportedBiometryType, t]);

  return computed;
}

const isFetchingBiometricsRef = { current: false };
const fetchBiometrics = async () => {
  if (isFetchingBiometricsRef.current) return;

  isFetchingBiometricsRef.current = true;
  try {
    let supportedType = null as KeychainSupportedBiometryType;
    let didFetchSupportedType = false;
    try {
      supportedType = await apisKeychain.getSupportedBiometryType();
      didFetchSupportedType = true;
    } catch (error) {
      console.error(error);
    }
    const enabledBySetting = isAuthenticatedByBiometrics();
    const entryReady = await checkAndroidBiometricsEntryReady();
    const nextAuthEnabledByEntry = enabledBySetting && entryReady;

    setBiometrics(prev => {
      if (!didFetchSupportedType) {
        return prev;
      }
      // if (prev.authEnabled && !supportedType) {
      //   toast.info(
      //     'Biometrics authentication disabled because no valid biometric data found.',
      //   );
      // }
      return {
        ...prev,
        supportedBiometryType:
          supportedType ||
          (!IS_ANDROID && nextAuthEnabledByEntry
            ? prev.supportedBiometryType
            : null),
        authEnabled:
          nextAuthEnabledByEntry &&
          !!(supportedType || (!IS_ANDROID && prev.supportedBiometryType)),
      };
    });
  } catch (error) {
    console.error(error);
  } finally {
    isFetchingBiometricsRef.current = false;
  }
};

const toggleBiometrics = async <T extends boolean>(
  nextEnabled: T,
  input: { tipLoading?: boolean } & (T extends true
    ? { validatedPassword: string }
    : { validatedPassword?: undefined }),
) => {
  const { validatedPassword, tipLoading } = input;
  let changed = false;

  const hideToast = !tipLoading
    ? null
    : toastLoading(`${nextEnabled ? 'Enabling' : 'Disabling'} biometrics`);

  const reset = async () => {
    await apisKeychain.resetGenericPassword();
    setBiometrics(prev => ({ ...prev, authEnabled: false }));
  };

  try {
    if (!nextEnabled) {
      await reset();
      changed = true;
    } else {
      if (!validatedPassword) {
        throw new Error('Validated password is required to enable biometrics.');
      }

      await apisKeychain.setGenericPassword(
        validatedPassword,
        KEYCHAIN_AUTH_TYPES.BIOMETRICS,
      );
      const requestResult = await apisKeychain.requestGenericPassword({
        purpose: RequestGenericPurpose.VERIFY,
      });
      if (!requestResult) {
        await reset();
      } else if (requestResult && requestResult.actionSuccess) {
        setBiometrics(prev => ({ ...prev, authEnabled: true }));
        changed = true;
      }
    }
  } catch (error: any) {
    if (nextEnabled) await reset();

    const parsedInfo = parseKeychainError(error);
    if (parsedInfo.isCancelledByUser || (__DEV__ && parsedInfo.sysMessage)) {
      toast.show(parsedInfo.sysMessage);
    } else {
      toast.show(error?.message);
    }
  } finally {
    hideToast?.();
    await fetchBiometrics();
  }

  return changed && biometricsInfoStore.getState().authEnabled === nextEnabled;
};

export const storeApisBiometrics = {
  fetchBiometrics,
  toggleBiometrics,
  disableBiometricsForCurrentSession,
  ensureBiometricsReadyForUnlock,
};

export function useBiometrics(options?: { autoFetch?: boolean }) {
  const biometrics = biometricsInfoStore(
    useShallow(s => ({
      authEnabled: s.authEnabled,
      supportedBiometryType: s.supportedBiometryType,
    })),
  );

  useEffect(() => {
    if (options?.autoFetch) {
      fetchBiometrics();
    }
  }, [options?.autoFetch]);

  const computed = useBiometricsComputed();

  return {
    biometrics,
    computed,
    fetchBiometrics,
    toggleBiometrics,
  };
}

type BiometricsStubModalState = {
  status: 'idle' | 'preparing' | 'processing' | 'success' | 'failed';
  lastStubBehaviors: ValidationBehaviorProps | null;
};
const biometricsStubModalState = zCreate<BiometricsStubModalState>(() => ({
  status: 'idle',
  lastStubBehaviors: {},
}));
export function setBiometricsStubModalState(
  valOrFunc: UpdaterOrPartials<BiometricsStubModalState>,
) {
  biometricsStubModalState.setState(
    prev => resolveValFromUpdater(prev, valOrFunc).newVal,
  );
}
function getBiometricsStubModalState() {
  return biometricsStubModalState.getState();
}

export function useVerifyByBiometrics() {
  const biometricsStatus = biometricsStubModalState(s => s.status);
  const { t } = useTranslation();

  const {
    computed: { isBiometricsEnabled },
  } = useBiometrics();

  const verifyByBiometrics = useCallback(
    async (options?: ValidationBehaviorProps) => {
      if (!isBiometricsEnabled) {
        toast.info(
          t('component.AuthenticationModals.processBiometrics.notEnabled'),
        );
        return;
      }

      const bioStubModalState = getBiometricsStubModalState();

      if (bioStubModalState.status === 'processing') return;
      setBiometricsStubModalState(prev => ({ ...prev, status: 'processing' }));

      const behaviors = options || { ...bioStubModalState.lastStubBehaviors };
      const defaultFinished = () => {
        setTimeout(() => {
          setBiometricsStubModalState(prev => ({ ...prev, status: 'idle' }));
        }, 250);
      };
      const { validationHandler, onFinished = defaultFinished } =
        parseValidationBehavior(behaviors);

      let rawPassword = '';
      let verifyResult: IExtractFromPromise<
        ReturnType<typeof apisKeychain.requestGenericPassword>
      > = null;
      try {
        verifyResult = await apisKeychain.requestGenericPassword({
          purpose: RequestGenericPurpose.DECRYPT_PWD,
          onPlainPassword: password => {
            rawPassword = password;
          },
        });
      } catch (error) {
        __DEV__ && console.debug(error);
        const parsedInfo = parseKeychainError(error);
        if (
          parsedInfo.isCancelledByUser ||
          (__DEV__ && parsedInfo.sysMessage)
        ) {
          toast.info(parsedInfo.sysMessage);
        } else {
          toast.info(
            t('component.AuthenticationModals.processBiometrics.authFailed'),
          );
        }
        // vibration here
        if (error) Vibration.vibrate([100], false);
      }

      try {
        if (!verifyResult || !verifyResult.actionSuccess || !rawPassword) {
          setBiometricsStubModalState(prev => ({ ...prev, status: 'failed' }));
        } else {
          await validationHandler?.(rawPassword);
          setBiometricsStubModalState(prev => ({ ...prev, status: 'success' }));
          onFinished?.({ getValidatedPassword: () => rawPassword });
        }
      } catch (error) {
        setBiometricsStubModalState(prev => ({ ...prev, status: 'failed' }));
      }
    },
    [isBiometricsEnabled, t],
  );

  const abortBiometricsVerification = useCallback(() => {
    setBiometricsStubModalState(prev => ({ ...prev, status: 'idle' }));
  }, []);

  const startBiometricsVerification = useCallback(
    (options?: ValidationBehaviorProps) => {
      setBiometricsStubModalState(prev => ({
        ...prev,
        lastStubBehaviors: { ...options },
        status: 'preparing',
      }));
    },
    [],
  );

  const { isProcessBiometrics, shouldShowStubModal } = useMemo(() => {
    return {
      isProcessBiometrics: biometricsStatus === 'processing',
      shouldShowStubModal: biometricsStatus !== 'idle',
    };
  }, [biometricsStatus]);

  return {
    isProcessBiometrics,
    shouldShowStubModal,
    verifyByBiometrics,
    startBiometricsVerification,
    abortBiometricsVerification,
  };
}
