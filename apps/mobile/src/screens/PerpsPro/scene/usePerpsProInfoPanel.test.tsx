import { act, renderHook } from '@testing-library/react-native';

const mockFetchMarketData = jest.fn();
const mockFetchSpotMeta = jest.fn();
const mockSetActiveInfoTab = jest.fn();

const mockPositions = [
  { coin: 'BTC', key: 'BTC' },
  { coin: 'ETH', key: 'ETH' },
];
const mockOpenOrders = [
  { category: 'basic', coin: 'BTC', key: 'basic-btc' },
  { category: 'basic', coin: 'ETH', key: 'basic-eth' },
  { category: 'conditional', coin: 'ETH', key: 'conditional-eth' },
];
const mockAccount = {
  assets: [],
  diagnostics: { complete: true, unresolvedDexes: [] },
  mode: 'standard',
};
const mockPerpsState = {
  currentClearinghouseState: { assetPositions: [] },
  currentPerpsAccount: { address: '0xABC', type: 'watch' },
  isFetchAllDone: true,
  isOpenOrdersReady: true,
  isSpotStateReady: true,
  isUserDataReady: true,
  localLoadingHistory: [],
  marketData: [],
  marketDataStatus: 'ready',
  openOrders: [],
  spotAssetCtxs: {},
  spotMeta: null,
  spotMetaStatus: 'ready',
  spotState: { rawBalances: [] },
  userAbstraction: null,
};

jest.mock('@/hooks/perps/runtime/usePerpsRuntimeStatus', () => ({
  usePerpsRuntimeStatus: () => ({
    identity: 'runtime-account',
    retry: jest.fn(),
    status: 'ready',
  }),
}));

jest.mock('@/hooks/perps/runtime/perpsRuntimeState', () => ({
  getPerpsRuntimeIdentity: () => 'runtime-account',
}));

jest.mock('@/hooks/perps/usePerpsStore', () => ({
  isPerpsUserAbstractionReadyForAccount: () => true,
  perpsStore: (selector: (state: typeof mockPerpsState) => unknown) =>
    selector(mockPerpsState),
  usePerpsStore: () => ({
    fetchMarketData: mockFetchMarketData,
    fetchSpotMeta: mockFetchSpotMeta,
  }),
}));

jest.mock('@/hooks/perps/funding/fundingJournal', () => ({
  getPerpsPendingFundingCount: () => 0,
}));

jest.mock('../model/account', () => ({
  buildPerpsAccountViewModel: () => mockAccount,
  getPerpsAccountMarginRatio: () => null,
  getSpotPriceDependencyKeys: () => [],
  resolvePerpsAccountMode: () => 'standard',
}));

jest.mock('../model/openOrderTopology', () => ({
  buildPerpsOpenOrderTopology: () => ({ nodes: [] }),
}));

jest.mock('../model/position', () => ({
  buildPerpsPositionsFromTopology: () => mockPositions,
  filterPerpsPositionsForMarket: (
    positions: typeof mockPositions,
    canonicalCoin: string,
    hideOtherSymbols: boolean,
  ) =>
    hideOtherSymbols
      ? positions.filter(position => position.coin === canonicalCoin)
      : positions,
}));

jest.mock('../model/openOrder', () => ({
  buildPerpsOpenOrdersFromTopology: () => mockOpenOrders,
  filterPerpsOpenOrders: ({
    canonicalCoin,
    category,
    hideOtherSymbols,
    orders,
  }: {
    canonicalCoin: string;
    category: string;
    hideOtherSymbols: boolean;
    orders: typeof mockOpenOrders;
  }) =>
    orders.filter(
      order =>
        order.category === category &&
        (!hideOtherSymbols || order.coin === canonicalCoin),
    ),
  getPerpsOpenOrderCounts: () => ({
    basic: 2,
    conditional: 1,
    unsupported: 0,
  }),
}));

jest.mock('../model/infoPanelPresentation', () => ({
  isPerpsProCollectionAuthoritativelyEmpty: () => false,
  resolvePerpsProInfoTabPresentation: () => ({
    activeInfoTab: 'positions',
    automaticSelection: null,
  }),
}));

jest.mock('./usePerpsProInfoPreferences', () => ({
  usePerpsProInfoPreferences: () => ({
    activeInfoTab: 'positions',
    hasUserSelectedInfoTab: true,
    hydrated: true,
    setActiveInfoTab: mockSetActiveInfoTab,
  }),
}));

const { usePerpsProInfoPanel } =
  require('./usePerpsProInfoPanel') as typeof import('./usePerpsProInfoPanel');

describe('usePerpsProInfoPanel symbol filters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('owns independent Position and Open Orders filters without narrowing shared facts', () => {
    const hook = renderHook(
      ({ canonicalCoin }) => usePerpsProInfoPanel(canonicalCoin),
      { initialProps: { canonicalCoin: 'BTC' } },
    );

    expect(hook.result.current.hideOtherPositionSymbols).toBe(false);
    expect(hook.result.current.hideOtherOpenOrderSymbols).toBe(false);
    expect(
      hook.result.current.positions.map(position => position.coin),
    ).toEqual(['BTC', 'ETH']);
    expect(hook.result.current.openOrders.map(order => order.coin)).toEqual([
      'BTC',
      'ETH',
    ]);
    const allPositionsByCoin = hook.result.current.allPositionsByCoin;

    act(() => hook.result.current.setHideOtherPositionSymbols(true));

    expect(hook.result.current.hideOtherPositionSymbols).toBe(true);
    expect(hook.result.current.hideOtherOpenOrderSymbols).toBe(false);
    expect(
      hook.result.current.positions.map(position => position.coin),
    ).toEqual(['BTC']);
    expect(hook.result.current.openOrders.map(order => order.coin)).toEqual([
      'BTC',
      'ETH',
    ]);

    act(() => hook.result.current.setHideOtherOpenOrderSymbols(true));

    expect(
      hook.result.current.positions.map(position => position.coin),
    ).toEqual(['BTC']);
    expect(hook.result.current.openOrders.map(order => order.coin)).toEqual([
      'BTC',
    ]);

    act(() => hook.result.current.setHideOtherPositionSymbols(false));
    act(() => hook.result.current.setOpenOrderCategory('conditional'));
    hook.rerender({ canonicalCoin: 'ETH' });

    expect(
      hook.result.current.positions.map(position => position.coin),
    ).toEqual(['BTC', 'ETH']);
    expect(hook.result.current.openOrders.map(order => order.coin)).toEqual([
      'ETH',
    ]);
    expect(
      hook.result.current.openOrderCommandCandidates.map(order => order.key),
    ).toEqual(['conditional-eth']);
    expect(hook.result.current.allPositionsCount).toBe(2);
    expect(hook.result.current.allOpenOrdersCount).toBe(3);
    expect(hook.result.current.allPositionsByCoin).toBe(allPositionsByCoin);
    expect(hook.result.current.allPositionsByCoin.get('ETH')).toBe(
      mockPositions[1],
    );
  });
});
