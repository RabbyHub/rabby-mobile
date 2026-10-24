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
const defaultMockOpenOrders = [
  { category: 'basic', coin: 'BTC', key: 'basic-btc' },
  { category: 'basic', coin: 'ETH', key: 'basic-eth' },
  { category: 'conditional', coin: 'ETH', key: 'conditional-eth' },
];
let mockOpenOrders = defaultMockOpenOrders;
const mockAccount = {
  assets: [],
  diagnostics: {
    complete: true,
    unresolvedDexes: [],
    unpricedNonZeroAssets: [],
  },
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
  openOrders: [] as { oid: number }[],
  spotAssetCtxs: {},
  spotMeta: null,
  spotMetaStatus: 'ready',
  stakingStatus: 'success',
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
  fetchStakingSummaryHttp: jest.fn(async () => true),
  isPerpsUserAbstractionReadyForAccount: () => mockUserAbstractionReady,
  perpsStore: Object.assign(
    (selector: (state: typeof mockPerpsState) => unknown) =>
      selector(mockPerpsState),
    {
      getState: () => mockPerpsState,
      subscribe: () => () => {},
    },
  ),
  usePerpsStore: () => ({
    fetchMarketData: mockFetchMarketData,
    fetchSpotMeta: mockFetchSpotMeta,
  }),
}));

jest.mock('@/hooks/perps/funding/fundingJournal', () => ({
  getPerpsPendingFundingCount: () => 0,
}));

jest.mock('../model/account', () => ({
  buildPerpsAccountControlState: () => ({
    mode: mockAccount.mode,
    marginRatio: null,
    hasUnresolvedDexes: false,
    hasUnpricedNonZeroAssets: false,
  }),
  buildPerpsAccountAssetKeys: () => [],
  buildPerpsAccountViewModel: () => mockAccount,
  getPerpsAccountMarginRatio: () => null,
  getSpotPriceDependencyKeys: () => [],
  getStakedHypeAmount: () => '0',
  resolvePerpsAccountMode: () => 'standard',
  STAKING_TOKEN_NAME: 'HYPE',
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
  ...jest.requireActual<typeof import('../model/openOrder')>(
    '../model/openOrder',
  ),
  buildPerpsOpenOrdersFromTopology: () => mockOpenOrders,
}));

jest.mock('../model/infoPanelPresentation', () => ({
  ...jest.requireActual<typeof import('../model/infoPanelPresentation')>(
    '../model/infoPanelPresentation',
  ),
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
    mockOpenOrders = defaultMockOpenOrders;
    mockPerpsState.openOrders = [{ oid: 1 }, { oid: 2 }, { oid: 3 }];
    mockPerpsState.isOpenOrdersReady = true;
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

  it('projects both categories once and aliases the selected entry without cloning order models', () => {
    const hook = renderHook(() => usePerpsProInfoPanel('BTC'));
    const ordersByCategory = hook.result.current.openOrdersByCategory;
    const presentationByCategory =
      hook.result.current.openOrderCollectionPresentationByCategory;

    expect(ordersByCategory.basic.map(order => order.key)).toEqual([
      'basic-btc',
      'basic-eth',
    ]);
    expect(ordersByCategory.conditional.map(order => order.key)).toEqual([
      'conditional-eth',
    ]);
    expect(ordersByCategory.basic[0]).toBe(mockOpenOrders[0]);
    expect(ordersByCategory.basic[1]).toBe(mockOpenOrders[1]);
    expect(ordersByCategory.conditional[0]).toBe(mockOpenOrders[2]);
    expect(hook.result.current.openOrders).toBe(ordersByCategory.basic);
    expect(presentationByCategory).toEqual({
      basic: 'populated',
      conditional: 'populated',
    });
    expect(hook.result.current.openOrderCollectionPresentation).toBe(
      presentationByCategory.basic,
    );

    act(() => hook.result.current.setOpenOrderCategory('conditional'));
    act(() => hook.result.current.setHideOtherPositionSymbols(true));
    hook.rerender({});

    expect(hook.result.current.openOrdersByCategory).toBe(ordersByCategory);
    expect(hook.result.current.openOrderCollectionPresentationByCategory).toBe(
      presentationByCategory,
    );
    expect(hook.result.current.openOrders).toBe(ordersByCategory.conditional);
    expect(hook.result.current.openOrderCollectionPresentation).toBe(
      presentationByCategory.conditional,
    );
  });

  it('filters both categories by market without filtering counts or category command candidates', () => {
    const hook = renderHook(
      ({ canonicalCoin }) => usePerpsProInfoPanel(canonicalCoin),
      { initialProps: { canonicalCoin: 'BTC' } },
    );

    act(() => hook.result.current.setHideOtherOpenOrderSymbols(true));

    const btcOrdersByCategory = hook.result.current.openOrdersByCategory;
    const btcPresentationByCategory =
      hook.result.current.openOrderCollectionPresentationByCategory;
    expect(btcOrdersByCategory.basic.map(order => order.key)).toEqual([
      'basic-btc',
    ]);
    expect(btcOrdersByCategory.conditional).toEqual([]);
    expect(btcPresentationByCategory).toEqual({
      basic: 'populated',
      conditional: 'filteredEmpty',
    });
    expect(
      hook.result.current.openOrderCommandCandidates.map(order => order.key),
    ).toEqual(['basic-btc', 'basic-eth']);
    expect(hook.result.current.openOrderCounts).toEqual({
      basic: 2,
      conditional: 1,
      unsupported: 0,
    });
    expect(hook.result.current.allOpenOrdersCount).toBe(3);

    act(() => hook.result.current.setOpenOrderCategory('conditional'));
    hook.rerender({ canonicalCoin: 'BTC' });

    expect(hook.result.current.openOrdersByCategory).toBe(btcOrdersByCategory);
    expect(hook.result.current.openOrderCollectionPresentationByCategory).toBe(
      btcPresentationByCategory,
    );
    expect(hook.result.current.openOrders).toBe(
      btcOrdersByCategory.conditional,
    );
    expect(hook.result.current.openOrderCollectionPresentation).toBe(
      'filteredEmpty',
    );
    expect(
      hook.result.current.openOrderCommandCandidates.map(order => order.key),
    ).toEqual(['conditional-eth']);

    hook.rerender({ canonicalCoin: 'ETH' });

    expect(
      hook.result.current.openOrdersByCategory.basic.map(order => order.key),
    ).toEqual(['basic-eth']);
    expect(
      hook.result.current.openOrdersByCategory.conditional.map(
        order => order.key,
      ),
    ).toEqual(['conditional-eth']);
    expect(
      hook.result.current.openOrderCollectionPresentationByCategory,
    ).toEqual({ basic: 'populated', conditional: 'populated' });
    expect(hook.result.current.openOrders).toBe(
      hook.result.current.openOrdersByCategory.conditional,
    );
  });

  it('refreshes the unselected category when the shared order source changes', () => {
    const hook = renderHook(() => usePerpsProInfoPanel('BTC'));
    const previousOrders = hook.result.current.openOrdersByCategory;
    const nextConditionalOrder = {
      category: 'conditional',
      coin: 'BTC',
      key: 'conditional-btc',
    };

    mockOpenOrders = [...defaultMockOpenOrders, nextConditionalOrder];
    mockPerpsState.openOrders = [...mockPerpsState.openOrders, { oid: 4 }];
    hook.rerender({});

    expect(hook.result.current.openOrderCategory).toBe('basic');
    expect(hook.result.current.openOrdersByCategory).not.toBe(previousOrders);
    expect(
      hook.result.current.openOrdersByCategory.conditional.map(
        order => order.key,
      ),
    ).toEqual(['conditional-eth', 'conditional-btc']);
    expect(hook.result.current.openOrdersByCategory.conditional[1]).toBe(
      nextConditionalOrder,
    );
    expect(hook.result.current.openOrders).toBe(
      hook.result.current.openOrdersByCategory.basic,
    );
    expect(hook.result.current.openOrderCounts.conditional).toBe(2);
  });

  it.each([
    ['without an account', () => (mockPerpsState.currentPerpsAccount = null)],
    ['while runtime waits', () => (mockRuntimeStatus = 'waitingForAccount')],
    ['after runtime failure', () => (mockRuntimeStatus = 'error')],
    [
      'before an empty order baseline arrives',
      () => {
        mockOpenOrders = [];
        mockPerpsState.openOrders = [];
        mockPerpsState.isOpenOrdersReady = false;
      },
    ],
  ] as const)(
    'keeps both category presentations unresolved %s',
    (_label, arrange) => {
      arrange();

      const hook = renderHook(() => usePerpsProInfoPanel('BTC'));

      expect(
        hook.result.current.openOrderCollectionPresentationByCategory,
      ).toEqual({ basic: 'unresolved', conditional: 'unresolved' });
      expect(hook.result.current.openOrderCollectionPresentation).toBe(
        hook.result.current.openOrderCollectionPresentationByCategory.basic,
      );
    },
  );

  it('keeps populated category projections available before source readiness', () => {
    mockPerpsState.isOpenOrdersReady = false;

    const hook = renderHook(() => usePerpsProInfoPanel('BTC'));

    expect(
      hook.result.current.openOrderCollectionPresentationByCategory,
    ).toEqual({ basic: 'populated', conditional: 'populated' });

    act(() => hook.result.current.setHideOtherOpenOrderSymbols(true));

    expect(
      hook.result.current.openOrderCollectionPresentationByCategory,
    ).toEqual({ basic: 'populated', conditional: 'unresolved' });
    mockPerpsState.isOpenOrdersReady = true;
    hook.rerender({});
    expect(
      hook.result.current.openOrderCollectionPresentationByCategory,
    ).toEqual({ basic: 'populated', conditional: 'filteredEmpty' });
  });

  it('does not classify unsupported-only raw orders as an authoritative empty account', () => {
    mockOpenOrders = [
      { category: 'unsupported', coin: 'BTC', key: 'unsupported-btc' },
    ];
    mockPerpsState.openOrders = [{ oid: 4 }];

    const hook = renderHook(() => usePerpsProInfoPanel('BTC'));

    expect(hook.result.current.openOrdersByCategory).toEqual({
      basic: [],
      conditional: [],
    });
    expect(
      hook.result.current.openOrderCollectionPresentationByCategory,
    ).toEqual({ basic: 'filteredEmpty', conditional: 'filteredEmpty' });
    expect(hook.result.current.openOrderCounts).toEqual({
      basic: 0,
      conditional: 0,
      unsupported: 1,
    });
    expect(hook.result.current.allOpenOrdersCount).toBe(0);
    expect(hook.result.current.openOrderCommandCandidates).toEqual([]);
  });

  it('uses the raw order total when topology yields no visible models', () => {
    mockOpenOrders = [];
    mockPerpsState.openOrders = [{ oid: 4 }];

    const hook = renderHook(() => usePerpsProInfoPanel('BTC'));

    expect(
      hook.result.current.openOrderCollectionPresentationByCategory,
    ).toEqual({ basic: 'filteredEmpty', conditional: 'filteredEmpty' });

    mockPerpsState.openOrders = [];
    hook.rerender({});

    expect(
      hook.result.current.openOrderCollectionPresentationByCategory,
    ).toEqual({
      basic: 'authoritativeEmpty',
      conditional: 'authoritativeEmpty',
    });
    expect(hook.result.current.openOrderCollectionPresentation).toBe(
      'authoritativeEmpty',
    );
  });

  it('preserves category and independent filters across market and account changes', () => {
    const hook = renderHook(
      ({ canonicalCoin }) => usePerpsProInfoPanel(canonicalCoin),
      { initialProps: { canonicalCoin: 'BTC' } },
    );

    act(() => {
      hook.result.current.setOpenOrderCategory('conditional');
      hook.result.current.setHideOtherOpenOrderSymbols(true);
      hook.result.current.setHideOtherPositionSymbols(true);
    });
    hook.rerender({ canonicalCoin: 'ETH' });

    mockPerpsState.currentPerpsAccount = null;
    mockRuntimeStatus = 'waitingForAccount';
    hook.rerender({ canonicalCoin: 'ETH' });

    expect(hook.result.current.openOrderCategory).toBe('conditional');
    expect(hook.result.current.hideOtherOpenOrderSymbols).toBe(true);
    expect(hook.result.current.hideOtherPositionSymbols).toBe(true);
    expect(
      hook.result.current.openOrderCollectionPresentationByCategory,
    ).toEqual({ basic: 'unresolved', conditional: 'unresolved' });

    const nextConditionalOrder = {
      category: 'conditional',
      coin: 'ETH',
      key: 'next-account-conditional-eth',
    };
    mockPerpsState.currentPerpsAccount = { address: '0xDEF', type: 'watch' };
    mockOpenOrders = [nextConditionalOrder];
    mockPerpsState.openOrders = [{ oid: 5 }];
    mockRuntimeStatus = 'ready';
    hook.rerender({ canonicalCoin: 'ETH' });

    expect(hook.result.current.accountIdentity).toBe('0xdef:watch');
    expect(hook.result.current.openOrderCategory).toBe('conditional');
    expect(hook.result.current.hideOtherOpenOrderSymbols).toBe(true);
    expect(hook.result.current.hideOtherPositionSymbols).toBe(true);
    expect(hook.result.current.openOrdersByCategory.basic).toEqual([]);
    expect(hook.result.current.openOrdersByCategory.conditional).toEqual([
      nextConditionalOrder,
    ]);
    expect(hook.result.current.openOrders).toBe(
      hook.result.current.openOrdersByCategory.conditional,
    );
    expect(
      hook.result.current.openOrderCollectionPresentationByCategory,
    ).toEqual({ basic: 'filteredEmpty', conditional: 'populated' });
    expect(hook.result.current.openOrderCommandCandidates).toEqual([
      nextConditionalOrder,
    ]);
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
