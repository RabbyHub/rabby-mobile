import type { PerpsCandleInterval } from '@/constant/perps';
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
const snapshotCache = new Map<string, PerpsCandleSourceSnapshot>();
const pendingSnapshots = new Map<string, Promise<PerpsCandleSourceSnapshot>>();

export const getPerpsCandleSourceIdentity = (
  coin: string,
  interval: PerpsCandleInterval,
) => `${coin}:${interval}`;

export const isPerpsCandleSourceSnapshotFresh = (
  snapshot: PerpsCandleSourceSnapshot,
) => Date.now() - snapshot.loadedAt <= PERPS_CANDLE_PRELOAD_TTL_MS;

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
  interval: PerpsCandleInterval;
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
}: {
  coin: string;
  forceRefresh?: boolean;
  interval: PerpsCandleInterval;
}): Promise<PerpsCandleSourceSnapshot> => {
  const identity = getPerpsCandleSourceIdentity(coin, interval);
  const pending = pendingSnapshots.get(identity);
  if (pending) {
    return pending;
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
      pruneSnapshotCache();
      const snapshot = {
        candles: limitCandles(parsePerpsCandles(response), sourceCandleCount),
        identity,
        loadedAt: Date.now(),
      } satisfies PerpsCandleSourceSnapshot;
      snapshotCache.set(identity, snapshot);
      return snapshot;
    })
    .finally(() => {
      if (pendingSnapshots.get(identity) === request) {
        pendingSnapshots.delete(identity);
      }
    });

  pendingSnapshots.set(identity, request);
  return request;
};

export const resetPerpsCandleSourceSnapshotCacheForTests = () => {
  snapshotCache.clear();
  pendingSnapshots.clear();
};
