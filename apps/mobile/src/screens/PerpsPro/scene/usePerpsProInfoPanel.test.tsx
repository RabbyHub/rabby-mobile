import { act, renderHook } from '@testing-library/react-native';

const mockFetchMarketData = jest.fn();
const mockFetchSpotMeta = jest.fn();
const mockSetActiveInfoTab = jest.fn();
let mockRuntimeIdentity = 'runtime-account';
let mockRuntimeStatus: 'error' | 'ready' | 'waitingForAccount' = 'ready';
let mockUserAbstractionReady = true;

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
  currentClearinghouseState: {
    assetPositions: [],
    marginSummary: {
      accountValue: '101' as string | null | undefined,
    } as { accountValue: string | null | undefined } | undefined,
  },
  currentPerpsAccount: { address: '0xABC', type: 'watch' } as {
    address: string;
    type: string;
  } | null,
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
  spotState: {
    accountValue: '202' as string | null | undefined,
    rawBalances: [],
    tokenToAvailableAfterMaintenance: [[0, '303']] as [number, string][] | null,
  },
  userAbstraction: null,
};

jest.mock('@/hooks/perps/runtime/usePerpsRuntimeStatus', () => ({
  usePerpsRuntimeStatus: () => ({
    identity: mockRuntimeIdentity,
    retry: jest.fn(),
    status: mockRuntimeStatus,
  }),
}));

jest.mock('@/hooks/perps/runtime/perpsRuntimeState', () => ({
  getPerpsRuntimeIdentity: () => 'runtime-account',
}));

jest.mock('@/hooks/perps/usePerpsStore', () => ({
  isPerpsUserAbstractionReadyForAccount: () => mockUserAbstractionReady,
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
  resolvePerpsProCollectionPresentation: ({
    sourceReady,
    totalCount,
    visibleCount,
  }: {
    sourceReady: boolean;
    totalCount: number;
    visibleCount: number;
  }) =>
    visibleCount > 0
      ? 'populated'
      : !sourceReady
      ? 'unresolved'
      : totalCount === 0
      ? 'authoritativeEmpty'
      : 'filteredEmpty',
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

describe('usePerpsProInfoPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAccount.mode = 'standard';
    mockPerpsState.currentClearinghouseState.marginSummary = {
      accountValue: '101',
    };
    mockPerpsState.currentPerpsAccount = {
      address: '0xABC',
      type: 'watch',
    };
    mockPerpsState.isSpotStateReady = true;
    mockPerpsState.isUserDataReady = true;
    mockPerpsState.spotState.accountValue = '202';
    mockPerpsState.spotState.tokenToAvailableAfterMaintenance = [[0, '303']];
    mockPerpsState.spotMeta = null;
    mockPerpsState.spotMetaStatus = 'ready';
    mockRuntimeIdentity = 'runtime-account';
    mockRuntimeStatus = 'ready';
    mockUserAbstractionReady = true;
  });

  it('uses aggregate clearinghouse account value for a ready Standard account', () => {
    const hook = renderHook(() => usePerpsProInfoPanel('BTC'));

    expect(hook.result.current.fundingAccountValue).toBe('101');
    expect(hook.result.current.fundingAccountValueReady).toBe(true);
  });

  it('uses Spot account value for a ready Unified account', () => {
    mockAccount.mode = 'unified';
    mockPerpsState.currentClearinghouseState.marginSummary = {
      accountValue: '0',
    };

    const hook = renderHook(() => usePerpsProInfoPanel('BTC'));

    expect(hook.result.current.fundingAccountValue).toBe('202');
    expect(hook.result.current.fundingAccountValueReady).toBe(true);
  });

  it('uses token id 0 available-after-maintenance for a ready Portfolio Margin account', () => {
    mockAccount.mode = 'portfolioMargin';
    mockPerpsState.spotState.accountValue = '999';

    const hook = renderHook(() => usePerpsProInfoPanel('BTC'));

    expect(hook.result.current.fundingAccountValue).toBe('303');
    expect(hook.result.current.fundingAccountValueReady).toBe(true);
  });

  it('keeps a missing Portfolio Margin maintenance value explicit after its source is ready', () => {
    mockAccount.mode = 'portfolioMargin';
    mockPerpsState.spotState.tokenToAvailableAfterMaintenance = [[1, '303']];

    const hook = renderHook(() => usePerpsProInfoPanel('BTC'));

    expect(hook.result.current.fundingAccountValue).toBeNull();
    expect(hook.result.current.fundingAccountValueReady).toBe(true);
  });

  it('keeps a missing Standard account value explicit after its source is ready', () => {
    mockPerpsState.currentClearinghouseState.marginSummary = undefined;

    const hook = renderHook(() => usePerpsProInfoPanel('BTC'));

    expect(hook.result.current.fundingAccountValue).toBeNull();
    expect(hook.result.current.fundingAccountValueReady).toBe(true);
  });

  it('keeps a missing Unified account value explicit after its source is ready', () => {
    mockAccount.mode = 'unified';
    mockPerpsState.spotState.accountValue = undefined;

    const hook = renderHook(() => usePerpsProInfoPanel('BTC'));

    expect(hook.result.current.fundingAccountValue).toBeNull();
    expect(hook.result.current.fundingAccountValueReady).toBe(true);
  });

  it.each([
    [
      'runtime identity mismatch',
      () => (mockRuntimeIdentity = 'other-account'),
    ],
    ['runtime not ready', () => (mockRuntimeStatus = 'waitingForAccount')],
    ['abstraction unresolved', () => (mockUserAbstractionReady = false)],
    [
      'Standard user data unresolved',
      () => (mockPerpsState.isUserDataReady = false),
    ],
  ] as const)('keeps Standard funding unready when %s', (_label, arrange) => {
    arrange();

    const hook = renderHook(() => usePerpsProInfoPanel('BTC'));

    expect(hook.result.current.fundingAccountValueReady).toBe(false);
  });

  it('requires Spot state readiness for Unified and Portfolio Margin funding', () => {
    mockAccount.mode = 'unified';
    mockPerpsState.isSpotStateReady = false;

    const hook = renderHook(() => usePerpsProInfoPanel('BTC'));

    expect(hook.result.current.fundingAccountValueReady).toBe(false);
  });

  it('does not require Spot state readiness for Standard funding', () => {
    mockPerpsState.isSpotStateReady = false;

    const hook = renderHook(() => usePerpsProInfoPanel('BTC'));

    expect(hook.result.current.fundingAccountValueReady).toBe(true);
  });

  it('does not require Perps user data readiness for Unified funding', () => {
    mockAccount.mode = 'unified';
    mockPerpsState.isUserDataReady = false;

    const hook = renderHook(() => usePerpsProInfoPanel('BTC'));

    expect(hook.result.current.fundingAccountValueReady).toBe(true);
  });

  it('keeps funding unready without a current account', () => {
    mockPerpsState.currentPerpsAccount = null;

    const hook = renderHook(() => usePerpsProInfoPanel('BTC'));

    expect(hook.result.current.fundingAccountValueReady).toBe(false);
  });

  it('requires and fetches Spot Meta for a Standard account', () => {
    mockPerpsState.spotMetaStatus = 'idle';
    const hook = renderHook(() => usePerpsProInfoPanel('BTC'));

    expect(mockFetchSpotMeta).toHaveBeenCalledTimes(1);
    expect(hook.result.current.accountState).toBe('loading');

    act(() => {
      mockPerpsState.spotMeta = { tokens: [], universe: [] };
      mockPerpsState.spotMetaStatus = 'success';
      hook.rerender({});
    });

    expect(hook.result.current.accountState).toBe('ready');
  });

  it('retries Spot Meta for a Standard account', () => {
    const hook = renderHook(() => usePerpsProInfoPanel('BTC'));

    act(() => hook.result.current.retryAccount());

    expect(mockFetchMarketData).toHaveBeenCalledTimes(1);
    expect(mockFetchSpotMeta).toHaveBeenCalledWith(true);
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
