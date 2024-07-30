import { apisAutoLock, apisLock } from '@/core/apis';
import { autoLockEvent } from '@/core/apis/autoLock';
import { unlockTimeEvent } from '@/core/apis/lock';
import { atom, useAtom } from 'jotai';

const autoLockTimeAtom = atom(-1);
autoLockTimeAtom.onMount = setter => {
  autoLockEvent.addListener('change', value => {
    setter(value);
  });
};

export function useAutoLockTime() {
  const [time, setTime] = useAtom(autoLockTimeAtom);

  // const fetchTimeout = useCallback(() => {
  //   const value = apisAutoLock.getAutoLockTime();
  //   setTime(value);
  //   return value;
  // }, [setTime]);

  return {
    autoLockTime: time,
    // fetchTimeout,
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

  // const fetchLastUnlockTime = useCallback(() => {
  //   const value = apisLock.getUnlockTime();
  //   setTime(value);
  //   return value;
  // }, [setTime]);

  return {
    unlockTime: time,
    // fetchLastUnlockTime,
  };
}
