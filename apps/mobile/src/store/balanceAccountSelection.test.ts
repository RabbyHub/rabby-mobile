type Deferred = {
  promise: Promise<void>;
  resolve: () => void;
};

type MockAccountState = {
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
  const mockFilterMyAccounts = jest.fn((accounts: unknown[]) => accounts);
  const mockFilterOutTop10Accounts = jest.fn(
    (accounts: Array<{ address: string }>) => ({
      top10Accounts: accounts.slice(0, 10),
      top10Addresses: accounts.slice(0, 10).map(account => account.address),
      top10Records: new Set(
        accounts.slice(0, 10).map(account => account.address.toLowerCase()),
      ),
      restAccounts: accounts.slice(10),
    }),
  );
  const mockFilterOutTopAccounts = jest.fn(
    (
      accounts: Array<{ address: string }>,
      options: { topCount: number; gatherSameAddress: boolean },
    ) => {
      const topRecords = new Set<string>();
      accounts.forEach(account => {
        if (topRecords.size < options.topCount) {
          topRecords.add(account.address.toLowerCase());
        }
      });
      const topAccounts = options.gatherSameAddress
        ? accounts.filter(account =>
            topRecords.has(account.address.toLowerCase()),
          )
        : accounts.slice(0, options.topCount);
      const restAccounts = options.gatherSameAddress
        ? accounts.filter(
            account => !topRecords.has(account.address.toLowerCase()),
          )
        : accounts.slice(options.topCount);

      return {
        topAccounts,
        topAddresses: Array.from(topRecords),
        topRecords,
        restAccounts,
      };
    },
  );
  const mockGetAccountList = jest.fn();
  const mockSortAccountList = jest.fn((accounts: unknown[]) => accounts);
  const mockSubscribeHomeAssetSelectionSettings = jest.fn();
  let homeAssetSelectionSettings = {
    topN: 10,
    includeWatchAddresses: false,
  };

  let accountSubscriber: ((state: MockAccountState) => void) | undefined;
  let accountState: MockAccountState;
  let homeAssetSelectionSettingsSubscriber:
    | ((settings: typeof homeAssetSelectionSettings) => void)
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
    homeAssetSelectionSettingsSubscriber = undefined;
    accountState = {
      accounts: [],
      hasFetchedAccounts: false,
      pinnedAddresses: [],
    };
    mockSubscribeHomeAssetSelectionSettings.mockImplementation(listener => {
      homeAssetSelectionSettingsSubscriber = listener;
      return jest.fn();
    });

    jest.doMock('@/core/apis/account', () => ({
      filterMyAccounts: mockFilterMyAccounts,
      filterOutTop10Accounts: mockFilterOutTop10Accounts,
      filterOutTopAccounts: mockFilterOutTopAccounts,
      getAccountList: mockGetAccountList,
      sortAccountList: mockSortAccountList,
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
    expect(mockSubscribeHomeAssetSelectionSettings).toHaveBeenCalledTimes(1);
  });

  it('uses the configured Top-100 selection for all account types', () => {
    homeAssetSelectionSettings = {
      topN: 100,
      includeWatchAddresses: true,
    };

    const accounts = Array.from({ length: 240 }, (_, index) => ({
      address:
        '0x' +
        Math.floor(index / 2)
          .toString(16)
          .padStart(40, '0'),
      type: index % 2 ? 'WatchAddressKeyring' : 'SimpleKeyring',
      brandName: 'Rabby',
    }));

    const { pickSelectedAccountsFromSortedAccounts } =
      require('./balanceAccountSelection') as {
        pickSelectedAccountsFromSortedAccounts: (input: typeof accounts) => {
          selectedAccounts: typeof accounts;
          selectedAddresses: string[];
        };
      };

    const selection = pickSelectedAccountsFromSortedAccounts(accounts);

    expect(selection.selectedAddresses).toHaveLength(100);
    expect(selection.selectedAccounts).toHaveLength(100);
    expect(selection.selectedAddresses).toEqual(
      Array.from(
        { length: 100 },
        (_, index) => '0x' + index.toString(16).padStart(40, '0'),
      ),
    );
    expect(mockFilterOutTop10Accounts).not.toHaveBeenCalled();
    expect(mockFilterOutTopAccounts).toHaveBeenCalledWith(accounts, {
      topCount: 100,
      gatherSameAddress: true,
    });
  });

  it('keeps the committed high-cardinality address order when building UI selection', () => {
    const accounts = [
      {
        address: '0xaaa',
        type: 'SimpleKeyring',
        brandName: 'Rabby',
      },
      {
        address: '0xbbb',
        type: 'WatchAddressKeyring',
        brandName: 'Rabby',
      },
      {
        address: '0xccc',
        type: 'GnosisKeyring',
        brandName: 'Rabby',
      },
    ];
    const { pickHomeAccountSelectionFromAddresses } =
      require('./homePortfolio/accountSelection') as {
        pickHomeAccountSelectionFromAddresses: (
          input: typeof accounts,
          addresses: string[],
        ) => {
          selectedAccounts: typeof accounts;
          selectedAddresses: string[];
          restAccounts: typeof accounts;
        };
      };

    const selection = pickHomeAccountSelectionFromAddresses(accounts, [
      '0xCCC',
      '0xAAA',
      '0xmissing',
      '0xccc',
    ]);

    expect(selection.selectedAddresses).toEqual(['0xccc', '0xaaa']);
    expect(selection.selectedAccounts.map(account => account.address)).toEqual([
      '0xccc',
      '0xaaa',
    ]);
    expect(selection.restAccounts.map(account => account.address)).toEqual([
      '0xbbb',
    ]);
  });

  it('keeps the legacy Top-10 selector for the default policy', () => {
    const accounts = Array.from({ length: 12 }, (_, index) => ({
      address: '0xlegacy' + index,
      type: 'SimpleKeyring',
      brandName: 'Rabby',
    }));

    const { pickSelectedAccountsFromSortedAccounts } =
      require('./balanceAccountSelection') as {
        pickSelectedAccountsFromSortedAccounts: (input: typeof accounts) => {
          selectedAccounts: typeof accounts;
          selectedAddresses: string[];
        };
      };

    const selection = pickSelectedAccountsFromSortedAccounts(accounts);

    expect(mockFilterOutTop10Accounts).toHaveBeenCalledWith(accounts, {
      gatherSameAddress: false,
    });
    expect(selection.selectedAddresses).toEqual(
      accounts.slice(0, 10).map(account => account.address),
    );
  });

  it('refreshes the selection after changing the non-production Top-N policy', async () => {
    const accounts = Array.from({ length: 240 }, (_, index) => ({
      address:
        '0x' +
        Math.floor(index / 2)
          .toString(16)
          .padStart(40, '0'),
      type: index % 2 ? 'WatchAddressKeyring' : 'SimpleKeyring',
      brandName: 'Rabby',
    }));
    accountState = {
      accounts,
      hasFetchedAccounts: true,
      pinnedAddresses: [],
    };

    const { ensureAccountBalanceSelectionLifecycle } =
      require('./balanceAccountSelection') as typeof import('./balanceAccountSelection');

    await ensureAccountBalanceSelectionLifecycle();
    expect(committedAddresses).toHaveLength(10);
    expect(homeAssetSelectionSettingsSubscriber).toBeDefined();

    homeAssetSelectionSettings = {
      topN: 100,
      includeWatchAddresses: true,
    };
    homeAssetSelectionSettingsSubscriber?.(homeAssetSelectionSettings);
    await flushPromises();
    await flushPromises();

    expect(committedAddresses).toHaveLength(100);
    expect(mockFilterMyAccounts).toHaveBeenCalledTimes(1);
    expect(mockSortAccountList).toHaveBeenLastCalledWith(accounts, {
      highlightedAddresses: [],
    });
  });
});
