import { useCallback } from 'react';
import { apisLock } from '@/core/apis';
import { MMKVStorageStrategy, zustandByMMKV } from '@/core/storage/mmkv';
import { useBiometrics } from '@/hooks/biometrics';
import { toast } from '@/components/Toast';
import { Alert } from 'react-native';
import { UnlockResultErrors } from '@/core/apis/lock';
import { t } from 'i18next';
import { zCreate } from '@/core/utils/reexports';
import { resolveValFromUpdater, UpdaterOrPartials } from '@/core/utils/store';
import { useShallow } from 'zustand/react/shallow';

export enum UNLOCK_STATE {
  IDLE = 0,
  UNLOCKING = 1,
}

type UnlockState = {
  /** @deprecated */
  hasLeftFromUnlock: boolean;
  status: UNLOCK_STATE;
};
const unlockStateStore = zCreate<UnlockState>(() => ({
  hasLeftFromUnlock: false,
  status: UNLOCK_STATE.IDLE,
}));

function setUnlockState(valOrFunc: UpdaterOrPartials<UnlockState>) {
  unlockStateStore.setState(prev => {
    const { newVal, changed } = resolveValFromUpdater(prev, valOrFunc, {
      strict: true,
    });

    if (!changed) return prev;

    return newVal;
  });
}

const unlockApp = async (password: string) => {
  if (unlockStateStore.getState().status !== UNLOCK_STATE.IDLE)
    return { error: '' } as UnlockResultErrors;

  setUnlockState(prev => ({ ...prev, status: UNLOCK_STATE.UNLOCKING }));

  try {
    return await apisLock.unlockWalletWithUpdateUnlockTime(password);
  } finally {
    setUnlockState(prev => ({ ...prev, status: UNLOCK_STATE.IDLE }));
  }
};

const afterLeaveFromUnlock = () => {
  setUnlockState(prev => ({ ...prev, hasLeftFromUnlock: true }));
};

export const storeApisUnlock = {
  unlockApp,
  afterLeaveFromUnlock,
};

export function useUnlockApp() {
  const { isUnlocking, hasLeftFromUnlock } = unlockStateStore(
    useShallow(s => ({
      isUnlocking: s.status === UNLOCK_STATE.UNLOCKING,
      hasLeftFromUnlock: s.hasLeftFromUnlock,
    })),
  );

  return {
    isUnlocking,
    hasLeftFromUnlock,
  };
}

const hasTipedUserEnableBiometricsStore = zustandByMMKV(
  '@hasTipedUserEnableBiometrics',
  { hasTipedUserEnableBiometrics: false },
  {
    storage: MMKVStorageStrategy.compatJson,
    migrateFromAtom: ctx => {
      const migrated = {
        state: { hasTipedUserEnableBiometrics: !!ctx.oldData },
        version: 0,
      };

      return { migrated: migrated.state };
    },
  },
);

function setHasTipedUserEnableBiometrics(
  valOrFunc: UpdaterOrPartials<boolean>,
) {
  hasTipedUserEnableBiometricsStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(
      prev.hasTipedUserEnableBiometrics,
      valOrFunc,
    );

    return { ...prev, hasTipedUserEnableBiometrics: newVal };
  });
}

export function resetHasTipedUserEnableBiometrics() {
  setHasTipedUserEnableBiometrics(false);
}

export function useTipedUserEnableBiometrics() {
  const hasTipedUserEnableBiometrics = hasTipedUserEnableBiometricsStore(
    s => s.hasTipedUserEnableBiometrics,
  );
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
          t('page.unlock.biometrics.enableBiometricAlert.title', {
            bioType: computed.defaultTypeLabel,
          }),
          t('page.unlock.biometrics.enableBiometricAlert.content', {
            bioType: computed.defaultTypeLabel,
          }),
          [
            {
              text: t('page.unlock.biometrics.enableBiometricAlert.no'),
              style: 'cancel',
              onPress: () => {
                setHasTipedUserEnableBiometrics(true);
                resolve({ ...result, passed: true });
              },
            },
            {
              text: t('page.unlock.biometrics.enableBiometricAlert.yes'),
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
      toggleBiometrics,
      computed.defaultTypeLabel,
    ],
  );

  return {
    tipEnableBiometrics,
  };
}
