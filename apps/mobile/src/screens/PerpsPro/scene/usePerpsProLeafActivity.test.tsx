import React, { StrictMode, type ReactNode } from 'react';
import { act, cleanupAsync, renderHook } from '@testing-library/react-native';

import {
  createStoreActivityScope,
  type StoreActivityScope,
} from '@/core/state/storeActivity';
import {
  StoreActivityProvider,
  useStoreActivityScope,
} from '@/hooks/storeActivity/StoreActivityProvider';
import { perpsStore, type MarketData } from '@/hooks/perps/usePerpsStore';

import { usePerpsProMarketIdentity } from './usePerpsProMarketIdentity';
import { usePerpsProPositionMark } from './usePerpsProPositionMark';

// Component/unit coverage: the leaf hooks and activity scopes are real, but
// Perps service/network orchestration is deliberately outside this contract.
jest.mock('@/hooks/perps/usePerpsStore', () => {
  const { create } = require('zustand');
  return {
    perpsStore: create(() => ({ marketDataMap: {} })),
  };
});

const market = (coin: string, markPx: string): MarketData => ({
  dayBaseVlm: '1',
  dayNtlVlm: '100',
  dexId: '',
  displayName: coin,
  funding: '0',
  index: 0,
  logoUrl: '',
  maintenanceMarginTiers: [],
  markPx,
  maxLeverage: 20,
  maxUsdValueSize: '1000000',
  midPx: markPx,
  minLeverage: 1,
  name: coin,
  openInterest: '1',
  oraclePx: markPx,
  premium: '0',
  prevDayPx: markPx,
  pxDecimals: 2,
  quoteAsset: 'USDC',
  szDecimals: 5,
});

function updateMarket(coin: string, changes: Partial<MarketData>) {
  perpsStore.setState(state => ({
    marketDataMap: {
      ...state.marketDataMap,
      [coin]: { ...state.marketDataMap[coin], ...changes },
    },
  }));
}

function wrapperFor(scope: StoreActivityScope, strict = false) {
  return function Wrapper({ children }: { children: ReactNode }) {
    const content = (
      <StoreActivityProvider scope={scope}>{children}</StoreActivityProvider>
    );
    return strict ? <StrictMode>{content}</StrictMode> : content;
  };
}

describe('Perps Pro activity-aware leaf hooks', () => {
  let now = 0;

  beforeEach(() => {
    now = 0;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    perpsStore.setState({
      marketDataMap: {
        BTC: market('BTC', '64000'),
        ETH: market('ETH', '3000'),
      },
    });
  });

  afterEach(async () => {
    await cleanupAsync();
    jest.restoreAllMocks();
  });

  it('preserves the event-driven 500ms display window while active', () => {
    const scope = createStoreActivityScope();
    const { result } = renderHook(() => usePerpsProPositionMark('BTC'), {
      wrapper: wrapperFor(scope),
    });
    const initial = result.current;

    act(() => {
      now = 100;
      updateMarket('BTC', { markPx: '64001' });
      now = 499;
      updateMarket('BTC', { markPx: '64002' });
    });
    expect(result.current).toBe(initial);

    act(() => {
      now = 500;
      updateMarket('BTC', { markPx: '64003' });
    });
    expect(result.current.markPrice).toBe('64003');
    const firstPublished = result.current;

    act(() => {
      now = 999;
      updateMarket('BTC', { markPx: '64004' });
    });
    expect(result.current).toBe(firstPublished);

    act(() => {
      now = 1000;
      updateMarket('BTC', { markPx: '64005' });
    });
    expect(result.current.markPrice).toBe('64005');
    const latest = result.current;

    act(() => {
      now = 1500;
      updateMarket('ETH', { markPx: '3001' });
    });
    expect(result.current).toBe(latest);
  });

  it('publishes missing marks and hydration immediately inside the display window', () => {
    const scope = createStoreActivityScope();
    const { result } = renderHook(() => usePerpsProPositionMark('BTC'), {
      wrapper: wrapperFor(scope),
    });

    act(() => {
      now = 100;
      perpsStore.setState({ marketDataMap: {} });
    });
    expect(result.current).toEqual(
      expect.objectContaining({ markPrice: null, metadataReady: false }),
    );

    act(() => {
      now = 101;
      perpsStore.setState({ marketDataMap: { BTC: market('BTC', '65000') } });
    });
    expect(result.current).toEqual(
      expect.objectContaining({ markPrice: '65000', metadataReady: true }),
    );
  });

  it('stops the shared source subscription while hidden and catches up once immediately', () => {
    const scope = createStoreActivityScope();
    let renders = 0;
    const { result, rerender } = renderHook(
      () => {
        renders += 1;
        return {
          identity: usePerpsProMarketIdentity('BTC'),
          position: usePerpsProPositionMark('BTC'),
        };
      },
      { wrapper: wrapperFor(scope) },
    );
    const initial = result.current;
    const initialRenders = renders;
    expect(scope.getDiagnostics().stores).toEqual([
      expect.objectContaining({ consumerCount: 2, sourceSubscribed: true }),
    ]);

    act(() => {
      scope.setActive(false);
      now = 100;
      for (let tick = 1; tick <= 100; tick += 1) {
        updateMarket('BTC', {
          markPx: `${64000 + tick}`,
          quoteAsset: 'USDE',
          pxDecimals: 3,
        });
      }
    });
    expect(result.current).toBe(initial);
    expect(renders).toBe(initialRenders);
    expect(scope.getDiagnostics().stores).toEqual([
      expect.objectContaining({
        sourceSubscribed: false,
        sourceNotificationCount: 0,
        publishedNotificationCount: 0,
      }),
    ]);

    // A parent render must still read the inactive snapshot, not live state.
    rerender({});
    expect(result.current.identity).toBe(initial.identity);
    expect(result.current.position).toBe(initial.position);
    const rendersBeforeResume = renders;

    act(() => scope.setActive(true));
    expect(result.current.position.markPrice).toBe('64100');
    expect(result.current.identity).toEqual(
      expect.objectContaining({ displayPair: 'BTCUSDE', pxDecimals: 3 }),
    );
    expect(renders).toBe(rendersBeforeResume + 1);
    expect(scope.getDiagnostics().stores).toEqual([
      expect.objectContaining({ sourceSubscribed: true, catchUpCount: 1 }),
    ]);

    act(() => {
      now = 599;
      updateMarket('BTC', { markPx: '64101' });
    });
    expect(result.current.position.markPrice).toBe('64100');
    act(() => {
      now = 600;
      updateMarket('BTC', { markPx: '64102' });
    });
    expect(result.current.position.markPrice).toBe('64102');
  });

  it('catches up a suppressed pre-blur tick even without any hidden source update', () => {
    const scope = createStoreActivityScope();
    const { result } = renderHook(() => usePerpsProPositionMark('BTC'), {
      wrapper: wrapperFor(scope),
    });

    act(() => {
      now = 100;
      updateMarket('BTC', { markPx: '64100' });
    });
    expect(result.current.markPrice).toBe('64000');
    act(() => {
      scope.setActive(false);
      now = 150;
      scope.setActive(true);
    });
    expect(result.current.markPrice).toBe('64100');
    expect(scope.getDiagnostics().stores[0].catchUpCount).toBe(0);
  });

  it('does not subscribe on an inactive mount and resumes from the latest source', () => {
    const scope = createStoreActivityScope({ active: false });
    const { result } = renderHook(() => usePerpsProPositionMark('BTC'), {
      wrapper: wrapperFor(scope),
    });
    expect(scope.getDiagnostics().stores[0].sourceSubscribeCount).toBe(0);

    act(() => {
      now = 10;
      updateMarket('BTC', { markPx: '65000' });
    });
    expect(result.current.markPrice).toBe('64000');
    act(() => scope.setActive(true));
    expect(result.current.markPrice).toBe('65000');
  });

  it('keeps the same coin independent across active and inactive scope snapshots', () => {
    const visibleScope = createStoreActivityScope();
    const hiddenScope = createStoreActivityScope();
    const visible = renderHook(() => usePerpsProPositionMark('BTC'), {
      wrapper: wrapperFor(visibleScope),
    });
    const hidden = renderHook(() => usePerpsProPositionMark('BTC'), {
      wrapper: wrapperFor(hiddenScope),
    });

    act(() => {
      hiddenScope.setActive(false);
      now = 500;
      updateMarket('BTC', { markPx: '65000' });
    });
    expect(visible.result.current.markPrice).toBe('65000');
    expect(hidden.result.current.markPrice).toBe('64000');

    now = 1000;
    hidden.rerender({});
    visible.rerender({});
    expect(visible.result.current.markPrice).toBe('65000');
    expect(hidden.result.current.markPrice).toBe('64000');

    act(() => updateMarket('BTC', { markPx: '66000' }));
    expect(visible.result.current.markPrice).toBe('66000');
    act(() => hiddenScope.setActive(true));
    expect(hidden.result.current.markPrice).toBe('66000');
  });

  it('uses narrow identity equality for price-only updates', () => {
    const scope = createStoreActivityScope();
    let renders = 0;
    const { result } = renderHook(
      () => {
        renders += 1;
        return usePerpsProMarketIdentity('BTC');
      },
      { wrapper: wrapperFor(scope) },
    );
    const initial = result.current;

    act(() => {
      now = 500;
      updateMarket('BTC', { markPx: '65000' });
      updateMarket('ETH', { quoteAsset: 'USDE' });
    });
    expect(result.current).toBe(initial);
    expect(renders).toBe(1);
    act(() => updateMarket('BTC', { szDecimals: 4 }));
    expect(result.current.szDecimals).toBe(4);
    expect(renders).toBe(2);
  });

  it('cleans activity listeners and source subscriptions after StrictMode and re-keying', () => {
    const scope = createStoreActivityScope();
    const subscribe = scope.subscribe;
    const unsubscribers: jest.Mock[] = [];
    jest.spyOn(scope, 'subscribe').mockImplementation(listener => {
      const unsubscribe = jest.fn(subscribe(listener));
      unsubscribers.push(unsubscribe);
      return unsubscribe;
    });
    const { result, rerender, unmount } = renderHook(
      ({ coin }) => usePerpsProPositionMark(coin),
      { initialProps: { coin: 'BTC' }, wrapper: wrapperFor(scope, true) },
    );

    for (let key = 0; key < 10; key += 1) {
      const coin = key % 2 === 0 ? 'ETH' : 'BTC';
      rerender({ coin });
      expect(result.current.markPrice).toBe(coin === 'BTC' ? '64000' : '3000');
      expect(scope.getDiagnostics().stores).toEqual([
        expect.objectContaining({ consumerCount: 1, sourceSubscribed: true }),
      ]);
    }
    unmount();
    expect(scope.getDiagnostics().stores).toEqual([
      expect.objectContaining({ consumerCount: 0, sourceSubscribed: false }),
    ]);
    unsubscribers.forEach(unsubscribe =>
      expect(unsubscribe).toHaveBeenCalledTimes(1),
    );
  });

  it('keeps the fallback scope active without retaining per-hook display adapters', () => {
    const { result, rerender, unmount } = renderHook(
      ({ coin }) => ({
        position: usePerpsProPositionMark(coin),
        scope: useStoreActivityScope(),
      }),
      { initialProps: { coin: 'BTC' } },
    );
    const scope = result.current.scope;
    act(() => {
      now = 500;
      updateMarket('BTC', { markPx: '65000' });
    });
    expect(result.current.position.markPrice).toBe('65000');

    for (let key = 0; key < 10; key += 1) {
      rerender({ coin: key % 2 === 0 ? 'ETH' : 'BTC' });
      expect(scope.getDiagnostics().stores).toHaveLength(1);
    }
    unmount();
    expect(scope.getDiagnostics().stores).toEqual([
      expect.objectContaining({ consumerCount: 0, sourceSubscribed: false }),
    ]);
  });
});
