import { AppState } from 'react-native';

import { DEFAULT_AUTO_LOCK_MINUTES } from '@/constant/autoLock';
import { preferenceService } from '../services';
import { makeEEClass } from './event';

const MILLISECS_PER_MIN = 60 * 1e3;
const MILLISECS_PER_SEC = 1e3;

/** @warning never set the duration two short to avoid re-lock on unlocking */
const CHECK_DURATION = __DEV__ ? 1 * MILLISECS_PER_SEC : 3 * MILLISECS_PER_SEC;
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

const autoLockTimerRef = {
  foregroundExpire: calc(),
  backToForegroundExpire: null as null | number,
  timer: null as ReturnType<typeof setInterval> | null,
};

type TimeoutContext = {
  // unlockExpire: number;
  reason: 'foreground' | 'back-to-foreground';
  delayLock: () => void;
};
const { EventEmitter: AutoLockEvent } = makeEEClass<{
  change: (expireTime: number) => void;
  timeout: (ctx: TimeoutContext) => void;
  triggerRefresh: () => void;
}>();
export const autoLockEvent = new AutoLockEvent();

function setAutoLockExpireTime(expireTime: number) {
  autoLockTimerRef.foregroundExpire = expireTime;
  autoLockEvent.emit('change', expireTime);

  return expireTime;
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

const clearAutoLockChecker = () => {
  if (autoLockTimerRef.timer) {
    clearInterval(autoLockTimerRef.timer);
  }
};

export function refreshAutolockTimeout(type?: 'clear') {
  clearAutoLockChecker();

  if (type === 'clear') {
    setAutoLockExpireTime(-1);
  } else {
    const { expireTime } = getPersistedAutoLockTimes();
    setAutoLockExpireTime(expireTime);
    setupAutoLockChecker();
  }

  return { dispose: clearAutoLockChecker };
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

const checkExpire = (
  unlockExpire: number,
  reason: TimeoutContext['reason'],
) => {
  const nowTime = Date.now();
  // if (unlockExpire <= nowTime) return;

  const fromExpireDiff = nowTime - unlockExpire;

  // console.debug(
  //   'check auto lock:: unlockExpire: %s; fromExpireDiff: %s',
  //   unlockExpire,
  //   fromExpireDiff,
  // );
  if (fromExpireDiff > -AUTO_LOCK_SECS.ERROR_DELTA) {
    console.debug('check auto lock:: timeout');
    const delayLock = () => refreshAutolockTimeout();
    autoLockEvent.emit('timeout', { reason: reason, delayLock });
  }
};

export function setupAutoLockChecker() {
  autoLockTimerRef.timer = setInterval(() => {
    const unlockExpire = autoLockTimerRef.foregroundExpire;
    checkExpire(unlockExpire, 'foreground');
  }, CHECK_DURATION);

  const prevStateRef = {
    current: AppState.currentState,
  };
  AppState.addEventListener('change', state => {
    const prevState = prevStateRef.current;
    prevStateRef.current = state;
    if (prevState !== 'active' && state === 'active') {
      const backToForegroundExpire = autoLockTimerRef.backToForegroundExpire;
      if (!backToForegroundExpire) {
        return;
      }

      const unlockExpire = autoLockTimerRef.backToForegroundExpire;
      // console.debug('[autoLock] app back to foreground autoLockTimerRef, unlockExpire', autoLockTimerRef, unlockExpire);
      unlockExpire && checkExpire(unlockExpire, 'back-to-foreground');
    } else if (prevState === 'active' && state !== 'active') {
      // console.debug('[autoLock] app to background autoLockTimerRef', autoLockTimerRef);
      const { expireTime } = getPersistedAutoLockTimes();
      autoLockTimerRef.backToForegroundExpire = expireTime;
    }
  });
}
