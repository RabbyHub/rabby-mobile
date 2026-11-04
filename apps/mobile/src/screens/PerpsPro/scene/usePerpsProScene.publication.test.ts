import { act, renderHook } from '@testing-library/react-native';
import { perpsStore, type MarketData } from '@/hooks/perps/usePerpsStore';
import { usePerpsProScene } from './usePerpsProScene';

jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
  useRoute: () => ({ params: undefined }),
}));
jest.mock('@/hooks/perps/runtime/usePerpsRuntimeStatus', () => ({
  usePerpsRuntimeStatus: () => ({ status: 'ready' }),
}));
jest.mock('@/hooks/perps/usePerpsStore', () => {
  const fetchMarketData = jest.fn();
  return {
    perpsStore: require('zustand').create(() => ({})),
    usePerpsStore: () => ({ fetchMarketData }),
  };
});
jest.mock('../session/perpsProMarketSession', () => ({
  getPerpsProMarketSession: () => ({ marketKey: 'hyperliquid::BTC' }),
  setPerpsProSessionMarket: jest.fn(),
}));
jest.mock('./perpsProZeroAddressLeverageBaseline', () => ({
  prefetchPerpsProZeroAddressLeverageBaseline: jest.fn(),
  preparePerpsProLeverageSources: jest.fn(),
  readPerpsProAccountLeverageConfiguration: () => null,
  readPerpsProZeroAddressLeverageBaseline: () => ({ type: 'cross', value: 7 }),
}));
jest.mock('./perpsProEntryIntent', () => ({
  prewarmPerpsProRealtimeDisplaySnapshot: jest.fn(),
  prewarmPerpsProRealtimeIntent: jest.fn(),
  waitForPerpsProRealtimeDisplaySnapshot: jest.fn(),
}));
jest.mock('./usePerpsBookPrecision', () => ({
  usePerpsBookPrecision: () => ({
    precision: null,
    selectTickOption: jest.fn(),
    selectedTickOption: null,
  }),
}));

const createMarket = (): MarketData => ({
  dayBaseVlm: '100',
  dayNtlVlm: '100000',
  dexId: '',
  displayName: 'BTC',
  funding: '0',
  index: 0,
  logoUrl: '',
  markPx: '81900',
  maxLeverage: 40,
  maxUsdValueSize: '1000000',
  midPx: '81900',
  minLeverage: 1,
  name: 'BTC',
  openInterest: '1',
  oraclePx: '81900',
  premium: '0',
  prevDayPx: '80000',
  pxDecimals: 0,
  quoteAsset: 'USDC',
  szDecimals: 5,
});

const publishMarket = (patch: Partial<MarketData>) => {
  const next = { ...perpsStore.getState().marketDataMap.BTC, ...patch };
  act(() =>
    perpsStore.setState({ marketData: [next], marketDataMap: { BTC: next } }),
  );
};

// Hook/component coverage: real Zustand notification/equality behavior, with
// market preparation and network lifecycle outside this publication contract.
describe('Perps Pro scene market publication boundary', () => {
  beforeEach(() => {
    const market = createMarket();
    perpsStore.setState({
      currentClearinghouseState: null,
      currentPerpsAccount: null,
      isUserDataReady: false,
      marketData: [market],
      marketDataMap: { BTC: market },
      marketDataStatus: 'success',
    });
  });

  it('does not publish ordinary price, volume or risk-limit ticks to the root', () => {
    const render = jest.fn();
    const hook = renderHook(() => {
      render();
      return usePerpsProScene();
    });
    const market = hook.result.current.currentMarket;
    const ticks = hook.result.current.tickOptions;
    const renders = render.mock.calls.length;
    publishMarket({ markPx: '81901', midPx: '81902', dayNtlVlm: '200000' });
    publishMarket({
      maxLeverage: 20,
      maxUsdValueSize: '500000',
      onlyIsolated: true,
    });
    act(() => perpsStore.setState({ hasPermission: true }));
    expect(render).toHaveBeenCalledTimes(renders);
    expect(hook.result.current.currentMarket).toBe(market);
    expect(market).not.toHaveProperty('marketData');
    expect(hook.result.current.tickOptions).toBe(ticks);
  });

  it('updates precision at a magnitude boundary and when size decimals change', () => {
    const hook = renderHook(() => usePerpsProScene());
    const initial = hook.result.current.tickOptions;
    publishMarket({ markPx: '100001' });
    const crossed = hook.result.current.tickOptions;
    expect(crossed).not.toEqual(initial);
    publishMarket({ markPx: '1.25' });
    const smallPrice = hook.result.current.tickOptions;
    publishMarket({ szDecimals: 3 });
    expect(hook.result.current.tickOptions).not.toEqual(smallPrice);
    publishMarket({ markPx: '' });
    expect(hook.result.current.tickOptions).toEqual([]);
  });

  it('publishes display metadata and keeps the latest catalogue fallback', () => {
    const hook = renderHook(() => usePerpsProScene());
    publishMarket({ displayName: 'Bitcoin', brief: 'Bitcoin perpetual' });
    expect(hook.result.current.currentMarket).toMatchObject({
      canonicalCoin: 'BTC',
      displayBase: 'Bitcoin',
      fullName: 'Bitcoin perpetual',
    });
    const descriptor = hook.result.current.currentMarket;
    act(() => perpsStore.setState({ marketDataMap: {} }));
    expect(hook.result.current.currentMarket).toBe(descriptor);
    act(() => perpsStore.setState({ marketData: [] }));
    expect(hook.result.current.currentMarket).toBeNull();
    expect(hook.result.current.tradeConfigurationReady).toBe(false);
    expect(hook.result.current.tickOptions).toEqual([]);
  });
});
