describe('hooks/useMultiCurve', () => {
  const mockGetCurveCache = jest.fn();
  const mockGetNetCurve = jest.fn();
  const mockComputeTotalBalance = jest.fn();
  const mockGetBalanceCacheAccounts = jest.fn();
  const mockGetTop10MyAccounts = jest.fn();
  const mockFormChartData = jest.fn();

  let multiCurveModule: typeof import('./useMultiCurve');

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    jest.doMock('react-native-haptic-feedback', () => ({
      trigger: jest.fn(),
    }));
    jest.doMock('p-queue', () => {
      return jest.fn().mockImplementation(() => ({
        add: (fn: () => Promise<unknown>) => fn(),
        clear: jest.fn(),
        onIdle: jest.fn(() => Promise.resolve()),
      }));
    });
    jest.doMock('@/utils/24balanceCurveCache', () => ({
      getCurveCache: mockGetCurveCache,
      getNetCurve: mockGetNetCurve,
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
    jest.doMock('./useAccountsBalance', () => ({
      accountsBalanceEvents: {
        on: jest.fn(),
      },
      apisAccountsBalance: {
        computeTotalBalance: (...args: unknown[]) =>
          mockComputeTotalBalance(...args),
      },
      fetchTotalBalance: jest.fn(),
      getBalanceCacheAccounts: () => mockGetBalanceCacheAccounts(),
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

    mockGetCurveCache.mockReturnValue(null);
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

    await multiCurveModule.refreshDayCurve({
      balanceAccounts: staleBalanceAccounts as any,
      reason: 'manual_refresh',
    });

    expect(mockGetTop10MyAccounts).not.toHaveBeenCalled();
    expect(mockGetNetCurve).toHaveBeenCalledWith('0xabc', 1, false);
    expect(mockComputeTotalBalance).toHaveBeenCalledWith(
      ['0xabc'],
      latestBalanceAccounts,
    );
  });
});
