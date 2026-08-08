import { createHomeBalanceRefreshAfterAccountMutation } from './homeBalanceRefreshCoordinator';

type AccountAsset = {
  address: string;
  balance: number;
  balance24hAgo: number;
};

type Deferred = {
  promise: Promise<void>;
  resolve: () => void;
};

function createDeferred(): Deferred {
  let resolve = () => undefined;
  const promise = new Promise<void>(release => {
    resolve = release;
  });
  return { promise, resolve };
}

function createHomeDataModel(initialAccounts: AccountAsset[]) {
  let accounts = initialAccounts;
  let selectedAddresses = initialAccounts.map(account => account.address);
  let currentBalance = 0;
  let change24hPercent: number | null = null;
  let curveAddresses: string[] = [];
  const balanceGate = createDeferred();
  const events: string[] = [];

  const refresh = createHomeBalanceRefreshAfterAccountMutation({
    fetchCurrentBalance: async () => {
      events.push('balance:start');
      await balanceGate.promise;
      selectedAddresses = accounts.map(account => account.address);
      currentBalance = accounts.reduce(
        (total, account) => total + account.balance,
        0,
      );
      events.push('balance:published');
    },
    getSelectedAddresses: () => selectedAddresses,
    refresh24hAssets: async ({ addresses }) => {
      events.push(`24h:${addresses.join(',')}`);
      const selected = accounts.filter(account =>
        addresses.includes(account.address),
      );
      const previousBalance = selected.reduce(
        (total, account) => total + account.balance24hAgo,
        0,
      );
      const nextBalance = selected.reduce(
        (total, account) => total + account.balance,
        0,
      );
      change24hPercent =
        previousBalance === 0
          ? 0
          : ((nextBalance - previousBalance) / previousBalance) * 100;
    },
    refreshDayCurve: async ({ addresses }) => {
      events.push(`curve:${addresses.join(',')}`);
      curveAddresses = [...addresses];
    },
  });

  return {
    refresh,
    removeAccount(address: string) {
      accounts = accounts.filter(account => account.address !== address);
    },
    releaseBalanceRefresh: balanceGate.resolve,
    getSnapshot: () => ({
      currentBalance,
      change24hPercent,
      curveAddresses,
      selectedAddresses,
      events,
    }),
  };
}

describe('Home account data convergence integration', () => {
  it('publishes current balance and 24h data from the same post-removal account set', async () => {
    const model = createHomeDataModel([
      { address: '0x1111', balance: 100, balance24hAgo: 80 },
      { address: '0x2222', balance: 50, balance24hAgo: 50 },
    ]);

    model.removeAccount('0x2222');
    const firstRefresh = model.refresh();
    const overlappingRefresh = model.refresh();

    expect(model.getSnapshot()).toEqual(
      expect.objectContaining({
        currentBalance: 0,
        change24hPercent: null,
        events: ['balance:start'],
      }),
    );

    model.releaseBalanceRefresh();
    await Promise.all([firstRefresh, overlappingRefresh]);

    expect(model.getSnapshot()).toEqual({
      currentBalance: 100,
      change24hPercent: 25,
      selectedAddresses: ['0x1111'],
      curveAddresses: ['0x1111'],
      events: [
        'balance:start',
        'balance:published',
        '24h:0x1111',
        'curve:0x1111',
      ],
    });
  });
});
