type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

const createDeferred = <T>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(nextResolve => {
    resolve = nextResolve;
  });

  return {
    promise,
    resolve,
  };
};

describe('refreshHomeBalanceAfterAccountMutation', () => {
  const mockFetchTotalBalance = jest.fn();
  const mockRefresh24hAssets = jest.fn();
  const mockRefreshDayCurve = jest.fn();
  const selectedAddresses = ['0x1111', '0x2222'];

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    jest.doMock('./balance', () => ({
      __esModule: true,
      default: {
        fetchTotalBalance: (...args: unknown[]) =>
          mockFetchTotalBalance(...args),
      },
      balanceAccountsStore: {
        getState: () => ({
          selectedAddresses,
        }),
      },
    }));
    jest.doMock('./balance24h', () => ({
      scene24hBalanceStore: {
        refresh24hAssets: (...args: unknown[]) => mockRefresh24hAssets(...args),
      },
    }));
    jest.doMock('./curve24h', () => ({
      refreshDayCurve: (...args: unknown[]) => mockRefreshDayCurve(...args),
    }));
  });

  it('refreshes current balance before refreshing the resolved 24h selection', async () => {
    const balanceRefresh = createDeferred<Record<string, unknown>>();
    mockFetchTotalBalance.mockReturnValue(balanceRefresh.promise);
    mockRefresh24hAssets.mockResolvedValue(undefined);
    mockRefreshDayCurve.mockResolvedValue(undefined);

    const { refreshHomeBalanceAfterAccountMutation } =
      require('./homeBalanceRefresh') as typeof import('./homeBalanceRefresh');

    const refreshPromise = refreshHomeBalanceAfterAccountMutation();

    expect(mockFetchTotalBalance).toHaveBeenCalledWith('from_api');
    expect(mockRefresh24hAssets).not.toHaveBeenCalled();
    expect(mockRefreshDayCurve).not.toHaveBeenCalled();

    balanceRefresh.resolve({});
    await refreshPromise;

    expect(mockRefresh24hAssets).toHaveBeenCalledWith({
      addresses: selectedAddresses,
      force: true,
      reason: 'manual_refresh',
    });
    expect(mockRefreshDayCurve).toHaveBeenCalledWith({
      addresses: selectedAddresses,
      force: true,
      reason: 'manual_refresh',
    });
  });

  it('coalesces overlapping post-mutation refreshes', async () => {
    const balanceRefresh = createDeferred<Record<string, unknown>>();
    mockFetchTotalBalance.mockReturnValue(balanceRefresh.promise);
    mockRefresh24hAssets.mockResolvedValue(undefined);
    mockRefreshDayCurve.mockResolvedValue(undefined);

    const { refreshHomeBalanceAfterAccountMutation } =
      require('./homeBalanceRefresh') as typeof import('./homeBalanceRefresh');

    const firstRefresh = refreshHomeBalanceAfterAccountMutation();
    const secondRefresh = refreshHomeBalanceAfterAccountMutation();

    expect(mockFetchTotalBalance).toHaveBeenCalledTimes(1);

    balanceRefresh.resolve({});
    await Promise.all([firstRefresh, secondRefresh]);

    expect(mockRefresh24hAssets).toHaveBeenCalledTimes(1);
    expect(mockRefreshDayCurve).toHaveBeenCalledTimes(1);
  });
});
