import { apisAutoLock, apisLock } from '@/core/apis';
import { autoLockEvent } from '@/core/apis/autoLock';
import { unlockTimeEvent } from '@/core/apis/lock';
import { zCreate } from '@/core/utils/reexports';
import { resolveValFromUpdater, UpdaterOrPartials } from '@/core/utils/store';
import { useShallow } from 'zustand/react/shallow';
import { runIIFEFunc } from '@/core/utils/store';

const autoLockTimeStore = zCreate<{
  time: number;
}>(() => ({
  time: -1,
}));

function setAutoLockTime(valOrFunc: UpdaterOrPartials<number>) {
  autoLockTimeStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev.time, valOrFunc);
    return { ...prev, time: newVal };
  });
}

runIIFEFunc(() => {
  autoLockEvent.addListener('change', value => {
    setAutoLockTime(value);
  });
});

export function useAutoLockTime() {
  const { time } = autoLockTimeStore(useShallow(s => s));

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

const unlockTimeStore = zCreate<{
  time: number;
}>(() => ({
  time: apisLock.getUnlockTime(),
}));

function setUnlockTime(valOrFunc: UpdaterOrPartials<number>) {
  unlockTimeStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev.time, valOrFunc);
    return { ...prev, time: newVal };
  });
}

runIIFEFunc(() => {
  unlockTimeEvent.addListener('updated', time => {
    setUnlockTime(time);
  });
});

export function useLastUnlockedAuth() {
  const { time } = unlockTimeStore(useShallow(s => s));

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
