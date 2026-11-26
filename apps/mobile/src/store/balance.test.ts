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
  let mockAppChainMap: Record<string, unknown[]>;
  let mockAppChainSubscribers: Array<
    (state: { appChainMap: Record<string, unknown[]> }) => void
  >;
  let mockAppStorageState: Record<string, unknown>;

  const flushResourceFlowPersist = async () => {
    await new Promise<void>(resolve => setImmediate(resolve));
  };

  let balanceModule: typeof import('./balance');

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockAppChainMap = {};
    mockAppChainSubscribers = [];
    mockAppStorageState = {};

    jest.doMock('@/core/request', () => ({
      openapi: {
        getTotalBalanceV2: (...args: unknown[]) =>
          mockOpenapiGetTotalBalanceV2(...args),
      },
    }));
    jest.doMock('@/core/serviceApi/keyring', () => ({
      bindKeyringEvent: jest.fn().mockResolvedValue(undefined),
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
          appChainMap: mockAppChainMap,
          getAppChainTotalUsdValue: (...args: unknown[]) =>
            mockGetAppChainTotalUsdValue(...args),
          batchGetAppChains: (...args: unknown[]) =>
            mockBatchGetAppChains(...args),
          getAppChains: (...args: unknown[]) => mockGetAppChains(...args),
        }),
        subscribe: (
          listener: (state: { appChainMap: Record<string, unknown[]> }) => void,
        ) => {
          mockAppChainSubscribers.push(listener);
          return () => {
            mockAppChainSubscribers = mockAppChainSubscribers.filter(
              item => item !== listener,
            );
          };
        },
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

  it.each(['Home', 'ImportSuccess'])(
    'refreshes EVM and AppChain for %s',
    async scene => {
      mockKeyringServiceGetAllAddresses.mockResolvedValue([]);
      mockOpenapiGetTotalBalanceV2.mockResolvedValue({
        total_usd_value: 75,
        chain_list: [],
      });
      mockBatchGetAppChains.mockImplementationOnce(async () => {
        await flushResourceFlowPersist();
        expect(mockOpenapiGetTotalBalanceV2).toHaveBeenCalledTimes(
          scene === 'Home' ? 1 : 0,
        );
        expect(mockSyncBalance).not.toHaveBeenCalled();
        mockGetAppChainTotalUsdValue.mockReturnValue(25);
      });
      const store = balanceModule.default;
      await store.batchGetTotalBalance(['0xABCD'], true, { scene });
      expect(store.getAddressValue('0xabcd')?.totalBalance).toBe(100);
    },
  );

  it('shares the current selection with 24h while the real-time refresh is still pending', async () => {
    const {
      renderHook,
    }: typeof import('@testing-library/react-native/pure') = require('@testing-library/react-native/pure');
    const store = balanceModule.default;
    const select = jest.fn().mockResolvedValue({
      selectedAccounts: [{ address: '0xA', type: 'SimpleKeyring' }],
      selectedAddresses: ['0xa'],
      matteredAccountLength: 1,
    });
    balanceModule.setAccountBalanceSelectionSnapshotGetter(select);
    mockKeyringServiceGetAllAddresses.mockResolvedValue([]);
    let finishAppChains!: () => void;
    mockBatchGetAppChains.mockReturnValueOnce(
      new Promise<void>(resolve => {
        finishAppChains = resolve;
      }),
    );
    mockOpenapiGetTotalBalanceV2.mockResolvedValueOnce({
      total_usd_value: 75,
      chain_list: [],
    });
    mockGetAppChainTotalUsdValue.mockReturnValue(25);
    const { result, unmount } = renderHook(() =>
      store.useAccountsBalanceTrigger(),
    );
    let finish24h!: () => void;
    const start24h = jest.fn(
      () =>
        new Promise<void>(resolve => {
          finish24h = resolve;
        }),
    );
    try {
      const balance = store.fetchTotalBalance('from_api');
      await flushResourceFlowPersist();
      const home = result.current.triggerUpdate(true, start24h);
      await flushResourceFlowPersist();
      expect(select).toHaveBeenCalledTimes(1);
      expect(start24h).toHaveBeenCalledWith(['0xa']);
      expect(mockOpenapiGetTotalBalanceV2).toHaveBeenCalledTimes(1);
      expect(mockSyncBalance).not.toHaveBeenCalled();
      finishAppChains();
      await Promise.all([balance, home]);
      expect(store.getAddressValue('0xa')?.totalBalance).toBe(100);
    } finally {
      finishAppChains?.();
      finish24h?.();
      unmount();
    }
  });

  it.each(['SingleAddressHome', 'AddressCard', 'Database', 'Unknown'])(
    'starts EVM before AppChain finishes for %s',
    async scene => {
      mockKeyringServiceGetAllAddresses.mockResolvedValue([]);
      mockGetAppChainTotalUsdValue.mockReturnValue(0);
      mockOpenapiGetTotalBalanceV2.mockResolvedValue({
        total_usd_value: 75,
        chain_list: [],
      });
      mockGetAppChains.mockImplementationOnce(async () => {
        await flushResourceFlowPersist();
        expect(mockOpenapiGetTotalBalanceV2).toHaveBeenCalledTimes(1);
        expect(mockSyncBalance).not.toHaveBeenCalled();
        mockGetAppChainTotalUsdValue.mockReturnValue(25);
      });

      const store = balanceModule.default;
      await store.getTotalBalance('0xABCD', true, { scene });
      expect(store.getAddressValue('0xabcd')?.totalBalance).toBe(100);
    },
  );

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

  it('preserves previous appchain delta when batchGetAppChains fails for an address without cached appchains', async () => {
    mockQueryBalanceCacheMapForStartup.mockResolvedValue({
      '0xaaaa-core': {
        total_usd_value: 650,
        evm_usd_value: 1,
        chain_list: [{ id: 'eth' }],
      },
      '0xbbbb-core': {
        total_usd_value: 120,
        evm_usd_value: 20,
        chain_list: [{ id: 'eth' }],
      },
    });
    await balanceModule.default.hydrateCachedBalancesForAccounts(
      [
        { address: '0xAAAA', type: 'SimpleKeyring' },
        { address: '0xBBBB', type: 'SimpleKeyring' },
      ],
      { startupFastPath: true },
    );

    mockKeyringServiceGetAllAddresses.mockResolvedValue([
      { address: '0xAAAA', type: 'SimpleKeyring' },
      { address: '0xBBBB', type: 'SimpleKeyring' },
    ]);
    mockOpenapiGetTotalBalanceV2.mockImplementation(
      async ({ address }: { address: string }) => ({
        total_usd_value: address === '0xaaaa' ? 2 : 30,
        chain_list: [{ id: 'eth' }],
      }),
    );
    mockGetAppChainTotalUsdValue.mockReturnValue(0);
    mockBatchGetAppChains.mockImplementationOnce(async () => {
      mockAppChainMap = { '0xbbbb': [] };
    });

    await balanceModule.default.batchGetTotalBalance(
      ['0xAAAA', '0xBBBB'],
      true,
      { scene: 'Home' },
    );

    expect(balanceModule.default.getAddressValue('0xaaaa')).toMatchObject({
      evmBalance: 2,
      totalBalance: 651,
    });
    expect(balanceModule.default.getAddressValue('0xbbbb')).toMatchObject({
      evmBalance: 30,
      totalBalance: 30,
    });

    await flushResourceFlowPersist();
    expect(mockSyncBalance).toHaveBeenCalledWith('0xaaaa', true, {
      total_usd_value: 651,
      evm_usd_value: 2,
      chain_list: [{ id: 'eth' }],
    });
    expect(mockSyncBalance).toHaveBeenCalledWith('0xbbbb', true, {
      total_usd_value: 30,
      evm_usd_value: 30,
      chain_list: [{ id: 'eth' }],
    });
  });

  it('preserves previous appchain delta when getTotalBalance fails to fetch appchains, and clears it on successful empty list', async () => {
    mockQueryBalanceCacheMapForStartup.mockResolvedValue({
      '0xabcd-core': {
        total_usd_value: 650,
        evm_usd_value: 1,
        chain_list: [{ id: 'eth' }],
      },
    });
    await balanceModule.default.hydrateCachedBalancesForAccounts(
      [{ address: '0xABCD', type: 'SimpleKeyring' }],
      { startupFastPath: true },
    );

    mockKeyringServiceGetAllAddresses.mockResolvedValue([
      { address: '0xABCD', type: 'SimpleKeyring' },
    ]);
    mockGetAppChainTotalUsdValue.mockReturnValue(0);
    mockGetAppChains.mockResolvedValueOnce(undefined);
    mockOpenapiGetTotalBalanceV2.mockResolvedValueOnce({
      total_usd_value: 3,
      chain_list: [{ id: 'eth' }],
    });

    await balanceModule.default.getTotalBalance('0xABCD', true);
    expect(balanceModule.default.getAddressValue('0xabcd')).toMatchObject({
      evmBalance: 3,
      totalBalance: 652,
    });

    mockAppChainMap = { '0xabcd': [] };
    mockGetAppChains.mockResolvedValueOnce([]);
    mockOpenapiGetTotalBalanceV2.mockResolvedValueOnce({
      total_usd_value: 3,
      chain_list: [{ id: 'eth' }],
    });

    await balanceModule.default.getTotalBalance('0xABCD', true);
    expect(balanceModule.default.getAddressValue('0xabcd')).toMatchObject({
      evmBalance: 3,
      totalBalance: 3,
    });
  });

  it('does not zero out unrelated addresses when appChainMap updates partially', async () => {
    balanceModule.startProcessAddressBalanceEvents();

    mockQueryBalanceCacheMapForStartup.mockResolvedValue({
      '0xaaaa-core': {
        total_usd_value: 650,
        evm_usd_value: 1,
        chain_list: [{ id: 'eth' }],
      },
      '0xbbbb-core': {
        total_usd_value: 10,
        evm_usd_value: 10,
        chain_list: [{ id: 'eth' }],
      },
    });
    await balanceModule.default.hydrateCachedBalancesForAccounts(
      [
        { address: '0xAAAA', type: 'SimpleKeyring' },
        { address: '0xBBBB', type: 'SimpleKeyring' },
      ],
      { startupFastPath: true },
    );

    mockGetAppChainTotalUsdValue.mockImplementation((addr: string) =>
      addr === '0xbbbb' ? 25 : 0,
    );
    mockAppChainMap = { '0xbbbb': [{ id: 'hl', netWorth: 25 }] };
    mockAppChainSubscribers.forEach(listener =>
      listener({ appChainMap: mockAppChainMap }),
    );

    expect(balanceModule.default.getAddressValue('0xaaaa')).toMatchObject({
      evmBalance: 1,
      totalBalance: 650,
    });
    expect(balanceModule.default.getAddressValue('0xbbbb')).toMatchObject({
      evmBalance: 10,
      totalBalance: 35,
    });
  });
});
