import { AuthenticationModal } from '@/components/AuthenticationModal/AuthenticationModal';
import { toast } from '@/components/Toast';
import { apiKeyring, apisKeychain, apisLock } from '@/core/apis';
import {
  KEYCHAIN_AUTH_TYPES,
  isAuthenticatedByBiometrics,
} from '@/core/apis/keychain';
import { strings } from '@/utils/i18n';
import { atom, useAtom, useAtomValue } from 'jotai';
import { useCallback, useEffect } from 'react';
import { BIOMETRY_TYPE } from 'react-native-keychain';

const biometricsInfo = atom({
  authEnabled: isAuthenticatedByBiometrics(),
  supportedBiometryType: null as BIOMETRY_TYPE | null,
  // encryptedVault: '',
});

export function useIsAuthBiometrics() {
  const { authEnabled } = useAtomValue(biometricsInfo);

  return { biometricsEnabled: authEnabled };
}

export function useBiometricsInfo(options?: { autoFetch?: boolean }) {
  const [biometrics, setBiometrics] = useAtom(biometricsInfo);

  const fetchBiometrics = useCallback(async () => {
    try {
      let supportedType = null as null | BIOMETRY_TYPE;
      try {
        supportedType = await apisKeychain.getSupportedBiometryType();
      } catch (error) {
        console.error(error);
      }
      setBiometrics(prev => ({
        ...prev,
        supportedBiometryType: supportedType,
        authEnabled: isAuthenticatedByBiometrics(),
      }));
    } catch (error) {
      console.error(error);
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
          try {
            if (nextEnabled) {
              await apisKeychain.setGenericPassword(validatedPassword);
            } else {
              await apisKeychain.resetGenericPassword();
            }

            await fetchBiometrics();
          } catch (error: any) {
            toast.show(error.message);
          }
        },
      });
    },
    [fetchBiometrics],
  );

  useEffect(() => {
    if (options?.autoFetch) {
      fetchBiometrics();
    }
  }, [options?.autoFetch, fetchBiometrics]);

  return {
    biometrics,
    requestToggleBiometricsEnabled,
  };
}
