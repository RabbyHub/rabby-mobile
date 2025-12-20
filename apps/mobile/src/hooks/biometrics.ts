import { useCallback, useEffect, useMemo } from 'react';
import { BIOMETRY_TYPE } from 'react-native-keychain';
import { toast, toastLoading } from '@/components/Toast';
import { apisKeychain } from '@/core/apis';
import {
  KEYCHAIN_AUTH_TYPES,
  RequestGenericPurpose,
  isAuthenticatedByBiometrics,
  parseKeychainError,
} from '@/core/apis/keychain';
import { useTranslation } from 'react-i18next';
import {
  ValidationBehaviorProps,
  parseValidationBehavior,
} from '@/core/apis/lock';
import { Vibration } from 'react-native';
import { IExtractFromPromise } from '@/utils/type';
import { IS_IOS } from '@/core/native/utils';
import { zCreate } from '@/core/utils/reexports';
import {
  resolveValFromUpdater,
  runIIFEFunc,
  UpdaterOrPartials,
} from '@/core/utils/store';
import { useShallow } from 'zustand/react/shallow';

type BiometricsInfoState = {
  authEnabled: boolean;
  supportedBiometryType: BIOMETRY_TYPE | null;
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
    let supportedType = null as null | BIOMETRY_TYPE;
    try {
      supportedType = await apisKeychain.getSupportedBiometryType();
    } catch (error) {
      console.error(error);
    }
    setBiometrics(prev => {
      // if (prev.authEnabled && !supportedType) {
      //   toast.info(
      //     'Biometrics authentication disabled because no valid biometric data found.',
      //   );
      // }
      return {
        ...prev,
        supportedBiometryType: supportedType,
        authEnabled: supportedType ? isAuthenticatedByBiometrics() : false,
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
};

export const storeApisBiometrics = {
  fetchBiometrics,
  toggleBiometrics,
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
