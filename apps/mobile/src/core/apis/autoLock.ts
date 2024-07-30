import { DEFAULT_AUTO_LOCK_MINUTES } from '@/constant/autoLock';
import { preferenceService } from '../services';
import { makeEEClass } from './event';

const MILLISECS_PER_MIN = 60 * 1e3;
const MILLISECS_PER_SEC = 1e3;

/** @warning never set the duration two short to avoid re-lock on unlocking */
const CHECK_DURATION = __DEV__ ? 5 * MILLISECS_PER_SEC : 10 * MILLISECS_PER_SEC;
const AUTO_LOCK_SECS = {
  ERROR_DELTA: __DEV__ ? 3 * MILLISECS_PER_SEC : 5 * MILLISECS_PER_SEC,
  TIMEOUT_MILLISECS: Math.floor(
    __DEV__
      ? 60 * MILLISECS_PER_MIN
      : DEFAULT_AUTO_LOCK_MINUTES * MILLISECS_PER_MIN,
  ),
};
function calc(ms: number = AUTO_LOCK_SECS.TIMEOUT_MILLISECS) {
  return Date.now() + ms;
}

const autoLockTimeRef = {
  current: calc(),
  timer: null as NodeJS.Timer | number | null,
};

type TimeoutContext = {
  unlockExpire: number;
  /**
   * @description the difference between the current time and the timeout value
   *
   * = now - timeoutValue
   */
  diff: number;
  delayLock: () => void;
};
const { EventEmitter: AutoLockEvent } = makeEEClass<{
  change: (time: number) => void;
  timeout: (ctx: TimeoutContext) => void;
}>();
export const autoLockEvent = new AutoLockEvent();

function setAutoLockTime(time: number) {
  autoLockTimeRef.current = time;
  autoLockEvent.emit('change', time);

  return time;
}

export function getAutoLockTime() {
  return autoLockTimeRef.current;
}

export function coerceAutoLockTimeout(ms: number) {
  const timeoutMs = Math.max(5 * MILLISECS_PER_SEC, ms);
  // keep decimals 2
  const minutes = parseFloat((ms / MILLISECS_PER_MIN).toFixed(2));

  return { timeoutMs, minutes };
}

export function getPersistedAutoLockTimes() {
  // enforce zero to default value
  const minutes =
    preferenceService.getPreference('autoLockTime') ||
    DEFAULT_AUTO_LOCK_MINUTES;

  const timeoutMs = minutes * MILLISECS_PER_MIN;

  return {
    ...coerceAutoLockTimeout(timeoutMs),
    expireTime: calc(timeoutMs),
  };
}

export function refreshAutolockTimeout(type?: 'clear') {
  const dispose = () => {
    if (autoLockTimeRef.timer) {
      clearTimeout(autoLockTimeRef.timer);
    }
  };

  dispose();

  if (type === 'clear') {
    setAutoLockTime(-1);
  } else {
    const { timeoutMs, expireTime } = getPersistedAutoLockTimes();
    setAutoLockTime(expireTime);
    autoLockTimeRef.timer = setTimeout(() => {
      const unlockExpire = getAutoLockTime();
      const diff = Date.now() - unlockExpire;

      console.debug(
        'refreshAutolockTimeout:: unlockExpire: %s; diff: %s',
        unlockExpire,
        diff,
      );
      if (unlockExpire && diff > -AUTO_LOCK_SECS.ERROR_DELTA) {
        const delayLock = () => refreshAutolockTimeout();
        autoLockEvent.emit('timeout', { unlockExpire, diff, delayLock });
      }
    }, timeoutMs);
  }

  return { dispose };
}

export function handleUnlock() {
  console.debug('apiAutoLocks::onUnlock');
  refreshAutolockTimeout();
}

export function handleLock() {
  refreshAutolockTimeout('clear');
}

// export function makeTimerProducer(lockHandler: (ctx: TimeoutContext) => void) {
//   const produceInterval = () => {
//     const timer = setInterval(() => {
//       const timeoutValue = getAutoLockTime();
//       const diff = Date.now() - timeoutValue;

//       if (timeoutValue > 0 && diff > 0) {
//         const delayLock = () => refreshAutolockTimeout();
//         lockHandler({ timeoutValue, diff, delayLock });
//       }
//     }, AUTO_LOCK_SECS.CHECK_DURATION);

//     return timer;
//   };

//   return {
//     produceInterval,
//   };
// }
