import type {
  WsActiveAssetCtx,
  WsActiveAssetData,
} from '@rabby-wallet/hyperliquid-sdk';
import { act, renderHook } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

import {
  readActiveAssetDataFromCache,
  writeActiveAssetDataToCache,
} from '../useActiveAssetDataCache';
import { perpsStore } from '../usePerpsStore';
import { useActiveAssetSubscription } from './useActiveAssetSubscription';

const mockContextCallbacks: Array<(value: WsActiveAssetCtx) => void> = [];
const mockDataCallbacks: Array<(value: WsActiveAssetData) => void> = [];
const mockContextUnsubscribes: jest.Mock[] = [];
const mockDataUnsubscribes: jest.Mock[] = [];
const mockListeners = new Map<string, Set<() => void>>();
const mockGetActiveAssetData = jest.fn();
const mockWs = {
  on: jest.fn((event: string, listener: () => void) => {
    const listeners = mockListeners.get(event) ?? new Set();
    listeners.add(listener);
    mockListeners.set(event, listeners);
  }),
  off: jest.fn((event: string, listener: () => void) => {
    mockListeners.get(event)?.delete(listener);
  }),
  subscribeToActiveAssetCtx: jest.fn(
    (_coin: string, callback: (value: WsActiveAssetCtx) => void) => {
      const unsubscribe = jest.fn();
      mockContextCallbacks.push(callback);
      mockContextUnsubscribes.push(unsubscribe);
      return { unsubscribe };
    },
  ),
  subscribeToActiveAssetData: jest.fn(
    (
      _coin: string,
      _address: string,
      callback: (value: WsActiveAssetData) => void,
    ) => {
      const unsubscribe = jest.fn();
      mockDataCallbacks.push(callback);
      mockDataUnsubscribes.push(unsubscribe);
      return { unsubscribe };
    },
  ),
};

jest.mock('@/core/apis/perps', () => ({
  apisPerps: {
    getPerpsSDK: () => ({
      ws: mockWs,
      info: { getActiveAssetData: mockGetActiveAssetData },
    }),
  },
}));
jest.mock('@/hooks/perps/usePerpsStore', () => ({
  perpsStore: require('zustand').create(() => ({ currentPerpsAccount: null })),
}));

const address = '0x0000000000000000000000000000000000000001';
const otherAddress = '0x0000000000000000000000000000000000000002';
let fixtureId = 0;
let coin: string;
let appStateListener: (state: AppStateStatus) => void;
const data = (market = coin, user = address): WsActiveAssetData => ({
  availableToTrade: ['100', '100'],
  coin: market,
  leverage: { type: 'cross', value: 10 },
  markPx: '1',
  maxTradeSzs: ['100', '100'],
  user,
});
const context = (markPx = '1', market = coin): WsActiveAssetCtx => ({
  coin: market,
  ctx: {
    dayNtlVlm: '1000',
    funding: '0',
    impactPxs: [markPx, markPx],
    markPx,
    midPx: markPx,
    openInterest: '100',
    oraclePx: markPx,
    prevDayPx: '1',
  },
});
const setAddress = (value: string) => {
  perpsStore.setState({
    currentPerpsAccount: { address: value } as never,
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetActiveAssetData.mockReset();
  mockContextCallbacks.length = 0;
  mockDataCallbacks.length = 0;
  mockContextUnsubscribes.length = 0;
  mockDataUnsubscribes.length = 0;
  mockListeners.clear();
  coin = `CONTEXT_SUBSCRIPTION_${++fixtureId}`;
  setAddress(address);
  Object.defineProperty(AppState, 'currentState', {
    configurable: true,
    value: 'active',
  });
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_, callback) => {
    appStateListener = callback;
    return { remove: jest.fn() };
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

it('keeps both Simple feeds enabled by default', () => {
  const hook = renderHook(() => useActiveAssetSubscription(coin));
  expect(mockWs.subscribeToActiveAssetCtx).toHaveBeenCalledWith(
    coin,
    expect.any(Function),
  );
  expect(mockWs.subscribeToActiveAssetData).toHaveBeenCalledWith(
    coin,
    address,
    expect.any(Function),
  );
  expect(mockWs.on).not.toHaveBeenCalled();
  const ctx = context();
  const assetData = data();
  act(() => {
    mockContextCallbacks[0](ctx);
    mockDataCallbacks[0](assetData);
  });
  expect(hook.result.current.activeAssetCtx).toBe(ctx.ctx);
  expect(hook.result.current.displayAssetCtx).toBe(ctx.ctx);
  expect(hook.result.current.activeAssetData).toBe(assetData);
  hook.unmount();
  expect(mockContextUnsubscribes[0]).toHaveBeenCalledTimes(1);
  expect(mockDataUnsubscribes[0]).toHaveBeenCalledTimes(1);
});

it('disables context and freshness only, preserving cached data, WS data and refresh', async () => {
  const cached = data();
  writeActiveAssetDataToCache(coin, address, cached);
  const hook = renderHook(() =>
    useActiveAssetSubscription(coin, {
      contextEnabled: false,
      trackContextFreshness: true,
    }),
  );
  expect(mockWs.subscribeToActiveAssetCtx).not.toHaveBeenCalled();
  expect(mockWs.on).not.toHaveBeenCalled();
  expect(hook.result.current.activeAssetData).toBe(cached);
  expect(hook.result.current.activeAssetCtx).toBeNull();
  expect(hook.result.current.displayAssetCtx).toBeNull();

  const pushed = { ...data(), markPx: '2' };
  act(() => mockDataCallbacks[0](pushed));
  expect(hook.result.current.activeAssetData).toBe(pushed);
  expect(readActiveAssetDataFromCache(coin, address)).toBe(pushed);

  const refreshed = { ...data(), markPx: '3' };
  mockGetActiveAssetData.mockResolvedValueOnce(refreshed);
  await act(async () => {
    await expect(hook.result.current.refreshActiveAssetData()).resolves.toBe(
      refreshed,
    );
  });
  expect(mockGetActiveAssetData).toHaveBeenCalledWith(coin, address);
  expect(hook.result.current.activeAssetData).toBe(refreshed);
  expect(readActiveAssetDataFromCache(coin, address)).toBe(refreshed);
});

it('clears context on opt-out and rejects old callbacks even after opting back in', () => {
  const renderProbe = jest.fn();
  const hook = renderHook(
    ({ contextEnabled }) => {
      renderProbe();
      return useActiveAssetSubscription(coin, {
        contextEnabled,
        trackContextFreshness: true,
      });
    },
    { initialProps: { contextEnabled: true } },
  );
  act(() => mockContextCallbacks[0](context()));
  expect(hook.result.current.displayAssetCtx).not.toBeNull();
  hook.rerender({ contextEnabled: false });
  expect(mockContextUnsubscribes[0]).toHaveBeenCalledTimes(1);
  expect(mockWs.off).toHaveBeenCalledTimes(2);
  expect(hook.result.current.activeAssetCtx).toBeNull();
  expect(hook.result.current.displayAssetCtx).toBeNull();
  renderProbe.mockClear();
  act(() => mockContextCallbacks[0](context('obsolete')));
  expect(renderProbe).not.toHaveBeenCalled();

  hook.rerender({ contextEnabled: true });
  expect(mockWs.subscribeToActiveAssetCtx).toHaveBeenCalledTimes(2);
  const current = context('2');
  act(() => mockContextCallbacks[1](current));
  renderProbe.mockClear();
  act(() => mockContextCallbacks[0](context('late')));
  expect(renderProbe).not.toHaveBeenCalled();
  expect(hook.result.current.activeAssetCtx).toBe(current.ctx);
  expect(hook.result.current.displayAssetCtx).toBe(current.ctx);
});

it('rejects same-coin stale context after a market round trip', () => {
  const hook = renderHook(market => useActiveAssetSubscription(market), {
    initialProps: coin,
  });
  hook.rerender(`${coin}_OTHER`);
  hook.rerender(coin);
  const current = context('2');
  act(() => mockContextCallbacks[2](current));
  act(() => mockContextCallbacks[0](context('late')));
  expect(hook.result.current.activeAssetCtx).toBe(current.ctx);
  expect(mockContextUnsubscribes[0]).toHaveBeenCalledTimes(1);
  expect(mockContextUnsubscribes[1]).toHaveBeenCalledTimes(1);
});

it('preserves account switching and ignores previous-account frames with context disabled', () => {
  const otherData = data(coin, otherAddress);
  writeActiveAssetDataToCache(coin, otherAddress, otherData);
  const hook = renderHook(() =>
    useActiveAssetSubscription(coin, { contextEnabled: false }),
  );
  act(() => mockDataCallbacks[0](data()));
  act(() => setAddress(otherAddress));
  expect(mockDataUnsubscribes[0]).toHaveBeenCalledTimes(1);
  expect(mockWs.subscribeToActiveAssetData).toHaveBeenLastCalledWith(
    coin,
    otherAddress,
    expect.any(Function),
  );
  expect(hook.result.current.activeAssetData).toBe(otherData);
  act(() => mockDataCallbacks[0]({ ...data(), markPx: 'late' }));
  expect(hook.result.current.activeAssetData).toBe(otherData);
  const pushed = { ...otherData, markPx: '2' };
  act(() => mockDataCallbacks[1](pushed));
  expect(hook.result.current.activeAssetData).toBe(pushed);
  expect(mockWs.subscribeToActiveAssetCtx).not.toHaveBeenCalled();
});

it('retains foreground resubscription of account data without subscribing to context', () => {
  const hook = renderHook(() =>
    useActiveAssetSubscription(coin, { contextEnabled: false }),
  );
  act(() => appStateListener('background'));
  act(() => appStateListener('active'));
  expect(mockDataUnsubscribes[0]).toHaveBeenCalledTimes(1);
  expect(mockWs.subscribeToActiveAssetData).toHaveBeenCalledTimes(2);
  expect(mockWs.subscribeToActiveAssetCtx).not.toHaveBeenCalled();
  act(() => mockDataCallbacks[1](data()));
  expect(hook.result.current.activeAssetData?.coin).toBe(coin);
});

it('preserves freshness invalidation and fences old context after foreground resubscription', () => {
  const hook = renderHook(() =>
    useActiveAssetSubscription(coin, { trackContextFreshness: true }),
  );
  const initial = context();
  act(() => mockContextCallbacks[0](initial));
  act(() => mockListeners.get('close')?.forEach(callback => callback()));
  expect(hook.result.current.displayAssetCtx).toBeNull();
  expect(hook.result.current.activeAssetCtx).toBe(initial.ctx);
  act(() => mockContextCallbacks[0](context('2')));
  act(() => appStateListener('background'));
  expect(hook.result.current.displayAssetCtx).toBeNull();
  act(() => appStateListener('active'));
  const current = context('3');
  act(() => mockContextCallbacks[1](current));
  act(() => mockContextCallbacks[0](context('late')));
  expect(hook.result.current.activeAssetCtx).toBe(current.ctx);
  expect(hook.result.current.displayAssetCtx).toBe(current.ctx);
});

it('still lets the general enabled option stop both feeds', () => {
  const hook = renderHook(
    ({ enabled }) => useActiveAssetSubscription(coin, { enabled }),
    { initialProps: { enabled: true } },
  );
  hook.rerender({ enabled: false });
  act(() => mockContextCallbacks[0](context('late')));
  expect(hook.result.current.activeAssetCtx).toBeNull();
  expect(mockContextUnsubscribes[0]).toHaveBeenCalledTimes(1);
  expect(mockDataUnsubscribes[0]).toHaveBeenCalledTimes(1);
  act(() => appStateListener('background'));
  act(() => appStateListener('active'));
  expect(mockWs.subscribeToActiveAssetCtx).toHaveBeenCalledTimes(1);
  expect(mockWs.subscribeToActiveAssetData).toHaveBeenCalledTimes(1);
});
