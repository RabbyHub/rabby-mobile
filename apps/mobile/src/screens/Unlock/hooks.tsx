import { useCallback } from 'react';
import { atom } from 'jotai';
import { apisLock } from '@/core/apis';
import { useAtomRefState } from '@/hooks/common/useRefState';

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
