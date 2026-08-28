import { act, renderHook } from '@testing-library/react-native';
import type { WsTrade } from '@rabby-wallet/hyperliquid-sdk';

const mockWsListeners = new Map<string, Set<(...args: any[]) => void>>();
const mockTradeCallbacks: Array<(trades: WsTrade[]) => void> = [];
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
  subscribeToTrades: jest.fn(
    (_coin: string, callback: (trades: WsTrade[]) => void) => {
      const unsubscribe = jest.fn();
      mockTradeCallbacks.push(callback);
      mockUnsubscribers.push(unsubscribe);
      return { unsubscribe };
    },
  ),
};
const mockSdk = { ws: mockWs };

jest.mock('@/core/apis/perps', () => ({
  apisPerps: {
    getPerpsSDK: () => mockSdk,
    getPerpsSDKSnapshot: () => mockSdk,
  },
}));

import {
  prewarmPerpsLatestTrade,
  resetPerpsLatestTradeRegistryForTests,
  subscribeToPerpsLatestTrade,
  usePerpsLatestTrade,
} from './usePerpsLatestTrade';

const trade = (time: number, tid = time, coin = 'BTC'): WsTrade => ({
  coin,
  hash: `hash-${tid}`,
  px: `${100 + time}`,
  side: 'B',
  sz: '1',
  tid,
  time,
  users: ['0x1', '0x2'],
});

const emitTrades = (trades: WsTrade[]) => {
  mockTradeCallbacks.at(-1)?.(trades);
};

describe('usePerpsLatestTrade shared registry', () => {
  beforeEach(() => {
    resetPerpsLatestTradeRegistryForTests();
    jest.clearAllMocks();
    mockWsListeners.clear();
    mockTradeCallbacks.length = 0;
    mockUnsubscribers.length = 0;
  });

  afterEach(() => {
    resetPerpsLatestTradeRegistryForTests();
    jest.useRealTimers();
  });

  it('shares prewarm with the scene and selects the newest valid trade', () => {
    const cancelPrewarm = prewarmPerpsLatestTrade({ coin: 'BTC' });
    const scene = renderHook(() =>
      usePerpsLatestTrade({ coin: 'BTC', enabled: true }),
    );
    expect(mockWs.subscribeToTrades).toHaveBeenCalledTimes(1);

    act(() => emitTrades([trade(2), trade(3), trade(1)]));
    expect(scene.result.current.trade).toMatchObject({ time: 3, tid: 3 });
    expect(scene.result.current.status).toBe('ready');
    expect(mockUnsubscribers[0]).not.toHaveBeenCalled();

    cancelPrewarm();
    scene.unmount();
    expect(mockUnsubscribers[0]).toHaveBeenCalledTimes(1);
  });

  it('shares the same socket subscription with an imperative consumer', () => {
    const listener = jest.fn();
    const detach = subscribeToPerpsLatestTrade('BTC', listener);
    const hook = renderHook(() =>
      usePerpsLatestTrade({ coin: 'BTC', enabled: true }),
    );

    expect(mockWs.subscribeToTrades).toHaveBeenCalledTimes(1);
    act(() => emitTrades([trade(4)]));
    expect(listener).toHaveBeenLastCalledWith(
      expect.objectContaining({
        identity: 'BTC',
        status: 'ready',
        trade: expect.objectContaining({ tid: 4, time: 4 }),
      }),
    );
    expect(hook.result.current.trade).toMatchObject({ tid: 4, time: 4 });

    detach();
    expect(mockUnsubscribers[0]).not.toHaveBeenCalled();
    hook.unmount();
    expect(mockUnsubscribers[0]).toHaveBeenCalledTimes(1);
  });

  it('publishes a prewarmed exact coin on the first identity-change render', () => {
    const renderHistory: Array<{
      identity: string;
      status: ReturnType<typeof usePerpsLatestTrade>['status'];
      tradeCoin: string | null;
    }> = [];
    const hook = renderHook(
      ({ coin }) => {
        const current = usePerpsLatestTrade({ coin, enabled: true });
        renderHistory.push({
          identity: current.identity,
          status: current.status,
          tradeCoin: current.trade?.coin ?? null,
        });
        return current;
      },
      { initialProps: { coin: 'BTC' } },
    );
    act(() => emitTrades([trade(1)]));
    prewarmPerpsLatestTrade({ coin: 'ETH' });
    act(() => emitTrades([trade(2, 2, 'ETH')]));
    renderHistory.length = 0;

    hook.rerender({ coin: 'ETH' });

    expect(renderHistory[0]).toEqual({
      identity: 'ETH',
      status: 'stale',
      tradeCoin: 'ETH',
    });
  });

  it('does not turn an invalid payload into a fresh revision', () => {
    const hook = renderHook(() =>
      usePerpsLatestTrade({ coin: 'BTC', enabled: true }),
    );
    act(() => emitTrades([trade(1)]));
    const revision = hook.result.current.revision;

    act(() => emitTrades([{ ...trade(2), coin: 'ETH' }]));
    expect(hook.result.current.revision).toBe(revision);
    expect(hook.result.current.trade?.time).toBe(1);
  });

  it('pauses publication without unsubscribing and waits for a post-resume trade frame', () => {
    jest.useFakeTimers();
    jest.setSystemTime(10_000);
    const hook = renderHook(
      ({ publicationEnabled }) =>
        usePerpsLatestTrade({
          coin: 'BTC',
          enabled: true,
          publicationEnabled,
        }),
      { initialProps: { publicationEnabled: true } },
    );
    act(() => emitTrades([trade(1)]));

    hook.rerender({ publicationEnabled: false });
    expect(hook.result.current.status).toBe('stale');
    jest.setSystemTime(11_000);
    act(() => emitTrades([trade(2)]));
    expect(hook.result.current.trade?.time).toBe(1);

    jest.setSystemTime(12_000);
    hook.rerender({ publicationEnabled: true });
    expect(hook.result.current.status).toBe('stale');
    expect(hook.result.current.trade?.time).toBe(2);
    expect(mockWs.subscribeToTrades).toHaveBeenCalledTimes(1);

    jest.setSystemTime(12_001);
    act(() => emitTrades([trade(3)]));
    expect(hook.result.current.status).toBe('ready');
    expect(hook.result.current.trade?.time).toBe(3);
  });
});
