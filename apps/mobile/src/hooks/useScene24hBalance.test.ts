describe('hooks/useScene24hBalance', () => {
  const mockComputeTotalBalance = jest.fn();
  const mockGetBalanceCacheAccounts = jest.fn();
  const mockGetTop10MyAccounts = jest.fn();
  const mockHydrateAddress24hBalanceFromCache = jest.fn();
  const mockRefreshAddress24hBalance = jest.fn();

  let scene24hBalanceModule: typeof import('./useScene24hBalance');

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
    jest.doMock('@/hooks/useCurve', () => ({
      formatSmallUsdValue: jest.fn(() => '$123'),
    }));
    jest.doMock('@/utils/number', () => ({
      formatUsdValue: jest.fn(() => '$1'),
    }));
    jest.doMock('@/hooks/useAccountsBalance', () => ({
      accountsBalanceEvents: {
        on: jest.fn(),
      },
      apisAccountsBalance: {
        computeTotalBalance: (...args: unknown[]) =>
          mockComputeTotalBalance(...args),
      },
      getBalanceCacheAccounts: () => mockGetBalanceCacheAccounts(),
    }));
    jest.doMock('@/core/apis/account', () => ({
      getTop10MyAccounts: (...args: unknown[]) =>
        mockGetTop10MyAccounts(...args),
    }));
    jest.doMock('@/core/utils/perf', () => ({
      perfEvents: {
        emit: jest.fn(),
      },
    }));
    jest.doMock('@/store/balance', () => ({
      __esModule: true,
      default: {
        getState: jest.fn(() => ({
          balanceMap: {
            '0xabc': {
              evmBalance: 100,
              totalBalance: 123,
            },
          },
        })),
      },
    }));
    jest.doMock('@/store/balance24h', () => ({
      __esModule: true,
      default: {
        getState: jest.fn(() => ({
          balance24hMap: {},
        })),
        subscribe: jest.fn(),
      },
      hydrateAddress24hBalanceFromCache: (...args: unknown[]) =>
        mockHydrateAddress24hBalanceFromCache(...args),
      refreshAddress24hBalance: (...args: unknown[]) =>
        mockRefreshAddress24hBalance(...args),
      useAddress24hBalanceMap: jest.fn(() => ({})),
    }));

    mockGetTop10MyAccounts.mockResolvedValue({
      top10Addresses: [],
    });
    mockComputeTotalBalance.mockReturnValue({
      total: 123,
      totalEvm: 100,
    });
    mockGetBalanceCacheAccounts.mockReturnValue({
      '0xabc': {
        address: '0xabc',
        balance: 123,
        evmBalance: 100,
      },
    });
    mockHydrateAddress24hBalanceFromCache.mockReturnValue(null);
    mockRefreshAddress24hBalance.mockResolvedValue({
      total_usd_value: 90,
      updateTime: 1,
    });

    scene24hBalanceModule = require('./useScene24hBalance');
  });

  it('prefers addresses from balanceAccounts during refresh', async () => {
    const staleBalanceAccounts = {
      '0xabc': {
        address: '0xabc',
        balance: 0,
        evmBalance: 0,
      },
    };

    await scene24hBalanceModule.refresh24hAssets({
      balanceAccounts: staleBalanceAccounts as any,
      reason: 'manual_refresh',
    });

    expect(mockGetTop10MyAccounts).not.toHaveBeenCalled();
    expect(mockRefreshAddress24hBalance).toHaveBeenCalledWith('0xabc', true);
    expect(mockComputeTotalBalance).toHaveBeenCalledWith(
      ['0xabc'],
      mockGetBalanceCacheAccounts(),
    );
  });
});
