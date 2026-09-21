import { act, renderHook } from '@testing-library/react-native';
import type { L2Book } from '@rabby-wallet/hyperliquid-sdk';

const mockWsListeners = new Map<string, Set<(...args: any[]) => void>>();
const mockFastL2Callbacks: Array<(data: L2Book) => void> = [];
const mockUnsubscribers: jest.Mock[] = [];
const mockGetL2Book = jest.fn();
const mockWs = {
  off: jest.fn((event: string, listener: (...args: any[]) => void) => {
    mockWsListeners.get(event)?.delete(listener);
  }),
  on: jest.fn((event: string, listener: (...args: any[]) => void) => {
    const listeners = mockWsListeners.get(event) ?? new Set();
    listeners.add(listener);
    mockWsListeners.set(event, listeners);
  }),
  subscribeToFastL2: jest.fn(
    (_input: unknown, callback: (data: L2Book) => void) => {
      const unsubscribe = jest.fn();
      mockFastL2Callbacks.push(callback);
      mockUnsubscribers.push(unsubscribe);
      return { unsubscribe };
    },
  ),
};
const mockSdk = { info: { getL2Book: mockGetL2Book }, ws: mockWs };

jest.mock('@/core/apis/perps', () => ({
  apisPerps: {
    getPerpsSDK: () => mockSdk,
    getPerpsSDKSnapshot: () => mockSdk,
  },
}));

import {
  PERPS_FAST_L2_DISPLAY_CACHE_MS,
  prewarmPerpsFastL2HttpSnapshot,
  prewarmPerpsFastL2,
  resetPerpsFastL2RegistryForTests,
  usePerpsFastL2,
  waitForPerpsFastL2HttpSnapshot,
} from './usePerpsFastL2';

const precision = { mantissa: null, nSigFigs: 5 as const };
const book = (time: number, coin = 'BTC'): L2Book => ({
  coin,
  levels: [[{ n: 1, px: '100', sz: '1' }], [{ n: 1, px: '101', sz: '1' }]],
  time,
});

const emitFastL2 = (value: L2Book) => {
  mockFastL2Callbacks.at(-1)?.(value);
};

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(next => {
    resolve = next;
  });
  return { promise, resolve };
};

describe('usePerpsFastL2 shared registry', () => {
  beforeEach(() => {
    resetPerpsFastL2RegistryForTests();
    jest.clearAllMocks();
    mockWsListeners.clear();
    mockFastL2Callbacks.length = 0;
    mockGetL2Book.mockResolvedValue(book(100));
    mockUnsubscribers.length = 0;
  });

  afterEach(() => {
    resetPerpsFastL2RegistryForTests();
    jest.useRealTimers();
  });

  it('shares one SDK subscription between intent prewarm and the mounted scene', () => {
    const cancelPrewarm = prewarmPerpsFastL2({
      coin: 'BTC',
      precision,
    });
    const scene = renderHook(() =>
      usePerpsFastL2({ coin: 'BTC', enabled: true, precision }),
    );

    expect(mockWs.subscribeToFastL2).toHaveBeenCalledTimes(1);
    cancelPrewarm();
    expect(mockUnsubscribers[0]).not.toHaveBeenCalled();

    scene.unmount();
    expect(mockUnsubscribers[0]).toHaveBeenCalledTimes(1);
  });

  it('keeps a display-only snapshot for three seconds after owner handoff', () => {
    jest.useFakeTimers();
    jest.setSystemTime(10_000);
    const first = renderHook(() =>
      usePerpsFastL2({ coin: 'BTC', enabled: true, precision }),
    );
    act(() => emitFastL2(book(1)));
    expect(first.result.current.status).toBe('ready');
    first.unmount();

    const second = renderHook(() =>
      usePerpsFastL2({ coin: 'BTC', enabled: true, precision }),
    );
    expect(second.result.current.book).toEqual(book(1));
    expect(second.result.current.status).toBe('stale');

    act(() => jest.advanceTimersByTime(PERPS_FAST_L2_DISPLAY_CACHE_MS));
    expect(second.result.current.book).toBeNull();
    expect(mockWs.subscribeToFastL2).toHaveBeenCalledTimes(2);
  });

  it('publishes a prewarmed exact target on the first identity-change render', () => {
    const renderHistory: Array<{
      bookCoin: string | null;
      identity: string;
      status: ReturnType<typeof usePerpsFastL2>['status'];
    }> = [];
    const hook = renderHook(
      ({ coin }) => {
        const current = usePerpsFastL2({ coin, enabled: true, precision });
        renderHistory.push({
          bookCoin: current.book?.coin ?? null,
          identity: current.identity,
          status: current.status,
        });
        return current;
      },
      { initialProps: { coin: 'BTC' } },
    );
    act(() => emitFastL2(book(1)));
    prewarmPerpsFastL2({ coin: 'ETH', precision });
    act(() => emitFastL2(book(2, 'ETH')));
    renderHistory.length = 0;

    hook.rerender({ coin: 'ETH' });

    expect(renderHistory[0]).toEqual({
      bookCoin: 'ETH',
      identity: 'ETH:5:null',
      status: 'stale',
    });
    expect(renderHistory).not.toContainEqual(
      expect.objectContaining({ bookCoin: null, identity: 'ETH:5:null' }),
    );
  });

  it('deduplicates and seeds an exact display-only HTTP snapshot', async () => {
    const response = deferred<L2Book>();
    mockGetL2Book.mockReturnValueOnce(response.promise);

    const first = prewarmPerpsFastL2HttpSnapshot({
      coin: 'ETH',
      precision,
    });
    const second = prewarmPerpsFastL2HttpSnapshot({
      coin: 'ETH',
      precision,
    });
    expect(first).toBe(second);
    await act(async () => Promise.resolve());
    expect(mockGetL2Book).toHaveBeenCalledTimes(1);
    expect(mockGetL2Book).toHaveBeenCalledWith('ETH', 5, undefined);

    await act(async () => {
      response.resolve(book(5, 'ETH'));
      await expect(first).resolves.toBe(true);
    });
    const hook = renderHook(() =>
      usePerpsFastL2({ coin: 'ETH', enabled: true, precision }),
    );
    expect(hook.result.current).toMatchObject({
      book: book(5, 'ETH'),
      identity: 'ETH:5:null',
      status: 'stale',
    });
  });

  it('keeps the logical subscription in background and requires a post-resume revision', () => {
    jest.useFakeTimers();
    jest.setSystemTime(10_000);
    const hook = renderHook(
      ({ publicationEnabled }) =>
        usePerpsFastL2({
          coin: 'BTC',
          enabled: true,
          precision,
          publicationEnabled,
        }),
      { initialProps: { publicationEnabled: true } },
    );
    act(() => emitFastL2(book(1)));
    expect(hook.result.current.status).toBe('ready');

    hook.rerender({ publicationEnabled: false });
    expect(hook.result.current.status).toBe('stale');
    jest.setSystemTime(11_000);
    act(() => emitFastL2(book(2)));
    expect(hook.result.current.book?.time).toBe(1);

    jest.setSystemTime(12_000);
    hook.rerender({ publicationEnabled: true });
    expect(hook.result.current.status).toBe('stale');
    expect(hook.result.current.book?.time).toBe(2);
    expect(mockWs.subscribeToFastL2).toHaveBeenCalledTimes(1);
    expect(mockGetL2Book).not.toHaveBeenCalled();

    jest.setSystemTime(12_001);
    act(() => emitFastL2(book(3)));
    expect(hook.result.current.status).toBe('ready');
    expect(hook.result.current.book?.time).toBe(3);
  });

  it('races one exact HTTP snapshot after an expired foreground resume', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(10_000);
    const hook = renderHook(
      ({ publicationEnabled }) =>
        usePerpsFastL2({
          coin: 'BTC',
          enabled: true,
          precision,
          publicationEnabled,
        }),
      { initialProps: { publicationEnabled: true } },
    );
    act(() => emitFastL2(book(1)));
    hook.rerender({ publicationEnabled: false });
    jest.setSystemTime(10_000 + PERPS_FAST_L2_DISPLAY_CACHE_MS + 1);

    hook.rerender({ publicationEnabled: true });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockGetL2Book).toHaveBeenCalledTimes(1);
    expect(mockGetL2Book).toHaveBeenCalledWith('BTC', 5, undefined);
    expect(hook.result.current.status).toBe('stale');
    expect(hook.result.current.book?.time).toBe(100);
    expect(mockWs.subscribeToFastL2).toHaveBeenCalledTimes(1);
  });

  it('does not let a late HTTP snapshot overwrite a newer ready WebSocket book', async () => {
    const response = deferred<L2Book>();
    mockGetL2Book.mockReturnValueOnce(response.promise);
    const request = prewarmPerpsFastL2HttpSnapshot({
      coin: 'ETH',
      precision,
    });
    await act(async () => Promise.resolve());

    const hook = renderHook(() =>
      usePerpsFastL2({ coin: 'ETH', enabled: true, precision }),
    );
    act(() => emitFastL2(book(20, 'ETH')));
    expect(hook.result.current).toMatchObject({
      book: book(20, 'ETH'),
      status: 'ready',
    });

    await act(async () => {
      response.resolve(book(10, 'ETH'));
      await expect(request).resolves.toBe(true);
    });

    expect(hook.result.current).toMatchObject({
      book: book(20, 'ETH'),
      status: 'ready',
    });
  });

  it('bounds an exact snapshot handoff without cancelling the shared request', async () => {
    jest.useFakeTimers();
    const response = deferred<L2Book>();
    mockGetL2Book.mockReturnValueOnce(response.promise);
    const handoff = waitForPerpsFastL2HttpSnapshot({
      coin: 'ETH',
      precision,
      timeoutMs: 50,
    });
    await act(async () => Promise.resolve());

    act(() => jest.advanceTimersByTime(50));
    await expect(handoff).resolves.toBe(false);

    await act(async () => {
      response.resolve(book(30, 'ETH'));
      await Promise.resolve();
      await Promise.resolve();
    });
    const hook = renderHook(() =>
      usePerpsFastL2({ coin: 'ETH', enabled: true, precision }),
    );
    expect(hook.result.current).toMatchObject({
      book: book(30, 'ETH'),
      status: 'stale',
    });
  });

  it('never renders an expired ready book while reopening the publication gate', () => {
    jest.useFakeTimers();
    jest.setSystemTime(10_000);
    const renderHistory: Array<{
      bookTime: number | null;
      status: ReturnType<typeof usePerpsFastL2>['status'];
    }> = [];
    const hook = renderHook(
      ({ publicationEnabled }) => {
        const current = usePerpsFastL2({
          coin: 'BTC',
          enabled: true,
          precision,
          publicationEnabled,
        });
        renderHistory.push({
          bookTime: current.book?.time ?? null,
          status: current.status,
        });
        return current;
      },
      { initialProps: { publicationEnabled: true } },
    );
    act(() => emitFastL2(book(1)));

    hook.rerender({ publicationEnabled: false });
    expect(hook.result.current.status).toBe('stale');
    jest.setSystemTime(10_000 + PERPS_FAST_L2_DISPLAY_CACHE_MS + 1);
    renderHistory.length = 0;

    hook.rerender({ publicationEnabled: true });

    expect(renderHistory.length).toBeGreaterThan(0);
    expect(renderHistory[0]).toEqual({ bookTime: null, status: 'stale' });
    expect(renderHistory).not.toContainEqual({
      bookTime: 1,
      status: 'ready',
    });
    expect(hook.result.current.book).toBeNull();
    expect(mockWs.subscribeToFastL2).toHaveBeenCalledTimes(1);

    jest.setSystemTime(10_000 + PERPS_FAST_L2_DISPLAY_CACHE_MS + 2);
    act(() => emitFastL2(book(2)));
    expect(hook.result.current.status).toBe('ready');
    expect(hook.result.current.book?.time).toBe(2);
  });

  it('retains fresh content during reconnect but clears it after terminal failure', () => {
    const hook = renderHook(() =>
      usePerpsFastL2({ coin: 'BTC', enabled: true, precision }),
    );
    act(() => emitFastL2(book(1)));

    act(() => {
      mockWsListeners.get('close')?.forEach(listener => listener());
    });
    expect(hook.result.current.status).toBe('stale');
    expect(hook.result.current.book).toEqual(book(1));

    act(() => {
      mockWsListeners.get('reconnectFailed')?.forEach(listener => listener());
    });
    expect(hook.result.current.status).toBe('error');
    expect(hook.result.current.book).toBeNull();
  });
});
