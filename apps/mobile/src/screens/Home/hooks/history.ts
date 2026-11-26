import { debounce } from 'lodash';

import { transactionHistoryServiceApi } from '@/core/serviceApi/transactionHistory';
import { makeAvoidParallelAsyncFunc } from '@/core/utils/concurrency';
import { HistoryItemEntity } from '@/databases/entities/historyItem';
import { onAppOrmSyncEvents } from '@/databases/sync/_event';
import { zCreate } from '@/core/utils/reexports';
import { runStartupTask } from '@/core/utils/startupScheduler';
import { STARTUP_TASKS } from '@/core/utils/startupTaskManifest';
import type { RefLikeObject } from '@/utils/type';
import {
  balanceAccountsStore,
  getSelectedBalanceAddressesSnapshot,
} from '@/store/balance';
import { useActivityStore } from '@/hooks/storeActivity/useActivityStore';

type HomeHistoryState = {
  pendingTxCount: number;
};

const homeHistoryStore = zCreate<HomeHistoryState>(() => ({
  pendingTxCount: 0,
}));

export function useHomePendingTxCount() {
  return useActivityStore(
    homeHistoryStore,
    state => state.pendingTxCount,
    Object.is,
    { storeLabel: 'home-history-badges' },
  );
}

export const refreshSuccessAndFailList = makeAvoidParallelAsyncFunc(
  async () => {
    const top10Addresses = getSelectedBalanceAddressesSnapshot();
    if (!top10Addresses.length) return;
    const timestamp =
      await transactionHistoryServiceApi.getClearSuccessAndFailListTs();
    const list = await HistoryItemEntity.getUnreadHistoryCount(
      top10Addresses,
      timestamp / 1000,
    );
    await Promise.all(
      list.map(i => {
        const status = i.status ?? 1;
        const id = `${i.owner_addr.toLowerCase()}-${i.txHash}`;
        if (status === 1) {
          return transactionHistoryServiceApi.setSucceedList(id);
        }
        return transactionHistoryServiceApi.setFailedList(id);
      }),
    );
  },
);

function setPendingTxCount(count: number) {
  homeHistoryStore.setState(prev => {
    if (prev.pendingTxCount === count) {
      return prev;
    }
    return { ...prev, pendingTxCount: count };
  });
}

const timeRef: RefLikeObject<ReturnType<typeof setInterval> | null> = {
  current: null,
};
export const resetFetchHistoryTxCount = makeAvoidParallelAsyncFunc(async () => {
  timeRef.current && clearInterval(timeRef.current);
  // TODO: 这里只需要 accounts，不需要 balance 相关信息
  const balanceAccounts = balanceAccountsStore.getState().balance;
  const addresses = Object.keys(balanceAccounts);
  if (!addresses.length) {
    return;
  }
  const { pendingsLength } =
    await transactionHistoryServiceApi.getPendingsAddresses(addresses);
  setPendingTxCount(pendingsLength);
  timeRef.current = pendingsLength
    ? setInterval(resetFetchHistoryTxCount, 5000)
    : null;
});

const thorttleGetSuccessAndFailList = debounce(refreshSuccessAndFailList, 1000);

runStartupTask(() => {
  onAppOrmSyncEvents({
    taskFor: ['all-history'],
    onRemoteDataUpserted: ctx => {
      switch (ctx.taskFor) {
        case 'all-history':
          thorttleGetSuccessAndFailList();
          break;
        default:
          break;
      }
    },
  });

  resetFetchHistoryTxCount();
}, STARTUP_TASKS.homeHistorySyncListener);
