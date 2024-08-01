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
        return apisLock.unlockWalletWithUpdateUnlockTime(password);
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
      const result = {
        needAlert: shouldTipedUserEnableBiometrics,
        success: false,
        passed: false,
      };
      if (!shouldTipedUserEnableBiometrics) return result;

      const action = async () => {
        try {
          await apisLock.throwErrorIfInvalidPwd(password);
          toggleBiometrics(true, {
            validatedPassword: password,
          });
          setHasTipedUserEnableBiometrics(true);
          return { ...result, passed: true };
        } catch (error: any) {
          toast.show(error?.message || 'Invalid password');
          return result;
        }
      };

      return new Promise<typeof result>((resolve, reject) => {
        Alert.alert(
          `Enable ${computed.defaultTypeLabel}`,
          `Enable ${computed.defaultTypeLabel} to Unlock Rabby Wallet`,
          [
            {
              text: 'No',
              style: 'cancel',
              onPress: () => {
                setHasTipedUserEnableBiometrics(true);
                resolve({ ...result, passed: true });
              },
            },
            {
              text: 'Yes',
              onPress: async () => {
                resolve(action());
              },
            },
          ],
        );
      });
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
