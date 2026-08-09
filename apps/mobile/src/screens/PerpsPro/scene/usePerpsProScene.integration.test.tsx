import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';

import type { MarketData } from '@/hooks/perps/usePerpsStore';

const mockRoute = {
  params: {
    market: 'xyz:AAPL',
  },
};
let mockIsFocused = true;
let mockRuntimeStatus = 'ready';

jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => mockIsFocused,
  useRoute: () => mockRoute,
}));

jest.mock('@/core/utils/startupScheduler', () => ({
  runStartupTask: jest.fn(),
  scheduleStartupTask: jest.fn(),
}));

jest.mock('@/core/utils/reexports', () => ({
  zCreate: require('zustand').create,
}));

jest.mock('@/core/apis/perps', () => ({
  apisPerps: {},
}));

jest.mock('@/core/request', () => ({
  openapi: {},
}));

jest.mock('@/core/serviceApi/perps', () => ({
  perpsServiceApi: {},
}));

jest.mock('@/utils/events', () => ({
  EVENTS: {
    PERPS: {
      LOG_OUT: 'PERPS_LOG_OUT',
    },
  },
  eventBus: {
    emit: jest.fn(),
    on: jest.fn(),
    removeAllListeners: jest.fn(),
  },
}));

jest.mock('@/utils/stats', () => ({
  stats: {},
}));

jest.mock('@/utils/perps', () => ({
  formatAllDexsClearinghouseState: jest.fn(),
  formatMarkData: jest.fn(),
  formatPositionPnl: jest.fn(() => ({
    accountValue: 0,
    pnl: 0,
    show: false,
    type: 'pnl',
  })),
  formatSpotState: jest.fn(),
  getPxDecimals: jest.fn(() => 2),
  mergeFastAssetCtxs: jest.fn(),
}));

jest.mock('@/hooks/perps/runtime/usePerpsRuntimeStatus', () => ({
  usePerpsRuntimeStatus: () => ({
    error: null,
    identity: 'self:0xtest',
    phase: null,
    retry: jest.fn(),
    status: mockRuntimeStatus,
  }),
}));

const { initialState, perpsStore } =
  require('@/hooks/perps/usePerpsStore') as typeof import('@/hooks/perps/usePerpsStore');
const { buildPerpsProMarket } =
  require('../model/market') as typeof import('../model/market');
const { getPerpsProMarketSession, resetPerpsProMarketSessionForTests } =
  require('../session/perpsProMarketSession') as typeof import('../session/perpsProMarketSession');
const { usePerpsProScene } =
  require('./usePerpsProScene') as typeof import('./usePerpsProScene');

const createMarketData = (
  name: string,
  overrides: Partial<MarketData> = {},
): MarketData => ({
  brief: `${name} market`,
  dayBaseVlm: '100',
  dayNtlVlm: '1000',
  dexId: '',
  displayName: name.includes(':') ? name.split(':')[1]! : name,
  funding: '0.0001',
  index: 0,
  logoUrl: `https://example.test/${name}.png`,
  maintenanceMarginTiers: [],
  markPx: '100',
  maxLeverage: 20,
  maxUsdValueSize: '1000000',
  midPx: '100',
  minLeverage: 1,
  name,
  openInterest: '10',
  oraclePx: '100',
  premium: '0',
  prevDayPx: '90',
  pxDecimals: 2,
  quoteAsset: 'USDC',
  szDecimals: 2,
  ...overrides,
});

const resetStore = () => {
  perpsStore.setState(
    {
      ...initialState,
      marketData: [],
      marketDataMap: {},
    },
    true,
  );
};

describe('usePerpsProScene integration', () => {
  beforeEach(() => {
    Object.defineProperty(AppState, 'currentState', {
      configurable: true,
      value: 'active',
    });
    mockIsFocused = true;
    mockRuntimeStatus = 'ready';
    mockRoute.params.market = 'xyz:AAPL';
    resetPerpsProMarketSessionForTests();
    resetStore();
  });

  afterEach(() => {
    resetPerpsProMarketSessionForTests();
    resetStore();
  });

  it('keeps route selection, process session and live Store data in sync', async () => {
    const btc = createMarketData('BTC');
    const apple = createMarketData('xyz:AAPL', {
      dexId: 'xyz',
      index: 1,
      markPx: '200',
      midPx: '200',
      oraclePx: '200',
      prevDayPx: '180',
    });

    act(() => {
      perpsStore.setState({
        marketData: [btc, apple],
        marketDataMap: {
          BTC: btc,
          'xyz:AAPL': apple,
        },
        marketDataStatus: 'success',
      });
    });

    const hook = renderHook(() => usePerpsProScene());

    await waitFor(() => {
      expect(hook.result.current.currentMarket?.canonicalCoin).toBe('xyz:AAPL');
    });
    expect(getPerpsProMarketSession().marketKey).toBe('xyz::xyz:AAPL');
    expect(hook.result.current.currentMarket?.price).toBe(200);
    expect(hook.result.current.klineEnabled).toBe(true);
    expect(hook.result.current.realtimeEnabled).toBe(true);

    const liveApple = { ...apple, markPx: '225', midPx: '225' };
    act(() => {
      perpsStore.setState(state => ({
        marketDataMap: {
          ...state.marketDataMap,
          'xyz:AAPL': liveApple,
        },
      }));
    });

    await waitFor(() => {
      expect(hook.result.current.currentMarket?.price).toBe(225);
    });
    expect(hook.result.current.currentMarket?.marketKey).toBe('xyz::xyz:AAPL');

    act(() => {
      hook.result.current.selectMarket(buildPerpsProMarket(btc));
    });

    expect(hook.result.current.currentMarket?.canonicalCoin).toBe('BTC');
    expect(getPerpsProMarketSession().marketKey).toBe('hyperliquid::BTC');

    mockRuntimeStatus = 'initializing';
    hook.rerender({});

    expect(hook.result.current.klineEnabled).toBe(false);
    expect(hook.result.current.realtimeEnabled).toBe(false);
    hook.unmount();
  });

  it('does not enable realtime subscriptions while the scene is unfocused', async () => {
    const btc = createMarketData('BTC');
    act(() => {
      perpsStore.setState({
        marketData: [btc],
        marketDataMap: { BTC: btc },
        marketDataStatus: 'success',
      });
    });
    mockRoute.params.market = 'BTC';
    mockIsFocused = false;

    const hook = renderHook(() => usePerpsProScene());

    await waitFor(() => {
      expect(hook.result.current.currentMarket?.canonicalCoin).toBe('BTC');
    });
    expect(hook.result.current.klineEnabled).toBe(false);
    expect(hook.result.current.realtimeEnabled).toBe(false);
    hook.unmount();
  });
});
