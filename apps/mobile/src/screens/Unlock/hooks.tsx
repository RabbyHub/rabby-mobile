import React, { useCallback } from 'react';
import { atom } from 'jotai';
import { apisLock } from '@/core/apis';
import { toast, toastWithIcon } from '@/components/Toast';
import { ActivityIndicator } from 'react-native';
import { useAtomRefState } from '@/hooks/common/useRefState';

function toastUnlocking() {
  return toastWithIcon(() => <ActivityIndicator style={{ marginRight: 6 }} />)(
    `Unlocking`,
    {
      duration: 1e6,
      position: toast.positions.CENTER,
      hideOnPress: false,
    },
  );
}

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
    async (password: string, options?: { showLoading?: boolean }) => {
      if (stateRef.current.status !== UNLOCK_STATE.IDLE) return { error: '' };

      setUnlockState(prev => ({ ...prev, status: UNLOCK_STATE.UNLOCKING }));

      const { showLoading = true } = options || {};

      const hideToast = showLoading ? null : toastUnlocking();

      try {
        return await apisLock.unlockWallet(password);
      } finally {
        hideToast?.();
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
