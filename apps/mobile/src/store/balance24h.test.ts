describe('store/balance24h', () => {
  const mockGetBalance24hCache = jest.fn();
  const mockFetch24hBalance = jest.fn();
  const mockGet24hTotalBalanceBatch = jest.fn();
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
    mockGet24hTotalBalanceBatch.mockReset();
    mockGet24hTotalBalanceBatch.mockImplementation(
      async (addresses: string[]) =>
        addresses.map(id => ({ id, error_code: 0, total_usd_value: 1 })),
    );
    jest.doMock('@/core/request', () => ({
      openapi: { get24hTotalBalanceBatch: mockGet24hTotalBalanceBatch },
    }));

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
      return jest.fn().mockImplementation(() => {
        const pending: Promise<unknown>[] = [];
        return {
          add: (fn: () => Promise<unknown>) => {
            const promise = fn();
            pending.push(promise);
            return promise;
          },
          clear: jest.fn(),
          onIdle: () => Promise.allSettled(pending),
        };
      });
    });
    jest.doMock('@/hooks/useCurve', () => ({
      formatSmallUsdValue: jest.fn(() => '$123'),
    }));
    jest.doMock('@/utils/number', () => ({
      formatUsdValue: jest.fn(() => '$1'),
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
    jest.doMock('@/core/apis/account', () => ({
      getTop10MyAccounts: (...args: unknown[]) =>
        mockGetTop10MyAccounts(...args),
    }));
    jest.doMock('@/hooks/appSettings', () => ({
      isHomeAssetSelectionExperimentEnabled:
        mockIsHomeAssetSelectionExperimentEnabled,
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
      getSelectedBalanceAddressesSnapshot:
        mockGetSelectedBalanceAddressesSnapshot,
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

    expect(mockGet24hTotalBalanceBatch).toHaveBeenCalledWith([
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
    expect(mockGet24hTotalBalanceBatch).toHaveBeenCalledWith(['0xlegacy']);
  });

  it('does not fall back to Top-10 while an experimental selection is unresolved', async () => {
    mockIsHomeAssetSelectionExperimentEnabled.mockReturnValue(true);

    await balance24hModule.scene24hBalanceStore.refresh24hAssets({
      reason: 'manual_refresh',
    });

    expect(mockGetTop10MyAccounts).not.toHaveBeenCalled();
    expect(mockFetch24hBalance).not.toHaveBeenCalled();
    expect(mockGet24hTotalBalanceBatch).not.toHaveBeenCalled();
  });

  it('uses the active balance selection when a scene refresh has no explicit addresses', async () => {
    mockGetSelectedBalanceAddressesSnapshot.mockReturnValue([
      '0xselected-a',
      '0xselected-b',
    ]);
    mockGetBalance24hCache.mockReturnValue(null);
    mockFetch24hBalance.mockResolvedValue({
      data: { total_usd_value: 1 },
      updateTime: 1,
    });

    await balance24hModule.scene24hBalanceStore.refreshCombinedDataForScene(
      'Home',
      {
        reason: 'manual_refresh',
      },
    );

    expect(mockGet24hTotalBalanceBatch).toHaveBeenCalledWith([
      '0xselected-a',
      '0xselected-b',
    ]);
  });

  it.each([10, 12])(
    'batches %i stale Home addresses in groups of at most ten',
    async count => {
      const addresses = Array.from(
        { length: count },
        (_, i) => `0xaddr${i.toString().padStart(2, '0')}`,
      );
      mockGetBalance24hCache.mockReturnValue(null);

      await balance24hModule.scene24hBalanceStore.refreshCombinedDataForScene(
        'Home',
        {
          addresses: [...addresses, addresses[0].toUpperCase()],
        },
      );
      await flushResourceFlowPersist();

      expect(
        mockGet24hTotalBalanceBatch.mock.calls.map(([ids]) => ids),
      ).toEqual(
        count === 10
          ? [addresses]
          : [addresses.slice(0, 10), addresses.slice(10)],
      );
      expect(mockFetch24hBalance).not.toHaveBeenCalled();
      expect(mockSetBalance24hCache).toHaveBeenCalledTimes(count);
      expect(
        balance24hModule.scene24hBalanceStore.getState().sceneLoading.Home,
      ).toBe(false);
    },
  );

  it.each([false, true])(
    'keeps the existing fresh-cache scene behavior with force=%s',
    async force => {
      mockGetBalance24hCache.mockReturnValue({
        data: { total_usd_value: 10 },
        updateTime: 123,
        isExpired: false,
      });
      await balance24hModule.scene24hBalanceStore.refreshCombinedDataForScene(
        'Home',
        {
          addresses: ['0xA', '0xB'],
          force,
        },
      );
      expect(mockGet24hTotalBalanceBatch).not.toHaveBeenCalled();
      expect(mockSetBalance24hCache).not.toHaveBeenCalled();
    },
  );

  it('fetches only stale addresses and preserves a failed address while applying a zero balance', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation();
    mockGetBalance24hCache.mockImplementation((address: string) => ({
      data: { total_usd_value: 20 },
      updateTime: 123,
      isExpired: address !== '0xa',
    }));
    mockGet24hTotalBalanceBatch.mockResolvedValue([
      { id: '0xC', error_code: 0, total_usd_value: 0 },
      { id: '0xB', error_code: 1 },
    ]);
    try {
      await balance24hModule.scene24hBalanceStore.refreshCombinedDataForScene(
        'Home',
        {
          addresses: ['0xA', '0xB', '0xC'],
        },
      );
      await flushResourceFlowPersist();
      expect(mockGet24hTotalBalanceBatch).toHaveBeenCalledWith(['0xb', '0xc']);
      expect(
        balance24hModule.balance24hStore.getAddress24hBalance('0xb'),
      ).toEqual({ total_usd_value: 20, updateTime: 123 });
      expect(
        balance24hModule.balance24hStore.getAddress24hBalance('0xc')
          ?.total_usd_value,
      ).toBe(0);
      expect(mockSetBalance24hCache).toHaveBeenCalledTimes(1);
      expect(mockSetBalance24hCache).toHaveBeenCalledWith(
        '0xc',
        expect.objectContaining({ data: { total_usd_value: 0 } }),
      );
      expect(
        balance24hModule.scene24hBalanceStore.getState().sceneLoading.Home,
      ).toBe(false);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('retains stale values and finishes loading when the batch request fails', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation();
    mockGetBalance24hCache.mockReturnValue({
      data: { total_usd_value: 20 },
      updateTime: 123,
      isExpired: true,
    });
    mockGet24hTotalBalanceBatch.mockRejectedValue(new Error('offline'));
    try {
      await balance24hModule.scene24hBalanceStore.refreshCombinedDataForScene(
        'Home',
        {
          addresses: ['0xA', '0xB'],
        },
      );
      expect(mockSetBalance24hCache).not.toHaveBeenCalled();
      expect(
        balance24hModule.balance24hStore.getAddress24hBalance('0xa'),
      ).toEqual({ total_usd_value: 20, updateTime: 123 });
      expect(
        balance24hModule.scene24hBalanceStore.getState().sceneLoading.Home,
      ).toBe(false);
      expect(
        balance24hModule.balance24hStore.getAddress24hBalanceFlowState('0xa')
          .isFetchingRemote,
      ).toBe(false);
    } finally {
      errorSpy.mockRestore();
    }
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
