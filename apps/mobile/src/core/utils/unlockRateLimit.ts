import { appStorage } from '../storage/mmkv';

// - if failed {limit} times, reject unlock for {duration} seconds
const MULTIPLE_FAILED_CONF = {
  key: '@failed_unlock',
  limit: __DEV__ ? 5 : 999, // set a very high limit in production to disable the feature temporarily
  duration: __DEV__ ? 6 * 1000 : 5 * 60 * 1000,
};

/**
 * @description
 *
 * - `count` means the failed attempts.
 * - `time` means the time when the unlocking will be allowed.
 */
type FAILED_FREEZING_INFO = {
  count: number;
  /**
   * @description used to check if warn up
   */
  expireTimeUTC0: number;
  /**
   * @description on bootstrap, used to validate if keeping freezing state on last-time
   *
   *
   */
  lastTimeCountdown: number;
};
const GET_DFLT_FAILED_STATE = () => ({
  count: 0,
  expireTimeUTC0: 0,
  lastTimeCountdown: 0,
});
function getMultipleFailed() {
  const val = appStorage.getItem(MULTIPLE_FAILED_CONF.key);

  return {
    ...GET_DFLT_FAILED_STATE(),
    ...val,
  } as FAILED_FREEZING_INFO;
}
function setMultipleFailed(partials?: Partial<FAILED_FREEZING_INFO>) {
  appStorage.setItem(MULTIPLE_FAILED_CONF.key, {
    ...GET_DFLT_FAILED_STATE(),
    ...partials,
  });
}
function reCountdown(options: {
  restCountdown: number;
  nowMS: number;
  keepCount?: boolean;
}) {
  const { restCountdown, nowMS = Date.now(), keepCount } = options;

  const lastTimeCountdown = Math.min(
    MULTIPLE_FAILED_CONF.duration,
    Math.max(0, restCountdown),
  );

  const stored = getMultipleFailed();
  setMultipleFailed({
    ...(keepCount &&
      stored.count && {
        count: stored.count,
      }),
    lastTimeCountdown: lastTimeCountdown,
    expireTimeUTC0: nowMS + lastTimeCountdown,
  });

  return getMultipleFailed();
}
export function checkMultipleFailed(options?: {
  forceRecountdownIfInFreezing?: boolean;
}) {
  const record = getMultipleFailed();

  const { forceRecountdownIfInFreezing = false } = options || {};

  const nowMS = Date.now();

  if (forceRecountdownIfInFreezing && record.expireTimeUTC0 >= nowMS) {
    return reCountdown({ restCountdown: record.lastTimeCountdown, nowMS });
  } else if (record.expireTimeUTC0 >= nowMS) {
    record.count = 0;
    record.lastTimeCountdown = Math.max(0, record.expireTimeUTC0 - nowMS);
  } else if (record.count >= MULTIPLE_FAILED_CONF.limit) {
    return reCountdown({ restCountdown: MULTIPLE_FAILED_CONF.duration, nowMS });
  } else {
    record.count += 1;
    record.lastTimeCountdown = Math.max(0, record.expireTimeUTC0 - nowMS);
  }

  setMultipleFailed(record);
}
export function resetMultipleFailed() {
  appStorage.setItem(MULTIPLE_FAILED_CONF.key, GET_DFLT_FAILED_STATE());
}
export function shouldRejectUnlockDueToMultipleFailed() {
  const record = getMultipleFailed();
  const result = {
    timeDiff: 0,
    reject: false,
  };
  if (!record?.expireTimeUTC0) return result;

  const nowMS = Date.now();
  const newRecord = reCountdown({
    keepCount: true,
    nowMS,
    restCountdown: Math.max(0, record.expireTimeUTC0 - nowMS),
  });

  result.timeDiff = newRecord.lastTimeCountdown;
  result.reject = newRecord.lastTimeCountdown > 0;

  return result;
}

(function onBootstrap() {
  const record = getMultipleFailed();

  // seems expire but lastTimeCountdown is not empty, maybe system time changed before app bootstraped
  if (record.expireTimeUTC0 <= Date.now() && record.lastTimeCountdown) {
    console.debug(
      '[unlockRateLimit::onBootstrap] find last-time unfinished countdown, re-countdown.',
    );
    reCountdown({ restCountdown: record.lastTimeCountdown, nowMS: Date.now() });
  } else {
    // trigger once check
    shouldRejectUnlockDueToMultipleFailed();
  }
})();
