import { DEFAULT_AUTO_LOCK_MINUTES } from '@/constant/autoLock';
import { AppState, AppStateStatus } from 'react-native';
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
  current: calc(),
  timer: null as ReturnType<typeof setInterval> | null,
};
const autoLockAppStateRef = {
  current: AppState.currentState as AppStateStatus | null,
  backgroundAt: 0,
};

type TimeoutContext = {
  unlockExpire: number;
  delayLock: () => void;
};
const { EventEmitter: AutoLockEvent } = makeEEClass<{
  change: (expireTime: number) => void;
  timeout: (ctx: TimeoutContext) => void;
  triggerRefresh: () => void;
}>();
export const autoLockEvent = new AutoLockEvent();

function setAutoLockExpireTime(expireTime: number) {
  autoLockTimerRef.current = expireTime;
  autoLockEvent.emit('change', expireTime);

  return expireTime;
}

export function getAutoLockTime() {
  return autoLockTimerRef.current;
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

export function setupAutoLockChecker() {
  autoLockTimerRef.timer = setInterval(() => {
    const unlockExpire = getAutoLockTime();
    const nowTime = Date.now();
    if (!isValidAutoLockTime(unlockExpire)) return;

    const fromExpireDiff = nowTime - unlockExpire;

    // console.debug(
    //   'check auto lock:: unlockExpire: %s; fromExpireDiff: %s',
    //   unlockExpire,
    //   fromExpireDiff,
    // );
    if (fromExpireDiff >= -AUTO_LOCK_SECS.ERROR_DELTA) {
      console.debug('check auto lock:: timeout');
      const delayLock = () => refreshAutolockTimeout();
      autoLockEvent.emit('timeout', { unlockExpire, delayLock });
    }
  }, CHECK_DURATION);
}

function isInactiveState(nextState: AppStateStatus) {
  return nextState === 'inactive' || nextState === 'background';
}

function maybeAutoLockOnForeground() {
  const { timeoutMs } = getPersistedAutoLockTimes();
  if (!isValidAutoLockTime(timeoutMs)) return;

  const unlockExpire = getAutoLockTime();
  if (!isValidAutoLockTime(unlockExpire)) return;

  const now = Date.now();
  const backgroundAt = autoLockAppStateRef.backgroundAt;
  const backgroundDuration = backgroundAt > 0 ? now - backgroundAt : 0;

  const shouldLockByBackground = backgroundDuration >= timeoutMs;
  const shouldLockByExpire = now >= unlockExpire;

  if (shouldLockByBackground || shouldLockByExpire) {
    const delayLock = () => refreshAutolockTimeout();
    autoLockEvent.emit('timeout', { unlockExpire, delayLock });
  }
}

export function startSubscribeAutoLockOnAppState() {
  if (!AppState.isAvailable) return;

  autoLockAppStateRef.current = AppState.currentState;
  return AppState.addEventListener('change', nextState => {
    const prevState = autoLockAppStateRef.current;
    autoLockAppStateRef.current = nextState;

    if (isInactiveState(nextState)) {
      autoLockAppStateRef.backgroundAt = Date.now();
      return;
    }

    if (prevState && isInactiveState(prevState) && nextState === 'active') {
      maybeAutoLockOnForeground();
      autoLockAppStateRef.backgroundAt = 0;
    }
  });
}
