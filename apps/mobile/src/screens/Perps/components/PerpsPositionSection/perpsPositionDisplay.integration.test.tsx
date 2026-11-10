import React from 'react';
import { act, renderHook } from '@testing-library/react-native';
import type { MarketData } from '@/hooks/perps/usePerpsStore';
import { createStoreActivityScope } from '@/core/state/storeActivity';
import { StoreActivityProvider } from '@/hooks/storeActivity/StoreActivityProvider';
import { useActivityStore } from '@/hooks/storeActivity/useActivityStore';
import { createPerpsPositionMarketSelector } from './perpsPositionDisplay';

jest.mock('@ledgerhq/react-native-hw-transport-ble', () => ({}));
// Keep the actual Perps Store, selector and publication scope. Only prevent
// unrelated import-time startup timers from initiating native/network work.
jest.useFakeTimers();
const { perpsStore } =
  require('@/hooks/perps/usePerpsStore') as typeof import('@/hooks/perps/usePerpsStore');
const initialState = perpsStore.getState();

const market = (name: string, markPx: string): MarketData => ({
  index: 0,
  name,
  displayName: name,
  logoUrl: 'https://example.invalid/coin.png',
  quoteAsset: 'USDC',
  maxLeverage: 20,
  minLeverage: 1,
  maxUsdValueSize: '100000',
  maintenanceMarginTiers: [],
  szDecimals: 4,
  pxDecimals: 2,
  dayBaseVlm: '100',
  dayNtlVlm: '1000',
  funding: '0',
  markPx,
  midPx: markPx,
  openInterest: '200',
  oraclePx: markPx,
  premium: '0',
  prevDayPx: '95',
  dexId: '',
});
const publish = (markets: MarketData[]) => {
  perpsStore.setState({
    marketData: markets,
    marketDataMap: Object.fromEntries(markets.map(item => [item.name, item])),
  });
};
afterEach(() => perpsStore.setState(initialState, true));
afterAll(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

it('publishes only the affected position market and catches up once after hidden source updates', () => {
  const btc = market('BTC', '100');
  const eth = market('ETH', '200');
  publish([btc, eth]);
  const scope = createStoreActivityScope({
    active: true,
    label: 'position-display-integration',
  });
  const wrapper = ({ children }: React.PropsWithChildren) => (
    <StoreActivityProvider scope={scope}>{children}</StoreActivityProvider>
  );
  const btcRendered = jest.fn();
  const ethRendered = jest.fn();
  const selectBtc = createPerpsPositionMarketSelector('BTC');
  const selectEth = createPerpsPositionMarketSelector('ETH');
  const btcHook = renderHook(
    () => {
      btcRendered();
      return useActivityStore(perpsStore, selectBtc);
    },
    { wrapper },
  );
  const ethHook = renderHook(
    () => {
      ethRendered();
      return useActivityStore(perpsStore, selectEth);
    },
    { wrapper },
  );
  try {
    const firstBtc = btcHook.result.current;
    const firstEth = ethHook.result.current;
    const btcRenders = btcRendered.mock.calls.length;
    const ethRenders = ethRendered.mock.calls.length;
    act(() => {
      publish([
        { ...btc, midPx: '105', funding: '0.1' },
        { ...eth },
        market('SOL', '300'),
      ]);
      perpsStore.setState({ favoriteMarkets: ['SOL'] });
    });
    expect(perpsStore.getState().marketDataMap.BTC.midPx).toBe('105');
    expect(btcHook.result.current).toBe(firstBtc);
    expect(ethHook.result.current).toBe(firstEth);
    expect(btcRendered).toHaveBeenCalledTimes(btcRenders);
    expect(ethRendered).toHaveBeenCalledTimes(ethRenders);

    act(() => publish([{ ...btc, markPx: '110' }, { ...eth }]));
    expect(btcHook.result.current?.markPx).toBe('110');
    expect(btcRendered).toHaveBeenCalledTimes(btcRenders + 1);
    expect(ethHook.result.current).toBe(firstEth);
    expect(ethRendered).toHaveBeenCalledTimes(ethRenders);

    act(() => scope.setActive(false));
    const visibleBtc = btcHook.result.current;
    const hiddenBtcRenders = btcRendered.mock.calls.length;
    const hiddenEthRenders = ethRendered.mock.calls.length;
    act(() =>
      publish([
        { ...btc, markPx: '120' },
        { ...eth, markPx: '220' },
      ]),
    );
    act(() =>
      publish([
        { ...btc, markPx: '130' },
        { ...eth, markPx: '230' },
      ]),
    );
    expect(perpsStore.getState().marketDataMap.BTC.markPx).toBe('130');
    expect(perpsStore.getState().marketDataMap.ETH.markPx).toBe('230');
    expect(btcHook.result.current).toBe(visibleBtc);
    expect(ethHook.result.current).toBe(firstEth);
    expect(btcRendered).toHaveBeenCalledTimes(hiddenBtcRenders);
    expect(ethRendered).toHaveBeenCalledTimes(hiddenEthRenders);

    act(() => scope.setActive(true));
    expect(btcHook.result.current?.markPx).toBe('130');
    expect(ethHook.result.current?.markPx).toBe('230');
    expect(btcRendered).toHaveBeenCalledTimes(hiddenBtcRenders + 1);
    expect(ethRendered).toHaveBeenCalledTimes(hiddenEthRenders + 1);
  } finally {
    btcHook.unmount();
    ethHook.unmount();
    scope.dispose();
  }
  expect(scope.getDiagnostics().stores).toEqual([]);
});

it('reads the new exact coin when a consumer changes its selector and handles removal/restoration', () => {
  const btc = market('BTC', '100');
  const dexBtc = market('xyz:BTC', '200');
  publish([btc, dexBtc]);
  const scope = createStoreActivityScope({
    active: true,
    label: 'position-coin-integration',
  });
  const hook = renderHook(
    ({ coin }: { coin: string }) => {
      const select = React.useMemo(
        () => createPerpsPositionMarketSelector(coin),
        [coin],
      );
      return useActivityStore(perpsStore, select);
    },
    {
      initialProps: { coin: 'BTC' },
      wrapper: ({ children }) => (
        <StoreActivityProvider scope={scope}>{children}</StoreActivityProvider>
      ),
    },
  );
  try {
    expect(hook.result.current?.markPx).toBe('100');
    hook.rerender({ coin: 'xyz:BTC' });
    expect(hook.result.current).toMatchObject({
      name: 'xyz:BTC',
      markPx: '200',
    });
    act(() => publish([btc]));
    expect(hook.result.current).toBeUndefined();
    act(() => publish([btc, { ...dexBtc, markPx: '250' }]));
    expect(hook.result.current).toMatchObject({
      name: 'xyz:BTC',
      markPx: '250',
    });
    hook.rerender({ coin: 'btc' });
    expect(hook.result.current).toBeUndefined();
    hook.rerender({ coin: 'BTC' });
    expect(hook.result.current?.markPx).toBe('100');
  } finally {
    hook.unmount();
    scope.dispose();
  }
  expect(scope.getDiagnostics().stores).toEqual([]);
});
