import type { Candle, CandleSnapshot } from '@rabby-wallet/hyperliquid-sdk';

import {
  loadPerpsCandleSourceSnapshot,
  preloadPerpsCandleSourceSnapshots,
  readPerpsCandleSourceSnapshot,
  resetPerpsCandleSourceSnapshotCacheForTests,
} from './sourceSnapshot';

const mockCandleSnapshot = jest.fn<
  Promise<CandleSnapshot>,
  [string, string, number, number]
>();

jest.mock('@/core/apis/perps', () => ({
  apisPerps: {
    getPerpsSDK: () => ({
      info: { candleSnapshot: mockCandleSnapshot },
    }),
  },
}));

const rawCandle = (time: number): Candle => ({
  T: time + 60_000 - 1,
  c: '12',
  h: '13',
  i: '15m',
  l: '9',
  n: 2,
  o: '10',
  s: 'BTC',
  t: time,
  v: '3',
});

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(resolvePromise => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

describe('Perps Candle source snapshot preload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetPerpsCandleSourceSnapshotCacheForTests();
  });

  it('supersedes pre-resume requests without allowing a late response to replace the new cache', async () => {
    const clock = jest.spyOn(Date, 'now').mockReturnValue(1000);
    const old = deferred<CandleSnapshot>();
    const fresh = deferred<CandleSnapshot>();
    try {
      mockCandleSnapshot
        .mockReturnValueOnce(old.promise)
        .mockReturnValueOnce(fresh.promise);
      const first = loadPerpsCandleSourceSnapshot({
        coin: 'BTC',
        interval: '15m',
      });
      clock.mockReturnValue(121000);
      // Default consumers retain in-flight deduplication.
      expect(
        loadPerpsCandleSourceSnapshot({
          coin: 'BTC',
          interval: '15m',
          forceRefresh: true,
        }),
      ).toBe(first);
      const second = loadPerpsCandleSourceSnapshot({
        coin: 'BTC',
        interval: '15m',
        forceRefresh: true,
        pendingNotBefore: Date.now(),
      });
      expect(second).not.toBe(first);
      fresh.resolve([rawCandle(2000)]);
      const latest = await second;
      old.resolve([rawCandle(1000)]);
      await first;
      expect(readPerpsCandleSourceSnapshot('BTC', '15m')).toBe(latest);
    } finally {
      clock.mockRestore();
    }
  });

  it('deduplicates in-flight requests and reuses the short-lived snapshot', async () => {
    const request = deferred<CandleSnapshot>();
    mockCandleSnapshot.mockReturnValueOnce(request.promise);

    const first = loadPerpsCandleSourceSnapshot({
      coin: 'BTC',
      interval: '15m',
    });
    const second = loadPerpsCandleSourceSnapshot({
      coin: 'BTC',
      interval: '15m',
    });

    expect(second).toBe(first);
    expect(mockCandleSnapshot).toHaveBeenCalledTimes(1);
    request.resolve([rawCandle(1000)]);
    const snapshot = await first;

    const cached = await loadPerpsCandleSourceSnapshot({
      coin: 'BTC',
      interval: '15m',
    });
    expect(cached).toBe(snapshot);
    expect(mockCandleSnapshot).toHaveBeenCalledTimes(1);
  });

  it('lets the live feed force an accuracy refresh after preload', async () => {
    mockCandleSnapshot
      .mockResolvedValueOnce([rawCandle(1000)])
      .mockResolvedValueOnce([rawCandle(2000)]);

    await loadPerpsCandleSourceSnapshot({ coin: 'BTC', interval: '15m' });
    const refreshed = await loadPerpsCandleSourceSnapshot({
      coin: 'BTC',
      forceRefresh: true,
      interval: '15m',
    });

    expect(mockCandleSnapshot).toHaveBeenCalledTimes(2);
    expect(refreshed.candles[0]?.time).toBe(2000);
  });

  it('prefetches unique intervals once and reuses fresh snapshots', async () => {
    mockCandleSnapshot.mockResolvedValue([rawCandle(1000)]);

    await preloadPerpsCandleSourceSnapshots({
      coin: 'BTC',
      intervals: ['15m', '5m', '15m'],
    });

    expect(mockCandleSnapshot).toHaveBeenCalledTimes(2);

    await preloadPerpsCandleSourceSnapshots({
      coin: 'BTC',
      intervals: ['15m', '5m'],
    });

    expect(mockCandleSnapshot).toHaveBeenCalledTimes(2);
  });

  it('stops prefetching when the sheet is no longer active', async () => {
    mockCandleSnapshot.mockResolvedValue([rawCandle(1000)]);
    let active = false;

    await preloadPerpsCandleSourceSnapshots({
      coin: 'BTC',
      intervals: ['15m', '5m'],
      isActive: () => active,
    });

    expect(mockCandleSnapshot).not.toHaveBeenCalled();
  });
});
