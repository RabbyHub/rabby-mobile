import { act, renderHook } from '@testing-library/react-native';

import type { PerpsCandleInterval } from '@/constant/perps';

const mockGetSelectedKlineInterval = jest.fn();
const mockSetSelectedKlineInterval = jest.fn();
const mockLoadPerpsCandleSourceSnapshot = jest.fn();
const mockUsePerpsCandleFeed = jest.fn(
  ({
    coin,
    enabled,
    interval,
  }: {
    coin: string;
    enabled: boolean;
    interval: PerpsCandleInterval;
  }) => ({
    candles: [],
    error: null,
    identity: enabled ? `${coin}:${interval}` : 'disabled',
    latestCandle: null,
    status: enabled ? 'loading' : 'idle',
    updateType: 'reset',
  }),
);

jest.mock('@/core/apis/perps', () => ({
  apisPerps: {
    getSelectedKlineInterval: mockGetSelectedKlineInterval,
    setSelectedKlineInterval: mockSetSelectedKlineInterval,
  },
}));

jest.mock('@/hooks/perps/candles/usePerpsCandleFeed', () => ({
  usePerpsCandleFeed: mockUsePerpsCandleFeed,
}));

jest.mock('@/hooks/perps/candles/sourceSnapshot', () => ({
  getPerpsCandleSourceIdentity: (coin: string, interval: string) =>
    `${coin}:${interval}`,
  isPerpsCandleSourceSnapshotFresh: () => true,
  loadPerpsCandleSourceSnapshot: mockLoadPerpsCandleSourceSnapshot,
}));

const { usePerpsProKline } =
  require('./usePerpsProKline') as typeof import('./usePerpsProKline');

const deferred = <T>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
};

const flushPromises = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

describe('usePerpsProKline', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSelectedKlineInterval.mockResolvedValue('15m');
    mockSetSelectedKlineInterval.mockResolvedValue(undefined);
    mockLoadPerpsCandleSourceSnapshot.mockImplementation(
      ({ coin, interval }: { coin: string; interval: string }) =>
        Promise.resolve({
          candles: [
            {
              close: 12,
              high: 13,
              low: 9,
              open: 10,
              quoteTurnover: null,
              time: 1_800_000,
              trades: 2,
              volume: 3,
            },
          ],
          identity: `${coin}:${interval}`,
          loadedAt: 1,
        }),
    );
  });

  it('hydrates the shared interval before enabling the candle feed', async () => {
    mockGetSelectedKlineInterval.mockResolvedValueOnce('1M');
    const hook = renderHook(() =>
      usePerpsProKline({ coin: 'BTC', enabled: true }),
    );

    expect(hook.result.current).toMatchObject({
      hydrated: false,
      interval: '15m',
    });
    expect(mockUsePerpsCandleFeed).toHaveBeenLastCalledWith({
      coin: 'BTC',
      enabled: false,
      initialSourceCandles: undefined,
      interval: '15m',
    });

    await flushPromises();

    expect(hook.result.current).toMatchObject({
      hydrated: true,
      interval: '1M',
    });
    expect(mockUsePerpsCandleFeed).toHaveBeenLastCalledWith({
      coin: 'BTC',
      enabled: true,
      initialSourceCandles: expect.any(Array),
      interval: '1M',
    });
  });

  it('serializes rapid interval writes and rolls back only the latest failure', async () => {
    const firstWrite = deferred<void>();
    const secondWrite = deferred<void>();
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    mockSetSelectedKlineInterval
      .mockReturnValueOnce(firstWrite.promise)
      .mockReturnValueOnce(secondWrite.promise);
    const hook = renderHook(() =>
      usePerpsProKline({ coin: 'BTC', enabled: true }),
    );
    await flushPromises();

    act(() => {
      hook.result.current.selectInterval('5m');
      hook.result.current.selectInterval('1h');
    });
    await flushPromises();

    expect(hook.result.current.interval).toBe('1h');
    expect(mockSetSelectedKlineInterval).toHaveBeenCalledTimes(1);
    expect(mockSetSelectedKlineInterval).toHaveBeenNthCalledWith(1, '5m');

    firstWrite.resolve();
    await flushPromises();
    expect(mockSetSelectedKlineInterval).toHaveBeenNthCalledWith(2, '1h');

    secondWrite.reject(new Error('write failed'));
    await flushPromises();

    expect(hook.result.current.interval).toBe('5m');
    consoleError.mockRestore();
  });

  it('falls back to 15m when preference hydration fails', async () => {
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    mockGetSelectedKlineInterval.mockRejectedValueOnce(
      new Error('read failed'),
    );
    const hook = renderHook(() =>
      usePerpsProKline({ coin: 'BTC', enabled: true }),
    );

    await flushPromises();

    expect(hook.result.current).toMatchObject({
      hydrated: true,
      interval: '15m',
    });
    expect(mockUsePerpsCandleFeed).toHaveBeenLastCalledWith({
      coin: 'BTC',
      enabled: true,
      initialSourceCandles: expect.any(Array),
      interval: '15m',
    });
    consoleError.mockRestore();
  });

  it('preloads an HTTP snapshot without enabling the live Candle feed', async () => {
    const hook = renderHook(() =>
      usePerpsProKline({
        coin: 'BTC',
        enabled: false,
        preloadEnabled: true,
      }),
    );

    await flushPromises();

    expect(mockLoadPerpsCandleSourceSnapshot).toHaveBeenCalledWith({
      coin: 'BTC',
      interval: '15m',
    });
    expect(mockUsePerpsCandleFeed).toHaveBeenLastCalledWith({
      coin: 'BTC',
      enabled: false,
      initialSourceCandles: expect.any(Array),
      interval: '15m',
    });
    expect(hook.result.current.feed).toMatchObject({
      identity: 'BTC:15m',
      status: 'ready',
    });
  });
});
