import type { L2Book, WsTrade } from '@rabby-wallet/hyperliquid-sdk';
import { act, renderHook } from '@testing-library/react-native';

import {
  resetPerpsFastL2RegistryForTests,
  usePerpsFastL2,
} from './usePerpsFastL2';
import {
  resetPerpsLatestTradeRegistryForTests,
  selectLatestPerpsTrade,
  usePerpsLatestTrade,
} from './usePerpsLatestTrade';

type EventName = 'open' | 'close' | 'reconnecting' | 'reconnectFailed';

const mockListeners = new Map<EventName, Set<() => void>>();
const mockFastL2Callbacks: Array<(book: L2Book) => void> = [];
const mockTradeCallbacks: Array<(trades: WsTrade[]) => void> = [];
const mockFastUnsubscribes: jest.Mock[] = [];
const mockTradeUnsubscribes: jest.Mock[] = [];

const mockWs = {
  on: jest.fn((event: EventName, listener: () => void) => {
    const listeners = mockListeners.get(event) ?? new Set();
    listeners.add(listener);
    mockListeners.set(event, listeners);
  }),
  off: jest.fn((event: EventName, listener: () => void) => {
    mockListeners.get(event)?.delete(listener);
  }),
  subscribeToFastL2: jest.fn(
    (
      _params: unknown,
      callback: (book: L2Book) => void,
    ): { unsubscribe: () => void } => {
      const unsubscribe = jest.fn();
      mockFastL2Callbacks.push(callback);
      mockFastUnsubscribes.push(unsubscribe);
      return { unsubscribe };
    },
  ),
  subscribeToTrades: jest.fn(
    (
      _coin: string,
      callback: (trades: WsTrade[]) => void,
    ): { unsubscribe: () => void } => {
      const unsubscribe = jest.fn();
      mockTradeCallbacks.push(callback);
      mockTradeUnsubscribes.push(unsubscribe);
      return { unsubscribe };
    },
  ),
  subscribeToL2Book: jest.fn(),
};
const mockSdk = { ws: mockWs };

jest.mock('@/core/apis/perps', () => ({
  apisPerps: {
    getPerpsSDK: () => mockSdk,
    getPerpsSDKSnapshot: () => mockSdk,
  },
}));

const emit = (event: EventName) => {
  mockListeners.get(event)?.forEach(listener => listener());
};

const book = (coin: string, time = 1): L2Book => ({
  coin,
  levels: [[], []],
  time,
});

const trade = (overrides: Partial<WsTrade> = {}): WsTrade => ({
  coin: 'BTC',
  hash: '0x1',
  px: '100',
  side: 'B',
  sz: '1',
  tid: 1,
  time: 1,
  ...overrides,
});

describe('Perps Pro focused subscriptions', () => {
  beforeEach(() => {
    resetPerpsFastL2RegistryForTests();
    resetPerpsLatestTradeRegistryForTests();
    jest.clearAllMocks();
    mockListeners.clear();
    mockFastL2Callbacks.length = 0;
    mockTradeCallbacks.length = 0;
    mockFastUnsubscribes.length = 0;
    mockTradeUnsubscribes.length = 0;
  });

  afterEach(() => {
    resetPerpsFastL2RegistryForTests();
    resetPerpsLatestTradeRegistryForTests();
  });

  it('subscribes to FastL2 once per identity and never calls l2Book', () => {
    const precision = { nSigFigs: 5 as const, mantissa: 2 as const };
    const hook = renderHook(
      ({ value }) =>
        usePerpsFastL2({
          coin: 'BTC',
          enabled: true,
          precision: value,
        }),
      { initialProps: { value: precision } },
    );

    expect(mockWs.subscribeToFastL2).toHaveBeenCalledWith(
      { coin: 'BTC', nSigFigs: 5, mantissa: 2 },
      expect.any(Function),
    );
    hook.rerender({ value: { ...precision } });
    expect(mockWs.subscribeToFastL2).toHaveBeenCalledTimes(1);
    expect(mockWs.subscribeToL2Book).not.toHaveBeenCalled();

    act(() => mockFastL2Callbacks[0]?.(book('ETH')));
    expect(hook.result.current.book).toBeNull();
    act(() => mockFastL2Callbacks[0]?.(book('BTC', 2)));
    expect(hook.result.current).toMatchObject({
      book: book('BTC', 2),
      status: 'ready',
    });
  });

  it('keeps SDK replay registration and the display-only snapshot during reconnect', () => {
    const hook = renderHook(() =>
      usePerpsFastL2({
        coin: 'BTC',
        enabled: true,
        precision: { nSigFigs: 5, mantissa: null },
      }),
    );
    act(() => mockFastL2Callbacks[0]?.(book('BTC')));
    act(() => emit('reconnecting'));

    expect(hook.result.current).toMatchObject({
      book: book('BTC'),
      status: 'stale',
    });
    expect(mockFastUnsubscribes[0]).not.toHaveBeenCalled();

    act(() => emit('open'));
    expect(hook.result.current.status).toBe('loading');
    act(() => mockFastL2Callbacks[0]?.(book('BTC', 3)));
    expect(hook.result.current).toMatchObject({
      book: book('BTC', 3),
      status: 'ready',
    });
  });

  it('preserves the last valid FastL2 book when a matching payload is malformed', () => {
    const hook = renderHook(() =>
      usePerpsFastL2({
        coin: 'BTC',
        enabled: true,
        precision: { nSigFigs: 5, mantissa: null },
      }),
    );
    const validBook = book('BTC', 2);
    act(() => mockFastL2Callbacks[0]?.(validBook));
    act(() =>
      mockFastL2Callbacks[0]?.({
        coin: 'BTC',
        levels: [null, []],
        time: 3,
      } as unknown as L2Book),
    );

    expect(hook.result.current).toMatchObject({
      book: validBook,
      error: expect.any(Error),
      status: 'stale',
    });
  });

  it('reports an invalid first FastL2 payload without inventing a book', () => {
    const hook = renderHook(() =>
      usePerpsFastL2({
        coin: 'BTC',
        enabled: true,
        precision: { nSigFigs: 5, mantissa: null },
      }),
    );
    act(() =>
      mockFastL2Callbacks[0]?.({
        coin: 'BTC',
        levels: [],
        time: 1,
      } as unknown as L2Book),
    );

    expect(hook.result.current).toMatchObject({
      book: null,
      error: expect.any(Error),
      status: 'error',
    });
  });

  it('invalidates old FastL2 callbacks when market identity changes', () => {
    const hook = renderHook(
      ({ coin }) =>
        usePerpsFastL2({
          coin,
          enabled: true,
          precision: { nSigFigs: 5, mantissa: null },
        }),
      { initialProps: { coin: 'BTC' } },
    );
    hook.rerender({ coin: 'ETH' });

    expect(mockFastUnsubscribes[0]).toHaveBeenCalledTimes(1);
    act(() => mockFastL2Callbacks[0]?.(book('BTC')));
    expect(hook.result.current.book).toBeNull();
    act(() => mockFastL2Callbacks[1]?.(book('ETH')));
    expect(hook.result.current.book?.coin).toBe('ETH');
  });

  it('clears the old book synchronously when precision identity changes', () => {
    const hook = renderHook(
      ({ precision }) =>
        usePerpsFastL2({
          coin: 'BTC',
          enabled: true,
          precision,
        }),
      {
        initialProps: {
          precision: {
            nSigFigs: 5 as const,
            mantissa: null,
          },
        },
      },
    );

    act(() => mockFastL2Callbacks[0]?.(book('BTC', 1)));
    expect(hook.result.current.status).toBe('ready');

    hook.rerender({
      precision: {
        nSigFigs: 5,
        mantissa: 2,
      },
    });

    expect(hook.result.current).toMatchObject({
      book: null,
      status: 'loading',
    });
    act(() => mockFastL2Callbacks[0]?.(book('BTC', 2)));
    expect(hook.result.current.book).toBeNull();
    act(() => mockFastL2Callbacks[1]?.(book('BTC', 3)));
    expect(hook.result.current).toMatchObject({
      book: book('BTC', 3),
      status: 'ready',
    });
  });

  it('cleans FastL2 and trades subscriptions when disabled or unmounted', () => {
    const fast = renderHook(
      ({ enabled }) =>
        usePerpsFastL2({
          coin: 'BTC',
          enabled,
          precision: { nSigFigs: 5, mantissa: null },
        }),
      { initialProps: { enabled: true } },
    );
    fast.rerender({ enabled: false });
    expect(mockFastUnsubscribes[0]).toHaveBeenCalledTimes(1);
    expect(fast.result.current.status).toBe('idle');

    const trades = renderHook(() =>
      usePerpsLatestTrade({ coin: 'BTC', enabled: true }),
    );
    trades.unmount();
    expect(mockTradeUnsubscribes[0]).toHaveBeenCalledTimes(1);
  });

  it('selects latest trade by time then tid without mutating the batch', () => {
    const batch = [
      trade({ tid: 2, time: 10, side: 'A' }),
      trade({ tid: 3, time: 10, side: 'B' }),
      trade({ tid: 4, time: 9 }),
      trade({ coin: 'ETH', tid: 99, time: 99 }),
    ];
    const original = [...batch];
    expect(selectLatestPerpsTrade(batch, 'BTC')).toEqual({
      coin: 'BTC',
      price: '100',
      side: 'buy',
      size: '1',
      tid: 3,
      time: 10,
    });
    expect(batch).toEqual(original);
  });

  it('retains latest trade as stale until the replayed callback', () => {
    const hook = renderHook(() =>
      usePerpsLatestTrade({ coin: 'BTC', enabled: true }),
    );
    act(() => mockTradeCallbacks[0]?.([trade({ tid: 2, time: 2 })]));
    expect(hook.result.current.trade?.tid).toBe(2);

    act(() => emit('close'));
    expect(hook.result.current).toMatchObject({
      status: 'stale',
      trade: expect.objectContaining({ tid: 2 }),
    });
    expect(mockTradeUnsubscribes[0]).not.toHaveBeenCalled();

    act(() => emit('open'));
    expect(hook.result.current.status).toBe('loading');
    act(() => mockTradeCallbacks[0]?.([trade({ tid: 3, time: 3 })]));
    expect(hook.result.current).toMatchObject({
      status: 'ready',
      trade: expect.objectContaining({ tid: 3 }),
    });
  });

  it('shares one SDK trades subscription across consumers of the same coin', () => {
    const first = renderHook(() =>
      usePerpsLatestTrade({ coin: 'BTC', enabled: true }),
    );
    const second = renderHook(() =>
      usePerpsLatestTrade({ coin: 'BTC', enabled: true }),
    );

    expect(mockWs.subscribeToTrades).toHaveBeenCalledTimes(1);
    act(() => mockTradeCallbacks[0]?.([trade({ tid: 7, time: 7 })]));
    expect(first.result.current.trade?.tid).toBe(7);
    expect(second.result.current.trade?.tid).toBe(7);

    first.unmount();
    expect(mockTradeUnsubscribes[0]).not.toHaveBeenCalled();
    second.unmount();
    expect(mockTradeUnsubscribes[0]).toHaveBeenCalledTimes(1);
  });
});
