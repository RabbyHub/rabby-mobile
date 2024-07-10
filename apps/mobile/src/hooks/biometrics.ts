import { atom, useAtom } from 'jotai';
import { useCallback, useEffect, useMemo } from 'react';
import { BIOMETRY_TYPE } from 'react-native-keychain';

import { AuthenticationModal } from '@/components/AuthenticationModal/AuthenticationModal';
import { toast, toastLoading } from '@/components/Toast';
import { apisKeychain, apisLock } from '@/core/apis';
import {
  KEYCHAIN_AUTH_TYPES,
  RequestGenericPurpose,
  isAuthenticatedByBiometrics,
  parseKeychainError,
} from '@/core/apis/keychain';
import { strings } from '@/utils/i18n';
import { useAtomCallback } from 'jotai/utils';
import {
  ValidationBehaviorProps,
  parseValidationBehavior,
} from '@/core/apis/lock';
import { Vibration } from 'react-native';
import { IExtractFromPromise } from '@/utils/type';

const biometricsInfoAtom = atom({
  authEnabled: isAuthenticatedByBiometrics(),
  supportedBiometryType: null as BIOMETRY_TYPE | null,
});
biometricsInfoAtom.onMount = setter => {
  apisKeychain.getSupportedBiometryType().then(supportedType => {
    setter(prev => ({ ...prev, supportedBiometryType: supportedType }));
  });
};
const isFetchingBiometricsRef = { current: false };
export function useBiometrics(options?: { autoFetch?: boolean }) {
  const [biometrics, setBiometrics] = useAtom(biometricsInfoAtom);

  const fetchBiometrics = useCallback(async () => {
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
  }, [setBiometrics]);

  useEffect(() => {
    if (options?.autoFetch) {
      fetchBiometrics();
    }
  }, [options?.autoFetch, fetchBiometrics]);

  const computed = useMemo(() => {
    const { authEnabled, supportedBiometryType } = biometrics;
    return {
      isBiometricsEnabled: authEnabled && !!supportedBiometryType,
      couldSetupBiometrics: !!supportedBiometryType,
      supportedBiometryType,
      isFaceID: supportedBiometryType === BIOMETRY_TYPE.FACE_ID,
    };
  }, [biometrics]);

  return {
    biometrics,
    computed,
    fetchBiometrics,
  };
}

export function useToggleBiometricsEnabled() {
  const [, setBiometrics] = useAtom(biometricsInfoAtom);
  const { computed, fetchBiometrics } = useBiometrics();

  const requestToggleBiometricsEnabled = useCallback(
    async (nextEnabled: boolean) => {
      AuthenticationModal.show({
        confirmText: strings('global.confirm'),
        cancelText: strings('global.cancel'),
        title: nextEnabled
          ? strings('component.AuthenticationModals.biometrics.enable')
          : strings('component.AuthenticationModals.biometrics.disable'),
        description: nextEnabled
          ? strings('component.AuthenticationModals.biometrics.enableTip')
          : strings('component.AuthenticationModals.biometrics.disableTip'),
        validationHandler: async (password: string) => {
          return apisLock.throwErrorIfInvalidPwd(password);
        },
        async onFinished({ validatedPassword }) {
          const hideToast = toastLoading(
            `${nextEnabled ? 'Enabling' : 'Disabling'} biometrics`,
          );
          try {
            if (nextEnabled) {
              await apisKeychain.setGenericPassword(
                validatedPassword,
                KEYCHAIN_AUTH_TYPES.BIOMETRICS,
              );
            } else {
              await apisKeychain.resetGenericPassword();
            }
            setBiometrics(prev => ({ ...prev, authEnabled: nextEnabled }));
          } catch (error: any) {
            toast.show(error?.message);
          } finally {
            hideToast();
            await fetchBiometrics();
          }
        },
      });
    },
    [setBiometrics, fetchBiometrics],
  );

  return {
    isBiometricsEnabled: computed.isBiometricsEnabled,
    couldSetupBiometrics: computed.couldSetupBiometrics,
    requestToggleBiometricsEnabled,
  };
}

const biometricsStubModalStateAtom = atom<{
  status: 'idle' | 'preparing' | 'processing' | 'success' | 'failed';
  lastStubBehaviors: ValidationBehaviorProps | null;
}>({
  status: 'idle',
  lastStubBehaviors: {},
});
export function useVerifyByBiometrics() {
  const [{ status: biometricsStatus }, setState] = useAtom(
    biometricsStubModalStateAtom,
  );
  const getAtomValue = useAtomCallback(get =>
    get(biometricsStubModalStateAtom),
  );

  const {
    computed: { isBiometricsEnabled },
  } = useBiometrics();

  const verifyByBiometrics = useCallback(
    async (options?: ValidationBehaviorProps) => {
      if (!isBiometricsEnabled) {
        toast.info(
          strings(
            'component.AuthenticationModals.processBiometrics.notEnabled',
          ),
        );
        return;
      }

      const atomValue = getAtomValue();

      if (atomValue.status === 'processing') return;
      setState(prev => ({ ...prev, status: 'processing' }));

      const behaviors = options || { ...atomValue.lastStubBehaviors };
      const defaultFinished = () => {
        setTimeout(() => {
          setState(prev => ({ ...prev, status: 'idle' }));
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
            strings(
              'component.AuthenticationModals.processBiometrics.authFailed',
            ),
          );
        }
        // vibration here
        if (error) Vibration.vibrate([100], false);
      }

      try {
        if (!verifyResult || !verifyResult.actionSuccess || !rawPassword) {
          setState(prev => ({ ...prev, status: 'failed' }));
        } else {
          await validationHandler?.(rawPassword);
          setState(prev => ({ ...prev, status: 'success' }));
          onFinished?.({ validatedPassword: rawPassword });
        }
      } catch (error) {
        setState(prev => ({ ...prev, status: 'failed' }));
      }
    },
    [isBiometricsEnabled, getAtomValue, setState],
  );

  const abortBiometricsVerification = useCallback(() => {
    setState(prev => ({ ...prev, status: 'idle' }));
  }, [setState]);

  const startBiometricsVerification = useCallback(
    (options?: ValidationBehaviorProps) => {
      setState(prev => ({
        ...prev,
        lastStubBehaviors: { ...options },
        status: 'preparing',
      }));
    },
    [setState],
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
