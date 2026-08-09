import addressBalanceStore, { balanceAccountsStore } from './balance';
import { scene24hBalanceStore } from './balance24h';
import { refreshDayCurve } from './curve24h';
import { createHomeBalanceRefreshAfterAccountMutation } from './homeBalanceRefreshCoordinator';

export const refreshHomeBalanceAfterAccountMutation =
  createHomeBalanceRefreshAfterAccountMutation({
    fetchCurrentBalance: () =>
      addressBalanceStore.fetchTotalBalance('from_api'),
    getSelectedAddresses: () =>
      balanceAccountsStore.getState().selectedAddresses,
    refresh24hAssets: input => scene24hBalanceStore.refresh24hAssets(input),
    refreshDayCurve,
  });
