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

export function isValidAutoLockTime(ms: number) {
  return ms > 0;
}
function calc(ms: number = AUTO_LOCK_SECS.TIMEOUT_MILLISECS) {
  if (!isValidAutoLockTime(ms)) return -1;
  return Date.now() + ms;
}

const autoLockTimeRef = {
  current: calc(),
  timer: null as ReturnType<typeof setTimeout> | null,
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
  change: (expireTime: number) => void;
  timeout: (ctx: TimeoutContext) => void;
  triggerRefresh: () => void;
}>();
export const autoLockEvent = new AutoLockEvent();

function setAutoLockExpireTime(expireTime: number) {
  autoLockTimeRef.current = expireTime;
  autoLockEvent.emit('change', expireTime);

  return expireTime;
}

export function getAutoLockTime() {
  return autoLockTimeRef.current;
}

export function coerceAutoLockTimeout(ms: number) {
  if (!isValidAutoLockTime(ms)) {
    return {
      timeoutMs: -1,
      minutes: -1,
    };
  }

  const ret = {
    timeoutMs: -1,
    minutes: parseFloat((ms / MILLISECS_PER_MIN).toFixed(2)),
  };
  const secs = Math.floor(Math.floor(ret.minutes * 60));
  ret.timeoutMs = parseFloat((secs * MILLISECS_PER_SEC).toFixed(0));

  return ret;
}

export function getPersistedAutoLockTimes() {
  // enforce zero to default value
  const minutes =
    preferenceService.getPreference('autoLockTime') ||
    DEFAULT_AUTO_LOCK_MINUTES;

  const formatted = coerceAutoLockTimeout(minutes * MILLISECS_PER_MIN);

  return {
    ...formatted,
    expireTime: calc(formatted.timeoutMs),
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
    setAutoLockExpireTime(-1);
  } else {
    const { minutes, timeoutMs, expireTime } = getPersistedAutoLockTimes();
    setAutoLockExpireTime(expireTime);
    autoLockTimeRef.timer = !isValidAutoLockTime(timeoutMs)
      ? null
      : setTimeout(() => {
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

export function uiRefreshTimeout() {
  autoLockEvent.emit('triggerRefresh');
}

export function handleUnlock() {
  console.debug('apiAutoLocks::onUnlock');
  refreshAutolockTimeout();
}

export function handleLock() {
  refreshAutolockTimeout('clear');
}
