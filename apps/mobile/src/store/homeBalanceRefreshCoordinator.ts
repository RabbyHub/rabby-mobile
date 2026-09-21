import { makeAvoidParallelAsyncFunc } from '@/core/utils/concurrency';

export type HomeBalanceRefreshInput = {
  addresses: string[];
  force: true;
  reason: 'manual_refresh';
};

export type HomeBalanceRefreshDependencies = {
  fetchCurrentBalance: () => Promise<unknown>;
  getSelectedAddresses: () => readonly string[];
  refresh24hAssets: (input: HomeBalanceRefreshInput) => Promise<unknown>;
  refreshDayCurve: (input: HomeBalanceRefreshInput) => Promise<unknown>;
};

export function createHomeBalanceRefreshAfterAccountMutation(
  dependencies: HomeBalanceRefreshDependencies,
) {
  return makeAvoidParallelAsyncFunc(async () => {
    await dependencies.fetchCurrentBalance();

    // Account removal may change the selection while current balance refreshes.
    // Resolve it after that refresh so every dependent dataset uses one epoch.
    const addresses = [...dependencies.getSelectedAddresses()];
    await Promise.all([
      dependencies.refresh24hAssets({
        addresses: [...addresses],
        force: true,
        reason: 'manual_refresh',
      }),
      dependencies.refreshDayCurve({
        addresses: [...addresses],
        force: true,
        reason: 'manual_refresh',
      }),
    ]);
  });
}
