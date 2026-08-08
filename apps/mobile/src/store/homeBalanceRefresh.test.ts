import { createHomeBalanceRefreshAfterAccountMutation } from './homeBalanceRefreshCoordinator';

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(nextResolve => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

describe('createHomeBalanceRefreshAfterAccountMutation', () => {
  it('resolves the address selection after current balance refresh', async () => {
    const balanceRefresh = createDeferred<void>();
    let selectedAddresses = ['0x1111', '0x2222'];
    const refresh24hAssets = jest.fn().mockResolvedValue(undefined);
    const refreshDayCurve = jest.fn().mockResolvedValue(undefined);
    const refresh = createHomeBalanceRefreshAfterAccountMutation({
      fetchCurrentBalance: () => balanceRefresh.promise,
      getSelectedAddresses: () => selectedAddresses,
      refresh24hAssets,
      refreshDayCurve,
    });

    const refreshPromise = refresh();
    selectedAddresses = ['0x1111'];

    expect(refresh24hAssets).not.toHaveBeenCalled();
    expect(refreshDayCurve).not.toHaveBeenCalled();

    balanceRefresh.resolve();
    await refreshPromise;

    expect(refresh24hAssets).toHaveBeenCalledWith({
      addresses: ['0x1111'],
      force: true,
      reason: 'manual_refresh',
    });
    expect(refreshDayCurve).toHaveBeenCalledWith({
      addresses: ['0x1111'],
      force: true,
      reason: 'manual_refresh',
    });
  });

  it('coalesces overlapping refreshes', async () => {
    const balanceRefresh = createDeferred<void>();
    const fetchCurrentBalance = jest.fn(() => balanceRefresh.promise);
    const refresh24hAssets = jest.fn().mockResolvedValue(undefined);
    const refreshDayCurve = jest.fn().mockResolvedValue(undefined);
    const refresh = createHomeBalanceRefreshAfterAccountMutation({
      fetchCurrentBalance,
      getSelectedAddresses: () => ['0x1111'],
      refresh24hAssets,
      refreshDayCurve,
    });

    const firstRefresh = refresh();
    const secondRefresh = refresh();

    expect(fetchCurrentBalance).toHaveBeenCalledTimes(1);

    balanceRefresh.resolve();
    await Promise.all([firstRefresh, secondRefresh]);

    expect(refresh24hAssets).toHaveBeenCalledTimes(1);
    expect(refreshDayCurve).toHaveBeenCalledTimes(1);
  });
});
