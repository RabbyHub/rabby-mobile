import React from 'react';
import { act, renderHook } from '@testing-library/react-native';
import type { AssetPosition, OpenOrder } from '@rabby-wallet/hyperliquid-sdk';
import { createStoreActivityScope } from '@/core/state/storeActivity';
import { StoreActivityProvider } from '@/hooks/storeActivity/StoreActivityProvider';
import { useActivityStore } from '@/hooks/storeActivity/useActivityStore';
import { createPerpsSimpleDisplaySelector } from './perpsDisplaySelectors';

jest.mock('@ledgerhq/react-native-hw-transport-ble', () => ({}));
// Real Perps Store + selector + activity publication; prevent unrelated
// import-time startup timers from initiating service/network work in Node.
jest.useFakeTimers();
const { perpsStore } =
  require('./usePerpsStore') as typeof import('./usePerpsStore');
const initialState = perpsStore.getState();
const position = (szi: string): AssetPosition => ({
  type: 'oneWay',
  position: {
    coin: 'BTC',
    szi,
    entryPx: '100',
    liquidationPx: '80',
    cumFunding: { allTime: '0', sinceChange: '0', sinceOpen: '0' },
    leverage: { type: 'cross', value: 5 },
    marginUsed: '20',
    maxLeverage: 20,
    positionValue: '100',
    returnOnEquity: '0',
    unrealizedPnl: '0',
  },
});
const clearinghouse = (assetPositions: AssetPosition[], time: number) => ({
  assetPositions,
  time,
  withdrawable: '1',
  crossMaintenanceMarginUsed: '0',
  marginSummary: {
    accountValue: '1',
    totalMarginUsed: '0',
    totalNtlPos: '0',
    totalRawUsd: '1',
  },
  crossMarginSummary: {
    accountValue: '1',
    totalMarginUsed: '0',
    totalNtlPos: '0',
    totalRawUsd: '1',
  },
  crossMaintByDex: {},
  perDexSummaries: {},
});
const order: OpenOrder = {
  coin: 'BTC',
  oid: 1,
  side: 'B',
  limitPx: '100',
  sz: '1',
  timestamp: 1,
  triggerCondition: '',
  isTrigger: false,
  triggerPx: '0',
  isPositionTpsl: false,
  reduceOnly: false,
  orderType: 'Limit',
  origSz: '1',
  tif: 'Gtc',
};

afterEach(() => perpsStore.setState(initialState, true));
afterAll(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

it('keeps Simple presentation local while the real Store converges, then catches up once after activity resumes', () => {
  perpsStore.setState(
    {
      ...initialState,
      isInitialized: true,
      hasPermission: true,
      currentClearinghouseState: clearinghouse([], 1),
      openOrders: [],
    },
    true,
  );
  const select = createPerpsSimpleDisplaySelector();
  const scope = createStoreActivityScope({
    active: true,
    label: 'simple-display-integration',
  });
  const rendered = jest.fn();
  const { result, unmount } = renderHook(
    () => {
      rendered();
      return useActivityStore(perpsStore, select);
    },
    {
      wrapper: ({ children }) => (
        <StoreActivityProvider scope={scope}>{children}</StoreActivityProvider>
      ),
    },
  );
  try {
    const initial = result.current;
    const initialRenders = rendered.mock.calls.length;
    act(() =>
      perpsStore.setState({
        favoriteMarkets: ['ETH'],
        perpFee: 0.001,
        userFills: [],
        userAccountHistory: [],
        localLoadingHistory: [],
        currentClearinghouseState: clearinghouse([], 2),
      }),
    );
    expect(perpsStore.getState().favoriteMarkets).toEqual(['ETH']);
    expect(result.current).toBe(initial);
    expect(rendered).toHaveBeenCalledTimes(initialRenders);

    act(() =>
      perpsStore.setState({
        currentClearinghouseState: clearinghouse([position('1')], 3),
        openOrders: [order],
      }),
    );
    expect(result.current.positionAndOpenOrders[0]).toEqual({
      ...position('1'),
      openOrders: [order],
    });
    const visible = result.current;
    const visibleRenders = rendered.mock.calls.length;
    // New payload identities with identical complete business content are not
    // an update to the presentation. Source freshness still advances.
    act(() =>
      perpsStore.setState({
        currentClearinghouseState: clearinghouse([position('1')], 4),
        openOrders: [{ ...order }],
      }),
    );
    expect(perpsStore.getState().currentClearinghouseState?.time).toBe(4);
    expect(result.current).toBe(visible);
    expect(rendered).toHaveBeenCalledTimes(visibleRenders);

    act(() => scope.setActive(false));
    const hiddenRenders = rendered.mock.calls.length;
    act(() =>
      perpsStore.setState({
        currentClearinghouseState: clearinghouse([position('2')], 5),
      }),
    );
    act(() =>
      perpsStore.setState({
        currentClearinghouseState: clearinghouse([position('3')], 6),
        openOrders: [{ ...order, sz: '3' }],
        hasPermission: false,
      }),
    );
    expect(
      perpsStore.getState().currentClearinghouseState?.assetPositions[0]
        .position.szi,
    ).toBe('3');
    expect(result.current).toBe(visible);
    expect(rendered).toHaveBeenCalledTimes(hiddenRenders);
    act(() => scope.setActive(true));
    expect(result.current.hasPermission).toBe(false);
    expect(result.current.positionAndOpenOrders[0]).toEqual({
      ...position('3'),
      openOrders: [{ ...order, sz: '3' }],
    });
    expect(rendered).toHaveBeenCalledTimes(hiddenRenders + 1);
  } finally {
    unmount();
    scope.dispose();
  }
  expect(scope.getDiagnostics().stores).toEqual([]);
});
