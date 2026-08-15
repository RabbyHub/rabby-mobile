import { act, renderHook } from '@testing-library/react-native';
import type { L2Book } from '@rabby-wallet/hyperliquid-sdk';

const mockWsListeners = new Map<string, Set<(...args: any[]) => void>>();
const mockFastL2Callbacks: Array<(data: L2Book) => void> = [];
const mockUnsubscribers: jest.Mock[] = [];
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
const mockSdk = { ws: mockWs };

jest.mock('@/core/apis/perps', () => ({
  apisPerps: { getPerpsSDK: () => mockSdk },
}));

import {
  PERPS_FAST_L2_DISPLAY_CACHE_MS,
  prewarmPerpsFastL2,
  resetPerpsFastL2RegistryForTests,
  usePerpsFastL2,
} from './usePerpsFastL2';

const precision = { mantissa: null, nSigFigs: 5 as const };
const book = (time: number): L2Book => ({
  coin: 'BTC',
  levels: [[{ n: 1, px: '100', sz: '1' }], [{ n: 1, px: '101', sz: '1' }]],
  time,
});

const emitFastL2 = (value: L2Book) => {
  mockFastL2Callbacks.at(-1)?.(value);
};

describe('usePerpsFastL2 shared registry', () => {
  beforeEach(() => {
    resetPerpsFastL2RegistryForTests();
    jest.clearAllMocks();
    mockWsListeners.clear();
    mockFastL2Callbacks.length = 0;
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

    jest.setSystemTime(12_001);
    act(() => emitFastL2(book(3)));
    expect(hook.result.current.status).toBe('ready');
    expect(hook.result.current.book?.time).toBe(3);
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
