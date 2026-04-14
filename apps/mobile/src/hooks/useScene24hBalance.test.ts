describe('store/balance24h scene', () => {
  const mockComputeTotalBalance = jest.fn();
  const mockGetBalanceCacheAccounts = jest.fn();
  const mockGetTop10MyAccounts = jest.fn();
  const mockGetBalance24hCache = jest.fn();
  const mockFetch24hBalance = jest.fn();
  const mockSetBalance24hCache = jest.fn();
  const mockPerfEmit = jest.fn();
  let mockBalanceValueMap: Record<
    string,
    {
      evmBalance: number;
      totalBalance: number;
    }
  >;
  let mockBalance24hValueMap: Record<
    string,
    {
      total_usd_value: number;
      updateTime: number;
    }
  >;
  let consoleErrorSpy: jest.SpyInstance;

  let scene24hBalanceModule: typeof import('../store/balance24h');

  beforeEach(() => {
    jest.useFakeTimers();
    jest.resetModules();
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockBalanceValueMap = {
      '0xabc': {
        evmBalance: 100,
        totalBalance: 123,
      },
    };
    mockBalance24hValueMap = {};

    jest.doMock('react-native-haptic-feedback', () => ({
      trigger: jest.fn(),
    }));
    jest.doMock('@/core/utils/reexports', () => {
      const { create } = require('zustand');
      return {
        zCreate: create,
      };
    });
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
        emit: (...args: unknown[]) => mockPerfEmit(...args),
      },
    }));
    jest.doMock('@/store/balance', () => ({
      __esModule: true,
      default: {
        getAddressValueMap: jest.fn(() => mockBalanceValueMap),
        useAddressValueMap: jest.fn(() => mockBalanceValueMap),
        subscribe: jest.fn(),
      },
    }));
    jest.doMock('@/utils/24hBalanceCache', () => ({
      getBalance24hCache: (...args: unknown[]) =>
        mockGetBalance24hCache(...args),
      fetch24hBalance: (...args: unknown[]) => mockFetch24hBalance(...args),
      setBalance24hCache: (...args: unknown[]) =>
        mockSetBalance24hCache(...args),
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
    mockGetBalance24hCache.mockReturnValue(null);
    mockFetch24hBalance.mockResolvedValue({
      total_usd_value: 90,
      data: {
        total_usd_value: 90,
      },
      updateTime: 1,
    });

    scene24hBalanceModule = require('../store/balance24h');
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    jest.useRealTimers();
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
    expect(mockFetch24hBalance).toHaveBeenCalledWith('0xabc');
    expect(mockComputeTotalBalance).toHaveBeenCalledWith(
      ['0xabc'],
      mockGetBalanceCacheAccounts(),
    );
  });

  it('keeps combined change data available when only part of addresses have 24h values', async () => {
    mockBalanceValueMap = {
      '0xabc': {
        evmBalance: 100,
        totalBalance: 120,
      },
      '0xdef': {
        evmBalance: 50,
        totalBalance: 70,
      },
    };
    mockGetBalanceCacheAccounts.mockReturnValue({
      '0xabc': {
        address: '0xabc',
        balance: 120,
        evmBalance: 100,
      },
      '0xdef': {
        address: '0xdef',
        balance: 70,
        evmBalance: 50,
      },
    });
    mockComputeTotalBalance.mockReturnValue({
      total: 190,
      totalEvm: 150,
    });
    mockGetBalance24hCache.mockImplementation((address: string) => {
      if (address === '0xabc') {
        return {
          data: {
            total_usd_value: 90,
          },
          updateTime: 1,
          isExpired: false,
        };
      }

      return null;
    });
    mockFetch24hBalance.mockRejectedValueOnce(new Error('network error'));

    await scene24hBalanceModule.refresh24hAssets({
      addresses: ['0xabc', '0xdef'],
      reason: 'manual_refresh',
    });
    await jest.runAllTimersAsync();

    expect(mockPerfEmit).toHaveBeenCalledWith(
      'SCENE_24H_BALANCE_UPDATED',
      expect.objectContaining({
        scene: 'Home',
        combinedData: expect.objectContaining({
          rawNetWorth: 190,
          rawChange: 10,
          changePercent: '11.11%',
          isLoss: false,
        }),
      }),
    );
  });
});
