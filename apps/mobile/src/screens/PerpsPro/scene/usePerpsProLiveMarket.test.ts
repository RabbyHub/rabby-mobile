import { act, renderHook } from '@testing-library/react-native';

import { perpsStore, type MarketData } from '@/hooks/perps/usePerpsStore';
import {
  selectPerpsProMarketData,
  usePerpsProLiveMarket,
} from './usePerpsProLiveMarket';

jest.mock('@/hooks/perps/usePerpsStore', () => ({
  perpsStore: require('zustand').create(() => ({
    marketData: [],
    marketDataMap: {},
  })),
}));

const marketData = (name = 'BTC'): MarketData => ({
  name,
  displayName: name,
  dexId: '',
  index: 0,
  logoUrl: '',
  quoteAsset: 'USDC',
  markPx: '100',
  midPx: '101',
  prevDayPx: '80',
  oraclePx: '100',
  funding: '0',
  premium: '0',
  openInterest: '10',
  dayBaseVlm: '5',
  dayNtlVlm: '500',
  maxLeverage: 40,
  minLeverage: 1,
  maxUsdValueSize: '1000000',
  maintenanceMarginTiers: [],
  szDecimals: 3,
  pxDecimals: 2,
});

describe('Perps Pro live market selection', () => {
  beforeEach(() => {
    perpsStore.setState({ marketData: [], marketDataMap: {} });
  });

  it('prefers the map and falls back only to the matching canonical array item', () => {
    const older = marketData();
    const latest = { ...older, markPx: '120' };
    const eth = marketData('ETH');
    const state = { marketData: [older, eth], marketDataMap: { BTC: latest } };
    expect(selectPerpsProMarketData(state, 'BTC')).toBe(latest);
    expect(selectPerpsProMarketData(state, 'ETH')).toBe(eth);
    expect(selectPerpsProMarketData(state, 'SUI')).toBeNull();
    expect(selectPerpsProMarketData(state, '')).toBeNull();
  });

  it('converges from absent metadata through array fallback to a current map snapshot', () => {
    const hook = renderHook(() => usePerpsProLiveMarket('BTC'));
    expect(hook.result.current).toBeNull();
    const initial = marketData();
    act(() => perpsStore.setState({ marketData: [initial] }));
    expect(hook.result.current?.marketData).toBe(initial);
    const latest = {
      ...initial,
      displayName: 'Bitcoin',
      quoteAsset: 'USDT' as const,
      markPx: '120',
      midPx: '121',
      maxLeverage: 8,
      onlyIsolated: true,
    };
    act(() => perpsStore.setState({ marketDataMap: { BTC: latest } }));
    expect(hook.result.current).toMatchObject({
      canonicalCoin: 'BTC',
      displayPair: 'BitcoinUSDT',
      price: 120,
      change24h: 0.5,
    });
    expect(hook.result.current?.marketData).toBe(latest);
  });

  it('keeps its snapshot and render count stable for another market or unrelated state', () => {
    const btc = marketData();
    const eth = marketData('ETH');
    perpsStore.setState({
      marketData: [btc, eth],
      marketDataMap: { BTC: btc, ETH: eth },
    });
    let renders = 0;
    const hook = renderHook(() => {
      renders += 1;
      return usePerpsProLiveMarket('BTC');
    });
    const original = hook.result.current;
    const initialRenders = renders;
    act(() => perpsStore.setState({ hasPermission: false }));
    act(() =>
      perpsStore.setState({
        marketDataMap: { BTC: btc, ETH: { ...eth, markPx: '140' } },
      }),
    );
    expect(hook.result.current).toBe(original);
    expect(renders).toBe(initialRenders);
  });

  it('switches identity synchronously and never retains the previous market when the next is missing', () => {
    const btc = marketData();
    const eth = marketData('ETH');
    perpsStore.setState({
      marketData: [btc, eth],
      marketDataMap: { BTC: btc, ETH: eth },
    });
    const hook = renderHook(({ coin }) => usePerpsProLiveMarket(coin), {
      initialProps: { coin: 'BTC' },
    });
    hook.rerender({ coin: 'ETH' });
    expect(hook.result.current?.marketData).toBe(eth);
    act(() =>
      perpsStore.setState({ marketData: [btc], marketDataMap: { BTC: btc } }),
    );
    expect(hook.result.current).toBeNull();
    hook.rerender({ coin: '' });
    expect(hook.result.current).toBeNull();
  });
});
