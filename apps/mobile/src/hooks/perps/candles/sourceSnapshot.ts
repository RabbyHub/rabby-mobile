import type { PerpsCandleDataInterval } from '@/constant/perps';
import { apisPerps } from '@/core/apis/perps';

import { parsePerpsCandles, type PerpsCandle } from './candle';
import {
  getPerpsCandleHistoryStartTime,
  getPerpsCandleSource,
} from './interval';

export type PerpsCandleSourceSnapshot = {
  candles: PerpsCandle[];
  identity: string;
  loadedAt: number;
};

const PERPS_CANDLE_PRELOAD_TTL_MS = 15_000;
const PERPS_CANDLE_PRELOAD_CACHE_SIZE = 24;
const PERPS_CANDLE_PREFETCH_CONCURRENCY = 2;
const snapshotCache = new Map<string, PerpsCandleSourceSnapshot>();
const pendingSnapshots = new Map<
  string,
  {
    startedAt: number;
    promise: Promise<PerpsCandleSourceSnapshot>;
  }
>();

export const getPerpsCandleSourceIdentity = (
  coin: string,
  interval: PerpsCandleDataInterval,
) => `${coin}:${interval}`;

export const isPerpsCandleSourceSnapshotFresh = (
  snapshot: PerpsCandleSourceSnapshot,
) => Date.now() - snapshot.loadedAt <= PERPS_CANDLE_PRELOAD_TTL_MS;

/** Read without starting a request. Stale snapshots are never used as a new baseline. */
export const readPerpsCandleSourceSnapshot = (
  coin: string,
  interval: PerpsCandleDataInterval,
) => {
  const snapshot = snapshotCache.get(
    getPerpsCandleSourceIdentity(coin, interval),
  );
  return snapshot && isPerpsCandleSourceSnapshotFresh(snapshot)
    ? snapshot
    : null;
};

const pruneSnapshotCache = () => {
  snapshotCache.forEach((snapshot, identity) => {
    if (!isPerpsCandleSourceSnapshotFresh(snapshot)) {
      snapshotCache.delete(identity);
    }
  });
  if (snapshotCache.size < PERPS_CANDLE_PRELOAD_CACHE_SIZE) {
    return;
  }
  const oldestIdentity = Array.from(snapshotCache.entries()).sort(
    ([, left], [, right]) => left.loadedAt - right.loadedAt,
  )[0]?.[0];
  if (oldestIdentity) {
    snapshotCache.delete(oldestIdentity);
  }
};

const limitCandles = (
  candles: ReadonlyArray<PerpsCandle>,
  maximumSize: number,
) => candles.slice(-maximumSize);

export const loadPerpsCandleSourcePage = async ({
  candleCount,
  coin,
  endTime,
  interval,
}: {
  candleCount: number;
  coin: string;
  endTime: number;
  interval: PerpsCandleDataInterval;
}): Promise<PerpsCandle[]> => {
  const sdk = apisPerps.getPerpsSDK();
  const { sourceInterval, sourceIntervalMs } = getPerpsCandleSource(interval);
  const safeCandleCount = Math.max(1, Math.floor(candleCount));
  const startTime = Math.max(0, endTime - safeCandleCount * sourceIntervalMs);
  const response = await sdk.info.candleSnapshot(
    coin,
    sourceInterval,
    startTime,
    endTime,
  );
  return limitCandles(parsePerpsCandles(response), safeCandleCount);
};

export const loadPerpsCandleSourceSnapshot = ({
  coin,
  forceRefresh = false,
  interval,
  pendingNotBefore,
  maxPendingAgeMs,
}: {
  coin: string;
  forceRefresh?: boolean;
  interval: PerpsCandleDataInterval;
  /** Opt-in Simple recovery boundary; ordinary preload/Pro still deduplicate. */
  pendingNotBefore?: number;
  maxPendingAgeMs?: number;
}): Promise<PerpsCandleSourceSnapshot> => {
  const identity = getPerpsCandleSourceIdentity(coin, interval);
  const pending = pendingSnapshots.get(identity);
  if (
    pending &&
    (pendingNotBefore === undefined || pending.startedAt >= pendingNotBefore) &&
    (maxPendingAgeMs === undefined ||
      Date.now() - pending.startedAt < maxPendingAgeMs)
  ) {
    return pending.promise;
  }

  const cached = snapshotCache.get(identity);
  if (!forceRefresh && cached && isPerpsCandleSourceSnapshotFresh(cached)) {
    return Promise.resolve(cached);
  }

  let sdk: ReturnType<typeof apisPerps.getPerpsSDK>;
  try {
    sdk = apisPerps.getPerpsSDK();
  } catch (error) {
    return Promise.reject(error);
  }
  const { sourceCandleCount, sourceInterval } = getPerpsCandleSource(interval);
  const endTime = Date.now();
  const startTime = getPerpsCandleHistoryStartTime(interval, endTime);
  const request = sdk.info
    .candleSnapshot(coin, sourceInterval, startTime, endTime)
    .then(response => {
      const snapshot = {
        candles: limitCandles(parsePerpsCandles(response), sourceCandleCount),
        identity,
        loadedAt: Date.now(),
      } satisfies PerpsCandleSourceSnapshot;
      // A superseded request can finish for its own caller, but must not replace
      // the newer snapshot or delete the newer in-flight request.
      if (pendingSnapshots.get(identity)?.promise === request) {
        pruneSnapshotCache();
        snapshotCache.set(identity, snapshot);
      }
      return snapshot;
    })
    .finally(() => {
      if (pendingSnapshots.get(identity)?.promise === request) {
        pendingSnapshots.delete(identity);
      }
    });

  pendingSnapshots.set(identity, { startedAt: endTime, promise: request });
  return request;
};

/**
 * Best-effort warming for intervals the user is likely to select next.
 * Fresh snapshots and in-flight requests are both reused. Failures stay silent
 * because the visible feed still owns loading and error recovery.
 */
export const preloadPerpsCandleSourceSnapshots = async ({
  coin,
  intervals,
  isActive = () => true,
}: {
  coin: string;
  intervals: ReadonlyArray<PerpsCandleDataInterval>;
  isActive?: () => boolean;
}): Promise<void> => {
  const queue = Array.from(new Set(intervals));
  let cursor = 0;
  let running = 0;

  await new Promise<void>(resolve => {
    const drain = () => {
      if (!isActive()) {
        if (running === 0) {
          resolve();
        }
        return;
      }
      while (
        running < PERPS_CANDLE_PREFETCH_CONCURRENCY &&
        cursor < queue.length
      ) {
        const interval = queue[cursor++];
        if (readPerpsCandleSourceSnapshot(coin, interval)) {
          continue;
        }
        running += 1;
        loadPerpsCandleSourceSnapshot({ coin, interval })
          .catch(() => undefined)
          .finally(() => {
            running -= 1;
            drain();
          });
      }
      if (running === 0) {
        resolve();
      }
    };
    drain();
  });
};

export const resetPerpsCandleSourceSnapshotCacheForTests = () => {
  snapshotCache.clear();
  pendingSnapshots.clear();
};
