import { useCallback } from 'react';
import { atom, useAtom } from 'jotai';
import { apisLock } from '@/core/apis';
import { useAtomRefState } from '@/hooks/common/useRefState';
import { atomByMMKV } from '@/core/storage/mmkv';
import { useBiometrics } from '@/hooks/biometrics';
import { toast } from '@/components/Toast';
import { Alert } from 'react-native';
import { IS_IOS } from '@/core/native/utils';

export enum UNLOCK_STATE {
  IDLE = 0,
  UNLOCKING = 1,
}
const unlockStateAtom = atom({
  hasLeftFromUnlock: false,
  status: UNLOCK_STATE.IDLE,
});
export function useUnlockApp() {
  const {
    atomState,
    stateRef,
    setAtomRefState: setUnlockState,
  } = useAtomRefState(unlockStateAtom);

  const unlockApp = useCallback(
    async (password: string) => {
      if (stateRef.current.status !== UNLOCK_STATE.IDLE) return { error: '' };

      setUnlockState(prev => ({ ...prev, status: UNLOCK_STATE.UNLOCKING }));

      try {
        return await apisLock.unlockWallet(password);
      } finally {
        setUnlockState(prev => ({ ...prev, status: UNLOCK_STATE.IDLE }));
      }
    },
    [stateRef, setUnlockState],
  );

  const afterLeaveFromUnlock = useCallback(() => {
    setUnlockState(prev => ({ ...prev, hasLeftFromUnlock: true }));
  }, [setUnlockState]);

  return {
    isUnlocking: atomState.status === UNLOCK_STATE.UNLOCKING,
    hasLeftFromUnlock: atomState.hasLeftFromUnlock,
    afterLeaveFromUnlock,
    unlockApp,
  };
}

const hasTipedUserEnableBiometricsAtom = atomByMMKV(
  '@hasTipedUserEnableBiometrics',
  false,
);
export function useResetHasTipedUserEnableBiometrics() {
  const [, setHasTipedUserEnableBiometrics] = useAtom(
    hasTipedUserEnableBiometricsAtom,
  );

  const resetHasTipedUserEnableBiometrics = useCallback(() => {
    setHasTipedUserEnableBiometrics(false);
  }, [setHasTipedUserEnableBiometrics]);

  return {
    resetHasTipedUserEnableBiometrics,
  };
}
export function useTipedUserEnableBiometrics() {
  const [hasTipedUserEnableBiometrics, setHasTipedUserEnableBiometrics] =
    useAtom(hasTipedUserEnableBiometricsAtom);
  const { computed, toggleBiometrics } = useBiometrics();

  const shouldTipedUserEnableBiometrics =
    !hasTipedUserEnableBiometrics &&
    computed.couldSetupBiometrics &&
    !computed.settingsAuthEnabled;

  const tipEnableBiometrics = useCallback(
    async (password: string) => {
      const result = { success: false, passed: false };
      if (!shouldTipedUserEnableBiometrics) return result;

      const promise = new Promise<typeof result>((resolve, reject) => {
        Alert.alert(
          `Enable ${computed.defaultTypeLabel}`,
          IS_IOS ? '' : `You can also enable it on Settings later`,
          [
            {
              text: 'No',
              style: 'cancel',
              onPress: () => {
                resolve({ ...result, passed: true });
              },
            },
            {
              text: 'Yes',
              onPress: async () => {
                try {
                  await apisLock.throwErrorIfInvalidPwd(password);
                  toggleBiometrics(true, {
                    validatedPassword: password,
                  });
                  resolve({ ...result, passed: true });
                } catch (error: any) {
                  toast.show(error?.message || 'Invalid password');
                  resolve(result);
                }
              },
            },
          ],
        );
      });

      return promise.then(
        result => result.passed && setHasTipedUserEnableBiometrics(true),
      );
    },
    [
      shouldTipedUserEnableBiometrics,
      setHasTipedUserEnableBiometrics,
      toggleBiometrics,
      computed.defaultTypeLabel,
    ],
  );

  return {
    tipEnableBiometrics,
  };
}
