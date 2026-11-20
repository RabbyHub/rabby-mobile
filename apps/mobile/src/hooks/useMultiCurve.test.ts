describe('hooks/useMultiCurve', () => {
  const mockGetNetCurve = jest.fn();
  const mockComputeTotalBalance = jest.fn();
  const mockGetBalanceCacheAccounts = jest.fn();
  const mockGetTop10MyAccounts = jest.fn();
  const mockFormChartData = jest.fn();
  let mockSelectedAddresses: string[];
  let mockBalanceValueMap: Record<
    string,
    {
      evmBalance: number;
      totalBalance: number;
    }
  >;

  let multiCurveModule: typeof import('./useMultiCurve');
  let curveStoreModule: typeof import('@/store/curve24h');
  let curveCache: typeof import('@/utils/24balanceCurveCache');

  beforeEach(() => {
    jest.useFakeTimers();
    jest.resetModules();
    jest.clearAllMocks();
    mockSelectedAddresses = ['0xabc'];
    mockBalanceValueMap = {
      '0xabc': {
        evmBalance: 100,
        totalBalance: 123,
      },
    };

    jest.doMock('react-native-haptic-feedback', () => ({
      trigger: jest.fn(),
    }));
    jest.doMock('@/core/request', () => ({
      openapi: {
        getNetCurve: (...args: unknown[]) => mockGetNetCurve(...args),
      },
    }));
    jest.doMock('@/store/curveShared', () => ({
      formChartData: (...args: unknown[]) => mockFormChartData(...args),
      combineMultiCurve: jest.fn((curves: unknown[]) => curves[0] || []),
      formatSmallUsdValue: jest.fn(() => '$123'),
    }));
    jest.doMock('./useCurve', () => ({
      formChartData: (...args: unknown[]) => mockFormChartData(...args),
    }));
    jest.doMock('./common/useMemozied', () => ({
      useCreationWithShallowCompare: jest.fn(),
    }));
    jest.doMock('@/screens/Address/components/MultiAssets/hooks', () => ({
      useAccountInfo: jest.fn(() => ({
        myTop10Addresses: [],
      })),
    }));
    jest.doMock('@/store/balance', () => ({
      __esModule: true,
      default: {
        computeTotalBalance: (...args: unknown[]) =>
          mockComputeTotalBalance(...args),
        getAddressValueMap: jest.fn(() => mockBalanceValueMap),
        useAddressValueMap: jest.fn(() => mockBalanceValueMap),
        subscribe: jest.fn(),
      },
      balanceAccountsStore: Object.assign(
        jest.fn(
          (selector: (state: { selectedAddresses: string[] }) => unknown) =>
            selector({ selectedAddresses: [] }),
        ),
        {
          getState: jest.fn(() => ({
            balance: mockGetBalanceCacheAccounts(),
            selectedAddresses: mockSelectedAddresses,
          })),
        },
      ),
      accountsBalanceEvents: {
        on: jest.fn(),
      },
    }));
    jest.doMock('@/core/apis/account', () => ({
      accountEvents: {
        on: jest.fn(),
      },
      getTop10MyAccounts: (...args: unknown[]) =>
        mockGetTop10MyAccounts(...args),
    }));
    jest.doMock('@/core/utils/perf', () => ({
      perfEvents: {
        emit: jest.fn(),
        subscribe: jest.fn(),
      },
    }));
    jest.doMock('@/core/services', () => ({
      keyringService: {},
    }));

    mockGetNetCurve.mockResolvedValue([
      {
        timestamp: 1,
        usd_value: 2,
      },
    ]);
    mockGetTop10MyAccounts.mockResolvedValue({
      top10Addresses: [],
    });
    mockFormChartData.mockImplementation((data, options) => ({
      list: data,
      rawNetWorth: options.staticBalance || 0,
      rawChange: 0,
      netWorth: '',
      change: '',
      changePercent: '',
      isLoss: false,
      isEmptyAssets: false,
    }));

    multiCurveModule = require('./useMultiCurve');
    curveStoreModule = require('@/store/curve24h');
    curveCache = require('@/utils/24balanceCurveCache');
    require('@/core/storage/mmkvInstances').dayCurveMMKV.clearAll();
  });

  afterEach(async () => {
    await jest.runOnlyPendingTimersAsync();
    jest.useRealTimers();
  });

  it('prefers addresses from balanceAccounts when refreshing day curve', async () => {
    const latestBalanceAccounts = {
      '0xabc': {
        address: '0xabc',
        balance: 123,
        evmBalance: 100,
      },
    };
    const staleBalanceAccounts = {
      '0xabc': {
        address: '0xabc',
        balance: 0,
        evmBalance: 0,
      },
    };
    mockGetBalanceCacheAccounts.mockReturnValue(latestBalanceAccounts);
    mockComputeTotalBalance.mockReturnValue({
      total: 123,
      totalEvm: 100,
    });

    curveStoreModule.sceneCurve24hStore.setHomeCurveExpanded(true);
    await multiCurveModule.refreshDayCurve({
      balanceAccounts: staleBalanceAccounts as any,
      reason: 'manual_refresh',
    });

    expect(mockGetTop10MyAccounts).not.toHaveBeenCalled();
    expect(mockGetNetCurve).toHaveBeenCalledWith('0xabc', 1);
  });

  it.each([
    { force: false, reason: 'manual_refresh' as const },
    { force: true, reason: 'manual_refresh' as const },
    { force: false, reason: 'selection_changed' as const },
  ])('skips a folded Home refresh: %j', async input => {
    await multiCurveModule.refreshDayCurve({ addresses: ['0xabc'], ...input });

    expect(mockGetNetCurve).not.toHaveBeenCalled();
    expect(
      curveStoreModule.sceneCurve24hStore.getState().sceneLoading.Home,
    ).toBe(false);
    expect(
      curveStoreModule.addressCurve24hStore.getAddressCurve('0xabc'),
    ).toBeUndefined();
  });

  it.each(['missing', 'valid', 'expired'] as const)(
    'uses the existing cache policy when expanded with %s cache',
    async cacheState => {
      if (cacheState !== 'missing') {
        curveCache.setCurveCache('0xabc', {
          data: [{ timestamp: 1, usd_value: 2 }],
          updateTime:
            Date.now() - (cacheState === 'expired' ? 11 * 60 * 1000 : 0),
        });
      }

      curveStoreModule.sceneCurve24hStore.setHomeCurveExpanded(true);
      await multiCurveModule.refreshDayCurve();

      expect(mockGetNetCurve).toHaveBeenCalledTimes(
        cacheState === 'valid' ? 0 : 1,
      );
      expect(
        curveStoreModule.addressCurve24hStore.getAddressCurve('0xabc')?.length,
      ).toBeGreaterThan(0);
      expect(
        curveStoreModule.sceneCurve24hStore.getState().sceneLoading.Home,
      ).toBe(false);
    },
  );

  it('still forces a manual refresh while expanded', async () => {
    curveCache.setCurveCache('0xabc', {
      data: [{ timestamp: 1, usd_value: 2 }],
      updateTime: Date.now(),
    });
    curveStoreModule.sceneCurve24hStore.setHomeCurveExpanded(true);

    await multiCurveModule.refreshDayCurve({ force: true });

    expect(mockGetNetCurve).toHaveBeenCalledTimes(1);
  });

  it('uses the latest selection when opened after a folded selection change', async () => {
    mockSelectedAddresses = ['0xdef'];
    await multiCurveModule.refreshDayCurve({
      addresses: mockSelectedAddresses,
      reason: 'selection_changed',
    });
    expect(mockGetNetCurve).not.toHaveBeenCalled();

    curveStoreModule.sceneCurve24hStore.setHomeCurveExpanded(true);
    await multiCurveModule.refreshDayCurve();

    expect(mockGetNetCurve).toHaveBeenCalledTimes(1);
    expect(mockGetNetCurve).toHaveBeenCalledWith('0xdef', 1);
    expect(
      curveStoreModule.sceneCurve24hStore.getState().addresses.Home,
    ).toEqual(['0xdef']);
  });

  it('does not let a folded no-op swallow an immediate open, and deduplicates open refreshes', async () => {
    const skipped = multiCurveModule.refreshDayCurve();
    curveStoreModule.sceneCurve24hStore.setHomeCurveExpanded(true);

    await Promise.all([
      skipped,
      multiCurveModule.refreshDayCurve(),
      multiCurveModule.refreshDayCurve(),
    ]);

    expect(mockGetNetCurve).toHaveBeenCalledTimes(1);
  });

  it('allows an in-flight curve to finish and cache after folding', async () => {
    const data = [{ timestamp: 1, usd_value: 20 }];
    let resolveRequest!: (value: typeof data) => void;
    mockGetNetCurve.mockReturnValueOnce(
      new Promise(resolve => {
        resolveRequest = resolve;
      }),
    );
    curveStoreModule.sceneCurve24hStore.setHomeCurveExpanded(true);
    const refresh = multiCurveModule.refreshDayCurve();
    expect(mockGetNetCurve).toHaveBeenCalledTimes(1);

    curveStoreModule.sceneCurve24hStore.setHomeCurveExpanded(false);
    await multiCurveModule.refreshDayCurve({ force: true });
    resolveRequest(data);
    await refresh;

    expect(curveCache.getCurveCache('0xabc')?.data).toEqual(data);
    expect(
      curveStoreModule.sceneCurve24hStore.getState().sceneLoading.Home,
    ).toBe(false);
    curveStoreModule.sceneCurve24hStore.setHomeCurveExpanded(true);
    await multiCurveModule.refreshDayCurve();
    expect(mockGetNetCurve).toHaveBeenCalledTimes(1);
  });

  it('does not gate single-address curve requests on the Home fold state', async () => {
    await curveStoreModule.addressCurve24hStore.warmupAddressCurve('0xabc');

    expect(mockGetNetCurve).toHaveBeenCalledWith('0xabc', 1);
  });
});
