describe('accountStore pinned address hydration', () => {
  const persistedAddress = {
    address: '0xAbCd000000000000000000000000000000001234',
    brandName: 'Rabby',
  };

  const mockGetPinnedAddresses = jest.fn();
  const mockUpdatePinnedAddresses = jest.fn();
  let resolvePinnedAddresses:
    | ((addresses: (typeof persistedAddress)[]) => void)
    | null;
  let accountStore: typeof import('./account').default;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    resolvePinnedAddresses = null;

    mockGetPinnedAddresses.mockImplementation(
      () =>
        new Promise<(typeof persistedAddress)[]>(resolve => {
          resolvePinnedAddresses = resolve;
        }),
    );
    mockUpdatePinnedAddresses.mockResolvedValue(undefined);

    jest.doMock('react-native', () => ({
      InteractionManager: {
        runAfterInteractions: (callback: () => void) => callback(),
      },
    }));
    jest.doMock('@/core/utils/reexports', () => {
      const { create } = require('zustand');
      return {
        mCreate: <T>(input: T) => input,
        zCreate: create,
        zMutative: <T>(input: T) => input,
      };
    });
    jest.doMock('@/core/apis/account', () => ({
      accountEvents: { emit: jest.fn(), on: jest.fn() },
      fetchAllAccounts: jest.fn(),
      invalidateFetchAllAccountsCache: jest.fn(),
    }));
    jest.doMock('@/core/apis/mnemonic', () => ({
      getMnemonicAddressInfo: jest.fn(),
    }));
    jest.doMock('@/core/apis/address', () => ({
      getAllAccounts: jest.fn(),
      removeAddress: jest.fn(),
    }));
    jest.doMock('@/databases/entities/accountInfo', () => ({
      AccountInfoEntity: {
        deleteByAccount: jest.fn(),
        getAccountsAddedIn: jest.fn(),
        recordNewAccount: jest.fn(),
        trimExpiredAccounts: jest.fn(),
      },
    }));
    jest.doMock('@/databases/entities/base', () => ({
      EntityAccountBase: { buildDBId: jest.fn() },
    }));
    jest.doMock('@/databases/entities/_helpers', () => ({
      ormEvents: { on: jest.fn() },
    }));
    jest.doMock('@/databases/sync/assets', () => ({
      deleteDBResourceForAddress: jest.fn(),
    }));
    jest.doMock('@/core/serviceApi/keyring', () => ({
      bindKeyringEvent: jest.fn(),
      bindKeyringStore: jest.fn(),
    }));
    jest.doMock('@/core/serviceApi/preference', () => ({
      clearNeedsBackupReminder: jest.fn(),
      getPinnedAddresses: (...args: unknown[]) =>
        mockGetPinnedAddresses(...args),
      getPinnedAddressSnapshot: () => [],
      setNeedsBackupReminder: jest.fn(),
      updatePinnedAddresses: (...args: unknown[]) =>
        mockUpdatePinnedAddresses(...args),
    }));
    jest.doMock('@/core/serviceApi/transactionHistory', () => ({
      transactionHistoryServiceApi: { clearSuccessAndFailList: jest.fn() },
    }));
    jest.doMock('@/core/utils/perf', () => ({
      perfEvents: { subscribe: jest.fn() },
    }));
    jest.doMock('@/utils/events', () => ({
      EVENT_SWITCH_ACCOUNT: 'EVENT_SWITCH_ACCOUNT',
      eventBus: { on: jest.fn() },
    }));
    jest.doMock('@rabby-wallet/base-utils/dist/isomorphic/address', () => ({
      isSameAddress: (left: string, right: string) =>
        left.toLowerCase() === right.toLowerCase(),
    }));
    jest.doMock('@rabby-wallet/keyring-utils', () => ({
      KEYRING_TYPE: { HdKeyring: 'HdKeyring' },
    }));
    jest.doMock('@/utils/analytics', () => ({
      matomoRequestEvent: jest.fn(),
    }));
    jest.doMock('@/hooks/historyTokenDict', () => ({
      updateHistoryTimeSingleAddress: jest.fn(),
    }));
    jest.doMock('@/utils/autoLoginGasAccount', () => ({
      checkAddedAccountsGasAccountIfNeeded: jest.fn(),
    }));
    jest.doMock('@/core/utils/homeStartupReady', () => ({
      runAfterHomePostStartupReady: jest.fn(),
    }));

    accountStore = require('./account').default;
  });

  it('hydrates after delayed service readiness and prevents a duplicate pin', async () => {
    expect(accountStore.getState().pinnedAddresses).toEqual([]);

    const firstHydration = accountStore.ensurePinnedAddressesHydrated();
    const concurrentHydration = accountStore.ensurePinnedAddressesHydrated();

    expect(mockGetPinnedAddresses).toHaveBeenCalledTimes(1);
    resolvePinnedAddresses?.([persistedAddress]);

    await expect(firstHydration).resolves.toEqual([persistedAddress]);
    await expect(concurrentHydration).resolves.toEqual([persistedAddress]);
    expect(accountStore.getState().pinnedAddresses).toEqual([persistedAddress]);

    await accountStore.togglePinAddressAsync({
      ...persistedAddress,
      nextPinned: true,
    });

    expect(mockGetPinnedAddresses).toHaveBeenCalledTimes(1);
    expect(mockUpdatePinnedAddresses).toHaveBeenCalledWith([persistedAddress]);
    expect(accountStore.getState().pinnedAddresses).toEqual([persistedAddress]);
  });
});
