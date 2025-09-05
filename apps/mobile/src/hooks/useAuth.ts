import { AuthenticationModal2024 } from '@/components/AuthenticationModal/AuthenticationModal2024';
import { apisKeychain, apisLock } from '@/core/apis';
import { RequestGenericPurpose } from '@/core/apis/keychain';
import { updateUnlockTime } from '@/core/apis/lock';
import { useBiometrics } from '@/hooks/biometrics';
import { useMemoizedFn } from 'ahooks';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

export const useAuth = (params?: {
  onFinished?: () => void;
  onCancel?: () => void;
  onBeforeAuth?: () => void;
  authTitle?: string;
  syncUnlockTime?: boolean;
}) => {
  const {
    onFinished: _onFinished,
    onBeforeAuth,
    onCancel,
    authTitle,
    syncUnlockTime,
  } = params || {};

  const { t } = useTranslation();
  const {
    computed: { isBiometricsEnabled, isFaceID },
  } = useBiometrics({ autoFetch: true });

  const onFinished = useCallback(() => {
    if (syncUnlockTime) {
      updateUnlockTime();
    }
    _onFinished?.();
  }, [syncUnlockTime, _onFinished]);

  const validationHandler = password => {
    return apisLock.throwErrorIfInvalidPwd(password);
  };
  const unlockWithBiometrics = useMemoizedFn(async () => {
    onBeforeAuth?.();
    return new Promise(async (resolve, reject) => {
      if (!isBiometricsEnabled) {
        AuthenticationModal2024.show({
          title: authTitle || 'Enter the Password to Confirm',
          authType: ['password'],
          onFinished: () => {
            onFinished?.();
            resolve(true);
          },
          onCancel: () => {
            onCancel?.();
            reject();
          },
          validationHandler(password) {
            return apisLock.throwErrorIfInvalidPwd(password);
          },
        });
      }
      try {
        await apisKeychain.requestGenericPassword({
          purpose: RequestGenericPurpose.DECRYPT_PWD,
          onPlainPassword: async password => {
            await validationHandler?.(password);
            onFinished?.();
            resolve(true);
          },
        });
      } catch (error: any) {
        if (__DEV__) {
          console.error(error);
        }
        AuthenticationModal2024.show({
          title: authTitle || 'Enter the Password to Confirm',
          authType: ['password'],
          onFinished: () => {
            onFinished?.();
            resolve(true);
          },
          onCancel: () => {
            onCancel?.();
            reject();
          },
          validationHandler(password) {
            return apisLock.throwErrorIfInvalidPwd(password);
          },
        });
      }
    });
  });

  return unlockWithBiometrics;
};
