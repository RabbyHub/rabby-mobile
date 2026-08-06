import { makeAvoidParallelAsyncFunc } from '@/core/utils/concurrency';
import addressBalanceStore, { balanceAccountsStore } from './balance';
import { scene24hBalanceStore } from './balance24h';
import { refreshDayCurve } from './curve24h';

const refreshHomeBalanceAfterAccountMutationImpl = async () => {
  await addressBalanceStore.fetchTotalBalance('from_api');

  const addresses = balanceAccountsStore.getState().selectedAddresses;
  await Promise.all([
    scene24hBalanceStore.refresh24hAssets({
      addresses,
      force: true,
      reason: 'manual_refresh',
    }),
    refreshDayCurve({
      addresses,
      force: true,
      reason: 'manual_refresh',
    }),
  ]);
};

export const refreshHomeBalanceAfterAccountMutation =
  makeAvoidParallelAsyncFunc(refreshHomeBalanceAfterAccountMutationImpl);
