import { apisAutoLock, apisLock } from '@/core/apis';
import { autoLockEvent } from '@/core/apis/autoLock';
import { unlockTimeEvent } from '@/core/apis/lock';
import { atom, useAtom } from 'jotai';
import { useCallback } from 'react';

const autoLockTimeoutAtom = atom(-1);
autoLockTimeoutAtom.onMount = setter => {
  autoLockEvent.addListener('change', value => {
    setter(value);
  });
};

export function useAutoLockTimeout() {
  const [timeout, setTimeout] = useAtom(autoLockTimeoutAtom);

  const fetchTimeout = useCallback(() => {
    const value = apisAutoLock.getAutoLockTime();
    setTimeout(value);
    return value;
  }, [setTimeout]);

  return {
    autoLockTimeout: timeout,
    fetchTimeout,
  };
}

const unlockTimeAtom = atom(apisLock.getUnlockTime());
unlockTimeAtom.onMount = setter => {
  unlockTimeEvent.addListener('updated', time => {
    setter(time);
  });
};

export function useLastUnlockTime() {
  const [time, setTime] = useAtom(unlockTimeAtom);

  const fetchTimeout = useCallback(() => {
    const value = apisLock.getUnlockTime();
    setTime(value);
    return value;
  }, [setTime]);

  return {
    unlockTime: time,
    fetchTimeout,
  };
}
