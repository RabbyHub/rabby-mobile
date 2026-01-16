import { DEFAULT_AUTO_LOCK_MINUTES } from '@/constant/autoLock';
import { apisAutoLock, apisLock } from '@/core/apis';
import { autoLockEvent } from '@/core/apis/autoLock';
import { unlockTimeEvent } from '@/core/apis/lock';
import { preferenceService } from '@/core/services';
import { zCreate } from '@/core/utils/reexports';
import {
  resolveValFromUpdater,
  runIIFEFunc,
  UpdaterOrPartials,
} from '@/core/utils/store';
import { atom, useAtom } from 'jotai';
import { useShallow } from 'zustand/react/shallow';

type AppTimeoutState = {
  autoLockTime: number;
  minutes: number;
};
const autoLockStore = zCreate<AppTimeoutState>(() => {
  return {
    autoLockTime: -1,
    minutes:
      apisAutoLock.getPersistedAutoLockTimes()?.minutes ||
      DEFAULT_AUTO_LOCK_MINUTES,
  };
});

runIIFEFunc(() => {
  const times = apisAutoLock.getPersistedAutoLockTimes();
  setAutoLockMinutes(times.minutes);

  autoLockEvent.addListener('change', value => {
    autoLockStore.setState({ autoLockTime: value });
  });
});

function setAutoLockMinutes(valOrFunc: UpdaterOrPartials<number>) {
  autoLockStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev.minutes, valOrFunc);

    return { ...prev, minutes: newVal };
  });
}

export function getAutoLockExpireTime() {
  return autoLockStore.getState().autoLockTime;
}

export function useAutoLockTime() {
  const { autoLockTime, timeoutMs } = autoLockStore(
    useShallow(s => ({
      autoLockTime: s.autoLockTime,
      timeoutMs: !apisAutoLock.isValidAutoLockTime(s.minutes)
        ? -1
        : apisAutoLock.coerceAutoLockTimeout(s.minutes * 60 * 1e3).timeoutMs,
    })),
  );

  return { devNeedCountdown: autoLockTime >= 0, autoLockTime, timeoutMs };
}

export const onAutoLockTimeMsChange = (ms: number) => {
  const minutes = apisAutoLock.coerceAutoLockTimeout(ms).minutes;
  setAutoLockMinutes(minutes);
  preferenceService.setPreference({
    autoLockTime: minutes,
  });
  apisAutoLock.refreshAutolockTimeout();
};

const unlockTimeAtom = atom(apisLock.getUnlockTime());
unlockTimeAtom.onMount = setter => {
  unlockTimeEvent.addListener('updated', time => {
    setter(time);
  });
};

export function useLastUnlockedAuth() {
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
