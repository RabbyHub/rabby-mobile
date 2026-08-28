describe('store/balance24h', () => {
  const mockGetBalance24hCache = jest.fn();
  const mockFetch24hBalance = jest.fn();
  const mockSetBalance24hCache = jest.fn();
  const mockComputeTotalBalance = jest.fn();
  const mockGetBalanceCacheAccounts = jest.fn();
  const mockGetSelectedBalanceAddressesSnapshot = jest.fn(() => [] as string[]);
  const mockGetTop10MyAccounts = jest.fn();
  const mockIsHomeAssetSelectionExperimentEnabled = jest.fn(() => false);
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
    jest.doMock('@/hooks/appSettings', () => ({
      isHomeAssetSelectionExperimentEnabled: (...args: unknown[]) =>
        mockIsHomeAssetSelectionExperimentEnabled(...args),
    }));
    jest.doMock('@/core/services', () => ({
      keyringService: {
        on: jest.fn(),
        getAllAddresses: jest.fn(async () => []),
      },
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
      getSelectedBalanceAddressesSnapshot: (...args: unknown[]) =>
        mockGetSelectedBalanceAddressesSnapshot(...args),
      accountsBalanceEvents: {
        on: jest.fn(),
      },
    }));

    mockGetSelectedBalanceAddressesSnapshot.mockReset();
    mockGetSelectedBalanceAddressesSnapshot.mockReturnValue([]);
    mockGetTop10MyAccounts.mockReset();
    mockGetTop10MyAccounts.mockResolvedValue({
      top10Addresses: [],
    });
    mockIsHomeAssetSelectionExperimentEnabled.mockReset();
    mockIsHomeAssetSelectionExperimentEnabled.mockReturnValue(false);

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

  it('uses the active balance selection instead of re-reading the legacy Top-10 list', async () => {
    mockGetSelectedBalanceAddressesSnapshot.mockReturnValue([
      '0xselected-a',
      '0xselected-b',
    ]);
    mockGetBalance24hCache.mockReturnValue(null);
    mockFetch24hBalance.mockResolvedValue({
      data: { total_usd_value: 1 },
      updateTime: 1,
    });

    await balance24hModule.scene24hBalanceStore.refresh24hAssets({
      reason: 'manual_refresh',
    });

    expect(mockFetch24hBalance.mock.calls.map(([address]) => address)).toEqual([
      '0xselected-a',
      '0xselected-b',
    ]);
  });

  it('retains the legacy Top-10 fallback until normal selection resolves', async () => {
    mockGetTop10MyAccounts.mockResolvedValue({
      top10Addresses: ['0xlegacy'],
    });
    mockGetBalance24hCache.mockReturnValue(null);
    mockFetch24hBalance.mockResolvedValue({
      data: { total_usd_value: 1 },
      updateTime: 1,
    });

    await balance24hModule.scene24hBalanceStore.refresh24hAssets({
      reason: 'manual_refresh',
    });

    expect(mockGetTop10MyAccounts).toHaveBeenCalledTimes(1);
    expect(mockFetch24hBalance).toHaveBeenCalledWith('0xlegacy');
  });

  it('does not fall back to Top-10 while an experimental selection is unresolved', async () => {
    mockIsHomeAssetSelectionExperimentEnabled.mockReturnValue(true);

    await balance24hModule.scene24hBalanceStore.refresh24hAssets({
      reason: 'manual_refresh',
    });

    expect(mockGetTop10MyAccounts).not.toHaveBeenCalled();
    expect(mockFetch24hBalance).not.toHaveBeenCalled();
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

  it('does not repeat hydration when the caller already applied the cache', async () => {
    mockGetBalance24hCache.mockReturnValue({
      data: { total_usd_value: 34 },
      updateTime: 456,
      isExpired: true,
    });
    mockFetch24hBalance.mockResolvedValue({
      data: { total_usd_value: 56 },
      updateTime: 789,
    });
    const hydrateSpy = jest.spyOn(
      balance24hModule.balance24hStore,
      'hydrateAddress24hBalanceFromCache',
    );

    balance24hModule.balance24hStore.hydrateAddress24hBalanceFromCache(
      '0xABCD',
    );
    await balance24hModule.balance24hStore.refreshAddress24hBalance(
      '0xABCD',
      false,
      undefined,
      { cacheAlreadyHydrated: true },
    );

    expect(hydrateSpy).toHaveBeenCalledTimes(1);
    expect(mockFetch24hBalance).toHaveBeenCalledTimes(1);
    expect(
      balance24hModule.balance24hStore.getAddress24hBalance('0xabcd'),
    ).toMatchObject({
      total_usd_value: 56,
      updateTime: 789,
    });
  });
});
