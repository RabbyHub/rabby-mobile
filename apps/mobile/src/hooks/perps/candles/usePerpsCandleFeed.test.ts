import type { Candle, CandleSnapshot } from '@rabby-wallet/hyperliquid-sdk';
import { act, renderHook } from '@testing-library/react-native';

import { usePerpsCandleFeed } from './usePerpsCandleFeed';
import { resetPerpsCandleSourceSnapshotCacheForTests } from './sourceSnapshot';

type EventName = 'open' | 'close' | 'reconnecting' | 'reconnectFailed';

const mockListeners = new Map<EventName, Set<() => void>>();
const mockCandleCallbacks: Array<(candle: Candle) => void> = [];
const mockUnsubscribes: jest.Mock[] = [];
const mockCandleSnapshot = jest.fn<
  Promise<CandleSnapshot>,
  [string, string, number, number]
>();
const mockWs = {
  off: jest.fn((event: EventName, listener: () => void) => {
    mockListeners.get(event)?.delete(listener);
  }),
  on: jest.fn((event: EventName, listener: () => void) => {
    const listeners = mockListeners.get(event) ?? new Set();
    listeners.add(listener);
    mockListeners.set(event, listeners);
  }),
  subscribeToCandles: jest.fn(
    (_coin: string, _interval: string, callback: (candle: Candle) => void) => {
      const unsubscribe = jest.fn();
      mockCandleCallbacks.push(callback);
      mockUnsubscribes.push(unsubscribe);
      return { unsubscribe };
    },
  ),
};

jest.mock('@/core/apis/perps', () => ({
  apisPerps: {
    getPerpsSDK: () => ({
      info: { candleSnapshot: mockCandleSnapshot },
      ws: mockWs,
    }),
  },
}));

const rawCandle = (time: number, overrides: Partial<Candle> = {}): Candle => ({
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
  ...overrides,
});

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
};

const emit = (event: EventName) => {
  mockListeners.get(event)?.forEach(listener => listener());
};

describe('usePerpsCandleFeed', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListeners.clear();
    mockCandleCallbacks.length = 0;
    mockUnsubscribes.length = 0;
    resetPerpsCandleSourceSnapshotCacheForTests();
  });

  it('shows a preloaded baseline while HTTP refresh and WS convergence run', async () => {
    const request = deferred<CandleSnapshot>();
    mockCandleSnapshot.mockReturnValueOnce(request.promise);
    const hook = renderHook(() =>
      usePerpsCandleFeed({
        coin: 'BTC',
        enabled: true,
        initialSourceCandles: [
          {
            close: 12,
            high: 13,
            low: 9,
            open: 10,
            quoteTurnover: null,
            time: 1000,
            trades: 2,
            volume: 3,
          },
        ],
        interval: '15m',
      }),
    );

    expect(hook.result.current).toMatchObject({
      candles: [expect.objectContaining({ time: 1000 })],
      status: 'ready',
    });
    act(() => {
      mockCandleCallbacks[0]?.(rawCandle(2000, { c: '15', h: '15' }));
    });
    expect(hook.result.current.candles).toEqual([
      expect.objectContaining({ time: 1000 }),
    ]);

    await act(async () => {
      request.resolve([rawCandle(1000)]);
      await request.promise;
    });

    expect(hook.result.current.candles).toEqual([
      expect.objectContaining({ time: 1000 }),
      expect.objectContaining({ close: 15, time: 2000 }),
    ]);
  });

  it('buffers realtime candles before the HTTP baseline and lets WS win', async () => {
    const request = deferred<CandleSnapshot>();
    mockCandleSnapshot.mockReturnValueOnce(request.promise);
    const hook = renderHook(() =>
      usePerpsCandleFeed({
        coin: 'BTC',
        enabled: true,
        interval: '15m',
      }),
    );

    expect(mockWs.subscribeToCandles).toHaveBeenCalledWith(
      'BTC',
      '15m',
      expect.any(Function),
    );
    act(() => {
      mockCandleCallbacks[0]?.(rawCandle(1000, { c: '15', h: '15', v: '4' }));
    });
    expect(hook.result.current.status).toBe('loading');

    await act(async () => {
      request.resolve([rawCandle(1000), rawCandle(2000)]);
      await request.promise;
    });

    expect(hook.result.current.status).toBe('ready');
    expect(hook.result.current.candles).toEqual([
      expect.objectContaining({ close: 15, time: 1000, volume: 4 }),
      expect.objectContaining({ close: 12, time: 2000 }),
    ]);
  });

  it('requests daily candles and aggregates UTC natural months', async () => {
    const request = deferred<CandleSnapshot>();
    mockCandleSnapshot.mockReturnValueOnce(request.promise);
    const response = [
      rawCandle(Date.UTC(2026, 6, 31), {
        i: '1d',
        v: '2',
      }),
      rawCandle(Date.UTC(2026, 7, 1), {
        h: '21',
        i: '1d',
        o: '20',
        v: '3',
      }),
    ];
    const hook = renderHook(() =>
      usePerpsCandleFeed({
        coin: 'BTC',
        enabled: true,
        interval: '1M',
      }),
    );

    await act(async () => {
      request.resolve(response);
      await request.promise;
    });
    expect(mockWs.subscribeToCandles).toHaveBeenCalledWith(
      'BTC',
      '1d',
      expect.any(Function),
    );
    expect(mockCandleSnapshot.mock.calls[0]?.[1]).toBe('1d');
    expect(hook.result.current.candles.map(item => item.time)).toEqual([
      Date.UTC(2026, 6, 1),
      Date.UTC(2026, 7, 1),
    ]);
  });

  it('keeps SDK replay registration and reloads HTTP after reconnect', async () => {
    const initialRequest = deferred<CandleSnapshot>();
    const reconnectRequest = deferred<CandleSnapshot>();
    mockCandleSnapshot
      .mockReturnValueOnce(initialRequest.promise)
      .mockReturnValueOnce(reconnectRequest.promise);
    const hook = renderHook(() =>
      usePerpsCandleFeed({
        coin: 'BTC',
        enabled: true,
        interval: '15m',
      }),
    );

    await act(async () => {
      initialRequest.resolve([rawCandle(1000)]);
      await initialRequest.promise;
    });
    act(() => emit('reconnecting'));
    expect(hook.result.current).toMatchObject({
      candles: [],
      status: 'stale',
    });
    expect(mockUnsubscribes[0]).not.toHaveBeenCalled();

    act(() => emit('open'));
    expect(hook.result.current.status).toBe('loading');
    await act(async () => {
      reconnectRequest.resolve([rawCandle(2000)]);
      await reconnectRequest.promise;
    });

    expect(mockWs.subscribeToCandles).toHaveBeenCalledTimes(1);
    expect(mockCandleSnapshot).toHaveBeenCalledTimes(2);
    expect(hook.result.current.latestCandle?.time).toBe(2000);
  });

  it('invalidates old callbacks and unsubscribes on identity change', async () => {
    const btcRequest = deferred<CandleSnapshot>();
    const ethRequest = deferred<CandleSnapshot>();
    mockCandleSnapshot
      .mockReturnValueOnce(btcRequest.promise)
      .mockReturnValueOnce(ethRequest.promise);
    const hook = renderHook(
      ({ coin }) =>
        usePerpsCandleFeed({
          coin,
          enabled: true,
          interval: '15m',
        }),
      { initialProps: { coin: 'BTC' } },
    );
    await act(async () => {
      btcRequest.resolve([rawCandle(1000)]);
      await btcRequest.promise;
    });

    hook.rerender({ coin: 'ETH' });
    expect(mockUnsubscribes[0]).toHaveBeenCalledTimes(1);
    act(() => {
      mockCandleCallbacks[0]?.(rawCandle(3000));
    });
    expect(hook.result.current.identity).toBe('ETH:15m');
    expect(hook.result.current.candles).toEqual([]);
  });

  it('unsubscribes and clears visible data when the feed is disabled', async () => {
    const request = deferred<CandleSnapshot>();
    mockCandleSnapshot.mockReturnValueOnce(request.promise);
    const hook = renderHook(
      ({ enabled }) =>
        usePerpsCandleFeed({
          coin: 'BTC',
          enabled,
          interval: '15m',
        }),
      { initialProps: { enabled: true } },
    );
    await act(async () => {
      request.resolve([rawCandle(1000)]);
      await request.promise;
    });

    hook.rerender({ enabled: false });

    expect(mockUnsubscribes[0]).toHaveBeenCalledTimes(1);
    expect(hook.result.current).toMatchObject({
      candles: [],
      identity: 'disabled',
      status: 'idle',
    });
  });

  it('turns terminal SDK reconnect failure into an error skeleton state', async () => {
    const request = deferred<CandleSnapshot>();
    mockCandleSnapshot.mockReturnValueOnce(request.promise);
    const hook = renderHook(() =>
      usePerpsCandleFeed({
        coin: 'BTC',
        enabled: true,
        interval: '15m',
      }),
    );
    await act(async () => {
      request.resolve([rawCandle(1000)]);
      await request.promise;
    });

    act(() => emit('reconnectFailed'));

    expect(hook.result.current).toMatchObject({
      candles: [],
      error: expect.any(Error),
      status: 'error',
    });
    expect(mockUnsubscribes[0]).not.toHaveBeenCalled();
  });

  it('reports errors as non-ready data without inventing candles', async () => {
    const request = deferred<CandleSnapshot>();
    mockCandleSnapshot.mockReturnValueOnce(request.promise);
    const hook = renderHook(() =>
      usePerpsCandleFeed({
        coin: 'BTC',
        enabled: true,
        interval: '15m',
      }),
    );

    await act(async () => {
      request.reject(new Error('offline'));
      await expect(request.promise).rejects.toThrow('offline');
    });

    expect(hook.result.current).toMatchObject({
      candles: [],
      error: expect.any(Error),
      status: 'error',
    });
  });

  it('keeps direct-period source history bounded to the approved window', async () => {
    const request = deferred<CandleSnapshot>();
    mockCandleSnapshot.mockReturnValueOnce(request.promise);
    const response = Array.from({ length: 502 }, (_, index) =>
      rawCandle(index * 60_000, { i: '1m' }),
    );
    const hook = renderHook(() =>
      usePerpsCandleFeed({
        coin: 'BTC',
        enabled: true,
        interval: '1m',
      }),
    );

    await act(async () => {
      request.resolve(response);
      await request.promise;
    });
    expect(hook.result.current.candles).toHaveLength(500);
    expect(hook.result.current.candles[0]?.time).toBe(2 * 60_000);
  });

  it('loads older source candles on demand without replacing the live tail', async () => {
    const initialRequest = deferred<CandleSnapshot>();
    const historyRequest = deferred<CandleSnapshot>();
    mockCandleSnapshot
      .mockReturnValueOnce(initialRequest.promise)
      .mockReturnValueOnce(historyRequest.promise);
    const initial = Array.from({ length: 500 }, (_, index) =>
      rawCandle((index + 1000) * 60_000, { i: '1m' }),
    );
    const older = Array.from({ length: 1000 }, (_, index) =>
      rawCandle(index * 60_000, { i: '1m' }),
    );
    const hook = renderHook(() =>
      usePerpsCandleFeed({ coin: 'BTC', enabled: true, interval: '1m' }),
    );

    await act(async () => {
      initialRequest.resolve(initial);
      await initialRequest.promise;
    });
    let loadResult: string | undefined;
    await act(async () => {
      const loadPromise = hook.result.current.loadOlder();
      historyRequest.resolve(older);
      loadResult = await loadPromise;
    });

    expect(loadResult).toBe('loaded');
    expect(hook.result.current).toMatchObject({
      status: 'ready',
      updateType: 'history',
    });
    expect(hook.result.current.candles).toHaveLength(1500);
    expect(hook.result.current.candles.at(-1)?.time).toBe(1499 * 60_000);
    expect(mockCandleSnapshot.mock.calls[1]?.[3]).toBe(1000 * 60_000 - 1);
  });

  it('coalesces concurrent history requests and stops at the official boundary', async () => {
    const initialRequest = deferred<CandleSnapshot>();
    const historyRequest = deferred<CandleSnapshot>();
    mockCandleSnapshot
      .mockReturnValueOnce(initialRequest.promise)
      .mockReturnValueOnce(historyRequest.promise);
    const hook = renderHook(() =>
      usePerpsCandleFeed({ coin: 'BTC', enabled: true, interval: '1m' }),
    );

    await act(async () => {
      initialRequest.resolve([rawCandle(2_000 * 60_000, { i: '1m' })]);
      await initialRequest.promise;
    });

    let firstResult: string | undefined;
    let secondResult: string | undefined;
    await act(async () => {
      const first = hook.result.current.loadOlder();
      const second = hook.result.current.loadOlder();
      expect(first).toBe(second);
      historyRequest.resolve([]);
      [firstResult, secondResult] = await Promise.all([first, second]);
    });

    expect(firstResult).toBe('exhausted');
    expect(secondResult).toBe('exhausted');
    await expect(hook.result.current.loadOlder()).resolves.toBe('exhausted');
    expect(mockCandleSnapshot).toHaveBeenCalledTimes(2);
  });
});
