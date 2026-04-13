describe('store/balance24h', () => {
  const mockGetBalance24hCache = jest.fn();
  const mockFetch24hBalance = jest.fn();
  const mockPersist24hBalanceCacheAsync = jest.fn();

  let balance24hModule: typeof import('./balance24h');

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    jest.doMock('@/utils/24hBalanceCache', () => ({
      getBalance24hCache: mockGetBalance24hCache,
      fetch24hBalance: mockFetch24hBalance,
      persist24hBalanceCacheAsync: mockPersist24hBalanceCacheAsync,
    }));
    jest.doMock('@/core/utils/reexports', () => {
      const { create } = require('zustand');
      return {
        zCreate: create,
      };
    });

    balance24hModule = require('./balance24h');
  });

  it('hydrates address-level memory cache from fresh persisted cache', () => {
    mockGetBalance24hCache.mockReturnValue({
      data: { total_usd_value: 12 },
      updateTime: 123,
      isExpired: false,
    });

    const result = balance24hModule.hydrateAddress24hBalanceFromCache('0xABCD');

    expect(mockGetBalance24hCache).toHaveBeenCalledWith('0xabcd');
    expect(result).toEqual({
      data: { total_usd_value: 12 },
      updateTime: 123,
      isExpired: false,
    });
    expect(balance24hModule.getAddress24hBalance('0xabcd')).toEqual({
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

    const result = await balance24hModule.refreshAddress24hBalance('0xABCD');

    expect(result).toEqual({
      total_usd_value: 23,
      updateTime: 456,
    });
    expect(mockFetch24hBalance).not.toHaveBeenCalled();
    expect(mockPersist24hBalanceCacheAsync).not.toHaveBeenCalled();
  });

  it('updates in-memory cache before scheduling persistence when fetching fresh data', async () => {
    mockGetBalance24hCache.mockReturnValue(null);
    mockFetch24hBalance.mockResolvedValue({
      data: { total_usd_value: 88 },
      updateTime: 789,
    });

    let observedValueDuringPersist:
      | ReturnType<typeof balance24hModule.getAddress24hBalance>
      | undefined;
    mockPersist24hBalanceCacheAsync.mockImplementation((address: string) => {
      observedValueDuringPersist =
        balance24hModule.getAddress24hBalance(address);
    });

    const result = await balance24hModule.refreshAddress24hBalance(
      '0xABCD',
      true,
    );

    expect(mockFetch24hBalance).toHaveBeenCalledWith('0xabcd');
    expect(result).toEqual({
      total_usd_value: 88,
      updateTime: 789,
    });
    expect(balance24hModule.getAddress24hBalance('0xabcd')).toEqual({
      total_usd_value: 88,
      updateTime: 789,
    });
    expect(observedValueDuringPersist).toEqual({
      total_usd_value: 88,
      updateTime: 789,
    });
    expect(mockPersist24hBalanceCacheAsync).toHaveBeenCalledWith('0xabcd', {
      data: { total_usd_value: 88 },
      updateTime: 789,
    });
  });
});
