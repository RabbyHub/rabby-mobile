import { appStorage } from '../storage/mmkv';

// - if failed 5 times, reject unlock for 5 minutes
const MULTIPLE_FAILED_CONF = {
  key: '@failed_unlock',
  limit: 5,
  duration: (5 * 60 + 30) * 1000,
};

/**
 * @description
 *
 * - `count` means the failed attempts.
 * - `time` means the time when the unlocking will be allwed.
 */
type FAILED_LOCK_INFO = { count: number; time: number };
function getMultipleFailed() {
  const val = appStorage.getItem(MULTIPLE_FAILED_CONF.key);

  return {
    count: 0,
    time: 0,
    ...val,
  } as FAILED_LOCK_INFO;
}
export function setMultipleFailed() {
  const record = getMultipleFailed();

  const now = Date.now();
  if (record.time >= now) {
    record.count = 0;
  } else if (record.count >= MULTIPLE_FAILED_CONF.limit) {
    record.time = now + MULTIPLE_FAILED_CONF.duration;
  } else {
    record.count += 1;
  }

  appStorage.setItem(MULTIPLE_FAILED_CONF.key, record);
}
export function resetMultipleFailed() {
  appStorage.setItem(MULTIPLE_FAILED_CONF.key, { count: 0, time: 0 });
}
export function shouldRejectUnlockDueToMultipleFailed() {
  const record = getMultipleFailed();
  const result = {
    reject: false,
    timeDiff: 0,
  };
  if (!record?.time) return result;

  const now = Date.now();
  if (record.time > now) {
    result.timeDiff = record.time - now;
    result.reject = true;
  }

  return result;
}
