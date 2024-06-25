import { atom, useAtom } from 'jotai';
import { useCallback, useEffect, useMemo } from 'react';
import { BIOMETRY_TYPE } from 'react-native-keychain';

import { AuthenticationModal } from '@/components/AuthenticationModal/AuthenticationModal';
import { toast, toastLoading } from '@/components/Toast';
import { apisKeychain, apisLock } from '@/core/apis';
import {
  KEYCHAIN_AUTH_TYPES,
  isAuthenticatedByBiometrics,
} from '@/core/apis/keychain';
import { strings } from '@/utils/i18n';

const biometricsInfo = atom({
  authEnabled: isAuthenticatedByBiometrics(),
  supportedBiometryType: null as BIOMETRY_TYPE | null,
});
const isFetchingBiometricsRef = { current: false };
export function useBiometrics(options?: { autoFetch?: boolean }) {
  const [biometrics, setBiometrics] = useAtom(biometricsInfo);

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
        if (prev.authEnabled && !supportedType) {
          toast.info(
            'Biometrics authentication disabled because no valid biometric data found.',
          );
        }
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
    };
  }, [biometrics]);

  return {
    biometrics,
    computed,
    fetchBiometrics,
    requestToggleBiometricsEnabled,
  };
}
