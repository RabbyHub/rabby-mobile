export type HomeProjectionInvalidation =
  | 'account'
  | 'balance'
  | 'change24h'
  | 'curve';

export type HomeProjectionSyncPlan = {
  account: boolean;
  balance: boolean;
  change24h: boolean;
  curve: boolean;
};

type SchedulerOptions = {
  onFlush: (plan: HomeProjectionSyncPlan) => void;
  minIntervalMs?: number;
  now?: () => number;
  scheduleTimer?: (callback: () => void, delayMs: number) => void;
  scheduleFrame?: (callback: () => void) => void;
};

const ALL_INVALIDATIONS: HomeProjectionInvalidation[] = [
  'account',
  'balance',
  'change24h',
  'curve',
];

export const HOME_PROJECTION_SYNC_MIN_INTERVAL_MS = 120;

function addInvalidations(
  target: Set<HomeProjectionInvalidation>,
  invalidations: HomeProjectionInvalidation[],
) {
  invalidations.forEach(invalidation => {
    if (invalidation === 'account') {
      ALL_INVALIDATIONS.forEach(item => target.add(item));
      return;
    }

    target.add(invalidation);
  });
}

function buildPlanFromInvalidations(
  invalidations: Set<HomeProjectionInvalidation>,
): HomeProjectionSyncPlan {
  return {
    account: invalidations.has('account'),
    balance: invalidations.has('balance'),
    change24h: invalidations.has('change24h'),
    curve: invalidations.has('curve'),
  };
}

export function buildHomeProjectionSyncPlan(
  invalidations: HomeProjectionInvalidation[],
): HomeProjectionSyncPlan {
  const normalized = new Set<HomeProjectionInvalidation>();
  addInvalidations(normalized, invalidations);

  return buildPlanFromInvalidations(normalized);
}

export function createHomeProjectionScheduler(options: SchedulerOptions) {
  const minIntervalMs =
    options.minIntervalMs ?? HOME_PROJECTION_SYNC_MIN_INTERVAL_MS;
  const now = options.now ?? Date.now;
  const scheduleTimer =
    options.scheduleTimer ??
    ((callback: () => void, delayMs: number) => {
      setTimeout(callback, delayMs);
    });
  const scheduleFrame =
    options.scheduleFrame ??
    ((callback: () => void) => {
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(callback);
        return;
      }

      callback();
    });

  const pendingInvalidations = new Set<HomeProjectionInvalidation>();
  let isScheduled = false;
  let lastFlushedAt = 0;

  const flush = () => {
    isScheduled = false;

    if (!pendingInvalidations.size) {
      return;
    }

    const plan = buildPlanFromInvalidations(pendingInvalidations);
    pendingInvalidations.clear();
    lastFlushedAt = now();
    options.onFlush(plan);
  };

  const schedulePending = () => {
    if (isScheduled || !pendingInvalidations.size) {
      return;
    }

    isScheduled = true;
    const scheduledAt = now();
    const elapsedSinceLastFlush = lastFlushedAt
      ? scheduledAt - lastFlushedAt
      : minIntervalMs;
    const delayMs = Math.max(0, minIntervalMs - elapsedSinceLastFlush);
    const runOnFrame = () => scheduleFrame(flush);

    if (delayMs > 0) {
      scheduleTimer(runOnFrame, delayMs);
      return;
    }

    runOnFrame();
  };

  return {
    schedule(...invalidations: HomeProjectionInvalidation[]) {
      addInvalidations(pendingInvalidations, invalidations);
      schedulePending();
    },
    flushNow(...invalidations: HomeProjectionInvalidation[]) {
      addInvalidations(pendingInvalidations, invalidations);
      flush();
    },
  };
}
