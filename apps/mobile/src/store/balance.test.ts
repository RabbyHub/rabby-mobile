describe('store/balance', () => {
  const mockQueryAllBalance = jest.fn();
  const mockQueryBalanceCache = jest.fn();
  const mockQueryBalance = jest.fn();
  const mockIsExpired = jest.fn();
  const mockSyncBalance = jest.fn();
  const mockOpenapiGetTotalBalanceV2 = jest.fn();
  const mockKeyringServiceGetAllAddresses = jest.fn();
  const mockGetAppChainTotalUsdValue = jest.fn();
  const mockBatchGetAppChains = jest.fn();
  const mockGetAppChains = jest.fn();
  let mockAppStorageState: Record<string, unknown>;

  const flushResourceFlowPersist = async () => {
    await Promise.resolve();
    await Promise.resolve();
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
    jest.doMock('@/core/services', () => ({
      keyringService: {
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
    jest.doMock('@/core/utils/reexports', () => {
      const { create } = require('zustand');
      return {
        zCreate: create,
        zMutative: <T>(input: T) => input,
      };
    });
    jest.doMock('@/databases/entities/balance', () => ({
      BalanceEntity: {
        queryAllBalance: (...args: unknown[]) => mockQueryAllBalance(...args),
        queryBalanceCache: (...args: unknown[]) =>
          mockQueryBalanceCache(...args),
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

    balanceModule = require('./balance');
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
});
