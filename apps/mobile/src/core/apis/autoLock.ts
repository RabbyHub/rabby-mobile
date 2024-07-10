import EventEmitter from 'events';
import { makeEEClass } from './event';

const MILLISECS_PER_MIN = 60 * 1e3;
const MILLISECS_PER_SEC = 1e3;

/** @warning never set the duration two short to avoid re-lock on unlocking */
// const CHECK_DURATION = __DEV__ ? 5 * MILLISECS_PER_SEC : 30 * MILLISECS_PER_SEC
const AUTO_LOCK_SECS = {
  ERROR_DELTA: __DEV__ ? 1 * MILLISECS_PER_SEC : 5 * MILLISECS_PER_SEC,
  TIMEOUT_MILLISECS: Math.floor(
    __DEV__ ? 1.5 * MILLISECS_PER_MIN : 5 * MILLISECS_PER_MIN,
  ),
  // CHECK_DURATION,
};
function calc() {
  return Date.now() + AUTO_LOCK_SECS.TIMEOUT_MILLISECS;
}

const autoLockTimeoutRef = {
  current: calc(),
  timer: null as NodeJS.Timer | number | null,
};

type TimeoutContext = {
  timeoutValue: number;
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
  autoLockTimeoutRef.current = time;
  autoLockEvent.emit('change', time);

  return time;
}

export function getAutoLockTime() {
  return autoLockTimeoutRef.current;
}

export function refreshAutolockTimeout(type?: 'clear') {
  const dispose = () => {
    if (autoLockTimeoutRef.timer) {
      clearTimeout(autoLockTimeoutRef.timer);
    }
  };

  dispose();

  if (type === 'clear') {
    setAutoLockTime(-1);
  } else {
    setAutoLockTime(calc());
    autoLockTimeoutRef.timer = setTimeout(() => {
      const timeoutValue = getAutoLockTime();
      const diff = Date.now() - timeoutValue;

      console.debug(
        'refreshAutolockTimeout:: timeoutValue: %s; diff: %s',
        timeoutValue,
        diff,
      );
      if (timeoutValue && diff > -AUTO_LOCK_SECS.ERROR_DELTA) {
        const delayLock = () => refreshAutolockTimeout();
        autoLockEvent.emit('timeout', { timeoutValue, diff, delayLock });
      }
    }, AUTO_LOCK_SECS.TIMEOUT_MILLISECS);
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
