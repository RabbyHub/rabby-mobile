describe('store/balance', () => {
  const mockQueryAllBalance = jest.fn();
  const mockQueryBalanceCache = jest.fn();
  const mockQueryBalance = jest.fn();
  const mockQueryBalanceCacheMapForStartup = jest.fn();
  const mockIsExpired = jest.fn();
  const mockSyncBalance = jest.fn();
  const mockOpenapiGetTotalBalanceV2 = jest.fn();
  const mockKeyringServiceGetAllAddresses = jest.fn();
  const mockGetAppChainTotalUsdValue = jest.fn();
  const mockBatchGetAppChains = jest.fn();
  const mockGetAppChains = jest.fn();
  const mockEnsureAppChainStoreInitialized = jest.fn();
  let mockAppStorageState: Record<string, unknown>;

  const flushResourceFlowPersist = async () => {
    await new Promise<void>(resolve => setImmediate(resolve));
  };

  let balanceModule: typeof import('./balance');

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockAppStorageState = {};

    jest.doMock('@/core/request', () => ({
      openapi: {
        getTotalBalanceV2: (...args: unknown[]) =>
          mockOpenapiGetTotalBalanceV2(...args),
      },
    }));
    jest.doMock('@/core/serviceApi/keyring', () => ({
      bindKeyringEvent: jest.fn(),
      keyringServiceApi: {
        getAllAddresses: (...args: unknown[]) =>
          mockKeyringServiceGetAllAddresses(...args),
      },
    }));
    jest.doMock('@/core/storage/mmkv', () => ({
      appStorage: {
        getItem: (key: string) => mockAppStorageState[key] ?? null,
        setItem: (key: string, value: unknown) => {
          mockAppStorageState[key] = value;
        },
        removeItem: (key: string) => {
          delete mockAppStorageState[key];
        },
      },
    }));
    jest.doMock('@/hooks/appSettings', () => ({
      getHomeAssetSelectionSettings: () => ({
        topN: 10,
        includeWatchAddresses: false,
      }),
      isHomeAssetSelectionExperimentEnabled: () => false,
    }));
    jest.doMock('@/core/utils/reexports', () => {
      const { create } = require('zustand');
      const { mutative } = require('zustand-mutative');
      return {
        zCreate: create,
        zMutative: mutative,
      };
    });
    jest.doMock('@/databases/entities/balance', () => ({
      BalanceEntity: {
        queryAllBalance: (...args: unknown[]) => mockQueryAllBalance(...args),
        queryBalanceCache: (...args: unknown[]) =>
          mockQueryBalanceCache(...args),
        queryBalanceCacheMapForStartup: (...args: unknown[]) =>
          mockQueryBalanceCacheMapForStartup(...args),
        queryBalance: (...args: unknown[]) => mockQueryBalance(...args),
        isExpired: (...args: unknown[]) => mockIsExpired(...args),
      },
    }));
    jest.doMock('@/databases/constant', () => ({
      ORM_TABLE_NAMES: {
        cache_balance: 'cache_balance',
      },
    }));
    jest.doMock('@/databases/sync/assets', () => ({
      syncBalance: (...args: unknown[]) => mockSyncBalance(...args),
    }));
    jest.doMock('p-queue', () => ({
      __esModule: true,
      default: class MockPQueue {
        add<T>(fn: () => Promise<T>) {
          return fn();
        }
      },
    }));
    jest.doMock('./appchain', () => ({
      ensureAppChainStoreInitialized: (...args: unknown[]) =>
        mockEnsureAppChainStoreInitialized(...args),
      useAppChainStore: {
        getState: () => ({
          appChainMap: {},
          getAppChainTotalUsdValue: (...args: unknown[]) =>
            mockGetAppChainTotalUsdValue(...args),
          batchGetAppChains: (...args: unknown[]) =>
            mockBatchGetAppChains(...args),
          getAppChains: (...args: unknown[]) => mockGetAppChains(...args),
        }),
      },
    }));
    jest.doMock('@rabby-wallet/base-utils/dist/isomorphic/address', () => ({
      isSameAddress: (left: string, right: string) =>
        left.toLowerCase() === right.toLowerCase(),
    }));
    jest.doMock('@rabby-wallet/keyring-utils', () => ({
      CORE_KEYRING_TYPES: ['SimpleKeyring'],
    }));
    jest.doMock('@/hooks/appSettings', () => ({
      getHomeAssetSelectionSettings: () => ({
        topN: 10,
        includeWatchAddresses: false,
      }),
      getHomeAssetSelectionSettingsKey: () => '10:0',
      isHomeAssetSelectionExperimentEnabled: () => false,
    }));

    balanceModule = require('./balance');
  });

  it('commits account selection snapshots without a Mutative raw-return warning', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation();

    balanceModule.commitAccountBalanceSelectionSnapshot(
      {
        selectedAccounts: [
          {
            address: '0xABCD',
            type: 'SimpleKeyring',
          },
        ],
        selectedAddresses: ['0xabcd'],
        matteredAccountLength: 1,
      },
      {
        source: 'accounts_changed',
      },
    );

    expect(warn).not.toHaveBeenCalledWith(
      expect.stringContaining(
        'return value does not contain any draft of the base state',
      ),
    );

    warn.mockRestore();
  });

  it('hydrates missing address memory from persisted sqlite cache first', async () => {
    mockQueryBalanceCache.mockResolvedValue({
      total_usd_value: 100,
      evm_usd_value: 80,
      chain_list: [{ id: 'eth' }],
    });
    mockGetAppChainTotalUsdValue.mockReturnValue(20);

    await balanceModule.default.hydrateCachedBalancesForAccounts([
      {
        address: '0xABCD',
        type: 'SimpleKeyring',
      },
    ]);

    expect(mockQueryBalanceCache).toHaveBeenCalledWith('0xabcd', true);
    expect(mockEnsureAppChainStoreInitialized).toHaveBeenCalled();
    expect(balanceModule.default.getAddressValue('0xabcd')).toEqual({
      evmBalance: 80,
      totalBalance: 100,
      chainList: [{ id: 'eth' }],
      isCore: true,
    });
    expect(balanceModule.default.getAddressChainList('0xabcd')).toEqual([
      { id: 'eth' },
    ]);
    expect(
      balanceModule.default.getAddressResourceState('0xABCD'),
    ).toMatchObject({
      sourceOfCurrentValue: 'hydrate',
      hasValue: true,
    });
  });

  it('uses persisted total balance on startup fast path', async () => {
    mockQueryBalanceCacheMapForStartup.mockResolvedValue({
      '0xabcd-core': {
        total_usd_value: 100,
        evm_usd_value: 80,
        chain_list: [{ id: 'eth' }],
      },
    });

    await balanceModule.default.hydrateCachedBalancesForAccounts(
      [
        {
          address: '0xABCD',
          type: 'SimpleKeyring',
        },
      ],
      {
        startupFastPath: true,
      },
    );

    expect(mockEnsureAppChainStoreInitialized).not.toHaveBeenCalled();
    expect(mockQueryBalanceCacheMapForStartup).toHaveBeenCalledWith([
      {
        owner_addr: '0xabcd',
        isCore: true,
      },
    ]);
    expect(balanceModule.default.getAddressValue('0xabcd')).toEqual({
      evmBalance: 80,
      totalBalance: 100,
      chainList: [{ id: 'eth' }],
      isCore: true,
    });
  });

  it('falls back to appchain store for ambiguous migrated startup cache', async () => {
    mockQueryBalanceCacheMapForStartup.mockResolvedValue({
      '0xabcd-core': {
        total_usd_value: 100,
        evm_usd_value: 0,
        chain_list: [{ id: 'eth' }],
      },
    });
    mockGetAppChainTotalUsdValue.mockReturnValue(20);

    await balanceModule.default.hydrateCachedBalancesForAccounts(
      [
        {
          address: '0xABCD',
          type: 'SimpleKeyring',
        },
      ],
      {
        startupFastPath: true,
      },
    );

    expect(mockEnsureAppChainStoreInitialized).toHaveBeenCalled();
    expect(balanceModule.default.getAddressValue('0xabcd')).toEqual({
      evmBalance: 0,
      totalBalance: 20,
      chainList: [{ id: 'eth' }],
      isCore: true,
    });
  });

  it('updates memory before scheduling sqlite persistence on remote refresh', async () => {
    mockKeyringServiceGetAllAddresses.mockResolvedValue([
      {
        address: '0xABCD',
        type: 'SimpleKeyring',
      },
    ]);
    mockGetAppChains.mockResolvedValue(undefined);
    mockGetAppChainTotalUsdValue.mockReturnValue(25);
    mockOpenapiGetTotalBalanceV2.mockResolvedValue({
      total_usd_value: 75,
      chain_list: [{ id: 'eth' }],
    });

    let observedDuringPersist:
      | ReturnType<typeof balanceModule.default.getAddressValue>
      | undefined;
    mockSyncBalance.mockImplementation(() => {
      observedDuringPersist = balanceModule.default.getAddressValue('0xabcd');
    });

    await balanceModule.default.getTotalBalance('0xABCD', true);

    expect(balanceModule.default.getAddressValue('0xabcd')).toEqual({
      evmBalance: 75,
      totalBalance: 100,
      chainList: [{ id: 'eth' }],
      isCore: true,
    });
    expect(balanceModule.default.getAddressChainList('0xabcd')).toEqual([
      { id: 'eth' },
    ]);

    await flushResourceFlowPersist();

    expect(observedDuringPersist).toEqual({
      evmBalance: 75,
      totalBalance: 100,
      chainList: [{ id: 'eth' }],
      isCore: true,
    });
    expect(mockSyncBalance).toHaveBeenCalledWith('0xabcd', true, {
      total_usd_value: 100,
      evm_usd_value: 75,
      chain_list: [{ id: 'eth' }],
    });
    expect(
      balanceModule.default.getAddressResourceState('0xABCD'),
    ).toMatchObject({
      sourceOfCurrentValue: 'remote',
      persistStatus: 'success',
      hasValue: true,
    });
  });

  it('publishes a multi-address remote balance result as one value update', async () => {
    mockKeyringServiceGetAllAddresses.mockResolvedValue([
      {
        address: '0xAAAA',
        type: 'SimpleKeyring',
      },
      {
        address: '0xBBBB',
        type: 'SimpleKeyring',
      },
    ]);
    mockBatchGetAppChains.mockResolvedValue(undefined);
    mockGetAppChainTotalUsdValue.mockReturnValue(0);
    mockOpenapiGetTotalBalanceV2.mockImplementation(
      ({ address }: { address: string }) =>
        Promise.resolve({
          total_usd_value: address === '0xaaaa' ? 10 : 20,
          chain_list: [],
        }),
    );

    let valuePublicationCount = 0;
    const unsubscribe = balanceModule.default.subscribe((state, prev) => {
      if (state.valueMap !== prev.valueMap) {
        valuePublicationCount += 1;
      }
    });

    await balanceModule.default.batchGetTotalBalance(
      ['0xAAAA', '0xBBBB'],
      true,
    );

    expect(valuePublicationCount).toBe(1);
    expect(balanceModule.default.getAddressValue('0xaaaa')).toMatchObject({
      evmBalance: 10,
      totalBalance: 10,
    });
    expect(balanceModule.default.getAddressValue('0xbbbb')).toMatchObject({
      evmBalance: 20,
      totalBalance: 20,
    });
    unsubscribe();
    await flushResourceFlowPersist();
  });

  it('recomputes total balance when appchain value changes after balance hydrate', async () => {
    mockQueryBalanceCache.mockResolvedValue({
      total_usd_value: 80,
      evm_usd_value: 80,
      chain_list: [{ id: 'eth' }],
    });
    mockGetAppChainTotalUsdValue.mockReturnValueOnce(0);

    await balanceModule.default.hydrateCachedBalancesForAccounts([
      {
        address: '0xABCD',
        type: 'SimpleKeyring',
      },
    ]);

    expect(balanceModule.default.getAddressValue('0xabcd')).toMatchObject({
      evmBalance: 80,
      totalBalance: 80,
    });

    mockGetAppChainTotalUsdValue.mockReturnValue(25);
    const changed = balanceModule.default.syncAppChainTotalsForAddresses(
      ['0xABCD'],
      {
        trigger: 'test',
      },
    );

    expect(changed).toBe(true);
    expect(balanceModule.default.getAddressValue('0xabcd')).toMatchObject({
      evmBalance: 80,
      totalBalance: 105,
    });
  });
});
