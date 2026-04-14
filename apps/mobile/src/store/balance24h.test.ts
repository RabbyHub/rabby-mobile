describe('store/balance24h', () => {
  const mockGetBalance24hCache = jest.fn();
  const mockFetch24hBalance = jest.fn();
  const mockSetBalance24hCache = jest.fn();
  const mockComputeTotalBalance = jest.fn();
  const mockGetBalanceCacheAccounts = jest.fn();
  const mockGetTop10MyAccounts = jest.fn();
  const mockPerfEmit = jest.fn();
  let mockBalanceValueMap: Record<
    string,
    {
      evmBalance: number;
      totalBalance: number;
    }
  >;

  const flushResourceFlowPersist = async () => {
    await Promise.resolve();
    await Promise.resolve();
  };

  let balance24hModule: typeof import('./balance24h');

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockBalanceValueMap = {};

    jest.doMock('@/utils/24hBalanceCache', () => ({
      getBalance24hCache: mockGetBalance24hCache,
      fetch24hBalance: mockFetch24hBalance,
      setBalance24hCache: mockSetBalance24hCache,
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
    jest.doMock('@/core/apis/account', () => ({
      getTop10MyAccounts: (...args: unknown[]) =>
        mockGetTop10MyAccounts(...args),
    }));
    jest.doMock('@/core/utils/perf', () => ({
      perfEvents: {
        emit: (...args: unknown[]) => mockPerfEmit(...args),
      },
    }));
    jest.doMock('./balance', () => ({
      __esModule: true,
      default: {
        computeTotalBalance: (...args: unknown[]) =>
          mockComputeTotalBalance(...args),
        getAddressValueMap: jest.fn(() => mockBalanceValueMap),
        useAddressValueMap: jest.fn(() => mockBalanceValueMap),
        subscribe: jest.fn(),
      },
      balanceAccountsStore: {
        getState: jest.fn(() => ({
          balance: mockGetBalanceCacheAccounts(),
        })),
      },
      accountsBalanceEvents: {
        on: jest.fn(),
      },
    }));

    balance24hModule = require('./balance24h');
  });

  it('hydrates address-level memory cache from fresh persisted cache', () => {
    mockGetBalance24hCache.mockReturnValue({
      data: { total_usd_value: 12 },
      updateTime: 123,
      isExpired: false,
    });

    const result =
      balance24hModule.balance24hStore.hydrateAddress24hBalanceFromCache(
        '0xABCD',
      );

    expect(mockGetBalance24hCache).toHaveBeenCalledWith('0xabcd');
    expect(result).toEqual({
      data: { total_usd_value: 12 },
      updateTime: 123,
      isExpired: false,
    });
    expect(
      balance24hModule.balance24hStore.getAddress24hBalance('0xabcd'),
    ).toEqual({
      total_usd_value: 12,
      updateTime: 123,
    });
  });

  it('reuses fresh cache without fetching or persisting again', async () => {
    mockGetBalance24hCache.mockReturnValue({
      data: { total_usd_value: 23 },
      updateTime: 456,
      isExpired: false,
    });

    const result =
      await balance24hModule.balance24hStore.refreshAddress24hBalance('0xABCD');

    expect(result).toEqual({
      total_usd_value: 23,
      updateTime: 456,
    });
    expect(mockFetch24hBalance).not.toHaveBeenCalled();
    expect(mockSetBalance24hCache).not.toHaveBeenCalled();
    expect(
      balance24hModule.balance24hStore.getAddress24hBalanceResourceState(
        '0xabcd',
      ),
    ).toMatchObject({
      sourceOfCurrentValue: 'hydrate',
      hasValue: true,
    });
  });

  it('updates in-memory cache before scheduling persistence when fetching fresh data', async () => {
    mockGetBalance24hCache.mockReturnValue(null);
    mockFetch24hBalance.mockResolvedValue({
      data: { total_usd_value: 88 },
      updateTime: 789,
    });

    let observedValueDuringPersist:
      | ReturnType<typeof balance24hModule.balance24hStore.getAddress24hBalance>
      | undefined;
    mockSetBalance24hCache.mockImplementation((address: string) => {
      observedValueDuringPersist =
        balance24hModule.balance24hStore.getAddress24hBalance(address);
    });

    const result =
      await balance24hModule.balance24hStore.refreshAddress24hBalance(
        '0xABCD',
        true,
      );

    expect(mockFetch24hBalance).toHaveBeenCalledWith('0xabcd');
    expect(result).toEqual({
      total_usd_value: 88,
      updateTime: 789,
    });
    expect(
      balance24hModule.balance24hStore.getAddress24hBalance('0xabcd'),
    ).toEqual({
      total_usd_value: 88,
      updateTime: 789,
    });

    await flushResourceFlowPersist();

    expect(observedValueDuringPersist).toEqual({
      total_usd_value: 88,
      updateTime: 789,
    });
    expect(mockSetBalance24hCache).toHaveBeenCalledWith('0xabcd', {
      data: { total_usd_value: 88 },
      updateTime: 789,
    });
    expect(
      balance24hModule.balance24hStore.getAddress24hBalanceResourceState(
        '0xabcd',
      ),
    ).toMatchObject({
      sourceOfCurrentValue: 'remote',
      persistStatus: 'success',
      hasValue: true,
    });
  });
});
