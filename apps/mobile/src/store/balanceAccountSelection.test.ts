type Deferred = {
  promise: Promise<void>;
  resolve: () => void;
};

const createDeferred = (): Deferred => {
  let resolve!: () => void;
  const promise = new Promise<void>(nextResolve => {
    resolve = nextResolve;
  });

  return {
    promise,
    resolve,
  };
};

const flushPromises = () =>
  new Promise<void>(resolve => {
    setImmediate(resolve);
  });

describe('account balance selection lifecycle', () => {
  const mockHydrateCachedBalancesForAccounts = jest.fn();
  const mockApplyAccountBalanceSelectionSnapshot = jest.fn();
  const mockFilterMyAccounts = jest.fn((accounts: Array<{ type: string }>) =>
    accounts.filter(account => account.type !== 'WatchAddressKeyring'),
  );
  const mockSubscribeHomeAssetSelectionSettings = jest.fn();

  let homeAssetSelectionSettings = {
    topN: 10,
    includeWatchAddresses: false,
  };
  let accountState = {
    accounts: [] as Array<{
      address: string;
      type: string;
      brandName: string;
    }>,
    hasFetchedAccounts: false,
    pinnedAddresses: [] as Array<{
      address: string;
      brandName: string;
    }>,
  };

  let accountSubscriber:
    | ((state: {
        accounts: Array<{
          address: string;
          type: string;
          brandName: string;
        }>;
        hasFetchedAccounts: boolean;
        pinnedAddresses: Array<{
          address: string;
          brandName: string;
        }>;
      }) => void)
    | undefined;
  let committedAddresses: string[];

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    accountSubscriber = undefined;
    committedAddresses = [];
    homeAssetSelectionSettings = {
      topN: 10,
      includeWatchAddresses: false,
    };
    accountState = {
      accounts: [],
      hasFetchedAccounts: false,
      pinnedAddresses: [],
    };

    jest.doMock('@/core/apis/account', () => ({
      filterMyAccounts: mockFilterMyAccounts,
      filterOutTop10Accounts: (
        accounts: Array<{
          address: string;
        }>,
      ) => ({
        top10Accounts: accounts.slice(0, 10),
        top10Addresses: accounts.slice(0, 10).map(account => account.address),
        top10Records: new Set(
          accounts.slice(0, 10).map(account => account.address.toLowerCase()),
        ),
        restAccounts: accounts.slice(10),
      }),
      filterOutTopAccounts: (
        accounts: Array<{ address: string }>,
        options: { topCount: number },
      ) => {
        const topRecords = new Set<string>();
        accounts.forEach(account => {
          if (topRecords.size < options.topCount) {
            topRecords.add(account.address.toLowerCase());
          }
        });
        return {
          topAccounts: accounts.filter(account =>
            topRecords.has(account.address.toLowerCase()),
          ),
          topAddresses: Array.from(topRecords),
          topRecords,
          restAccounts: accounts.filter(
            account => !topRecords.has(account.address.toLowerCase()),
          ),
        };
      },
      getAccountList: jest.fn(),
      sortAccountList: (accounts: unknown[]) => accounts,
    }));
    jest.doMock('@/hooks/appSettings', () => ({
      getHomeAssetSelectionSettings: () => homeAssetSelectionSettings,
      isHomeAssetSelectionExperimentEnabled: (
        settings = homeAssetSelectionSettings,
      ) => settings.topN !== 10 || settings.includeWatchAddresses,
      subscribeHomeAssetSelectionSettings:
        mockSubscribeHomeAssetSelectionSettings,
    }));
    jest.doMock('@/core/serviceApi/keyring', () => ({
      bindKeyringEventAfterRegistration: jest.fn(),
      isKeyringUnlockedSnapshot: () => true,
    }));
    jest.doMock('@/core/utils/androidTrace', () => ({
      traceAndroidInstant: jest.fn(),
    }));
    jest.doMock('./account', () => ({
      __esModule: true,
      default: {
        getState: () => accountState,
        subscribe: (subscriber: typeof accountSubscriber) => {
          accountSubscriber = subscriber;
          return jest.fn();
        },
      },
    }));
    jest.doMock('./balance', () => ({
      __esModule: true,
      default: {
        hydrateCachedBalancesForAccounts: (...args: unknown[]): Promise<void> =>
          mockHydrateCachedBalancesForAccounts(...args),
      },
      applyAccountBalanceSelectionSnapshot: async (
        snapshot: {
          selectedAccounts: unknown[];
          selectedAddresses: string[];
        },
        options: {
          hydrate: boolean;
        },
      ) => {
        if (options.hydrate) {
          await mockHydrateCachedBalancesForAccounts(snapshot.selectedAccounts);
        }
        committedAddresses = snapshot.selectedAddresses;
        mockApplyAccountBalanceSelectionSnapshot(snapshot, options);
        return {};
      },
      commitAccountBalanceSelectionSnapshot: (
        snapshot: {
          selectedAddresses: string[];
        },
        options: {
          source: string;
        },
      ) => {
        committedAddresses = snapshot.selectedAddresses;
        mockApplyAccountBalanceSelectionSnapshot(snapshot, {
          ...options,
          hydrate: false,
        });
        return {};
      },
      setAccountBalanceSelectionSnapshotGetter: jest.fn(),
      startProcessAddressBalanceEvents: jest.fn(),
    }));
  });

  it('does not let a pre-delete hydrate overwrite the latest account selection', async () => {
    const preDeleteHydrate = createDeferred();
    const postDeleteHydrate = createDeferred();
    mockHydrateCachedBalancesForAccounts
      .mockReturnValueOnce(preDeleteHydrate.promise)
      .mockReturnValueOnce(postDeleteHydrate.promise);

    const stableAccounts = Array.from({ length: 9 }, (_, index) => ({
      address: `0xstable${index}`,
      type: 'SimpleKeyring',
      brandName: 'Rabby',
    }));
    const deletedAccount = {
      address: '0xdeleted',
      type: 'SimpleKeyring',
      brandName: 'Rabby',
    };
    const promotedAccount = {
      address: '0xpromoted',
      type: 'SimpleKeyring',
      brandName: 'Rabby',
    };
    const preDeleteAccounts = [
      deletedAccount,
      ...stableAccounts,
      promotedAccount,
    ];
    const postDeleteAccounts = [...stableAccounts, promotedAccount];

    const { ensureAccountBalanceSelectionLifecycle } =
      require('./balanceAccountSelection') as typeof import('./balanceAccountSelection');

    await ensureAccountBalanceSelectionLifecycle();
    expect(accountSubscriber).toBeDefined();

    accountSubscriber?.({
      accounts: preDeleteAccounts,
      hasFetchedAccounts: true,
      pinnedAddresses: [],
    });
    accountSubscriber?.({
      accounts: postDeleteAccounts,
      hasFetchedAccounts: true,
      pinnedAddresses: [],
    });

    expect(mockHydrateCachedBalancesForAccounts).toHaveBeenCalledTimes(2);
    expect(mockHydrateCachedBalancesForAccounts.mock.calls[1][0]).toEqual(
      postDeleteAccounts,
    );
    expect(committedAddresses).toEqual(
      postDeleteAccounts.map(account => account.address),
    );

    postDeleteHydrate.resolve();
    await flushPromises();
    expect(committedAddresses).toEqual(
      postDeleteAccounts.map(account => account.address),
    );

    preDeleteHydrate.resolve();
    await flushPromises();

    expect(committedAddresses).toEqual(
      postDeleteAccounts.map(account => account.address),
    );
    expect(mockApplyAccountBalanceSelectionSnapshot).toHaveBeenCalledTimes(3);
    expect(committedAddresses).not.toContain(deletedAccount.address);
    expect(committedAddresses).toContain(promotedAccount.address);
  });

  it('includes Watch addresses and applies the configured Top-N in non-production policy', async () => {
    homeAssetSelectionSettings = {
      topN: 20,
      includeWatchAddresses: true,
    };
    accountState = {
      accounts: [
        {
          address: '0xowned',
          type: 'SimpleKeyring',
          brandName: 'Rabby',
        },
        {
          address: '0xwatch',
          type: 'WatchAddressKeyring',
          brandName: 'Rabby',
        },
      ],
      hasFetchedAccounts: true,
      pinnedAddresses: [],
    };

    const { ensureAccountBalanceSelectionLifecycle } =
      require('./balanceAccountSelection') as typeof import('./balanceAccountSelection');

    await ensureAccountBalanceSelectionLifecycle();

    expect(committedAddresses).toEqual(['0xowned', '0xwatch']);
    expect(mockFilterMyAccounts).not.toHaveBeenCalled();
    expect(mockHydrateCachedBalancesForAccounts).toHaveBeenCalledWith(
      accountState.accounts,
    );
  });
});
