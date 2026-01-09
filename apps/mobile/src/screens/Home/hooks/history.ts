import { debounce } from 'lodash';

import { getTop10MyAccounts } from '@/core/apis/account';
import { transactionHistoryService } from '@/core/services';
import { makeAvoidParallelAsyncFunc } from '@/core/utils/concurrency';
import { HistoryItemEntity } from '@/databases/entities/historyItem';
import { onAppOrmSyncEvents } from '@/databases/sync/_event';
import { zCreate } from '@/core/utils/reexports';
import {
  resolveValFromUpdater,
  runIIFEFunc,
  UpdaterOrPartials,
} from '@/core/utils/store';
import { RefLikeObject } from '@/utils/type';
import { getBalanceCacheAccounts } from '@/hooks/useAccountsBalance';

type HomeHistoryState = {
  pendingTxCount: number;
  historyCount: {
    success: number;
    fail: number;
  };
};

const homeHistoryStore = zCreate<HomeHistoryState>(() => ({
  pendingTxCount: 0,
  historyCount: {
    success: 0,
    fail: 0,
  },
}));

export function useHomeHistoryStore() {
  return {
    pendingTxCount: homeHistoryStore(s => s.pendingTxCount),
    historyCount: homeHistoryStore(s => s.historyCount),
  };
}

function setHistoryCount(
  valOrFunc: UpdaterOrPartials<HomeHistoryState['historyCount']>,
) {
  homeHistoryStore.setState(prev => {
    const { newVal, changed } = resolveValFromUpdater(
      prev.historyCount,
      valOrFunc,
      { strict: true },
    );

    if (!changed) return prev;

    return { ...prev, historyCount: newVal };
  });
}

export const refreshSuccessAndFailList = makeAvoidParallelAsyncFunc(
  async () => {
    const { top10Addresses } = await getTop10MyAccounts();
    if (!top10Addresses.length) return;
    const timestamp = transactionHistoryService.getClearSuccessAndFailListTs();
    const list = await HistoryItemEntity.getUnreadHistoryCount(
      top10Addresses,
      timestamp / 1000,
    );
    list.forEach(i => {
      const status = i.status ?? 1;
      const id = `${i.owner_addr.toLowerCase()}-${i.txHash}`;
      if (status === 1) {
        transactionHistoryService.setSucceedList(id);
      } else {
        transactionHistoryService.setFailedList(id);
      }
    });

    const count = transactionHistoryService.getFailedCount();
    const success = transactionHistoryService.getSucceedCount();

    setHistoryCount({ success, fail: count });

    return {
      success: success,
      fail: count,
    };
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

  const balanceAccounts = getBalanceCacheAccounts();
  const addresses = Object.keys(balanceAccounts);
  if (!addresses.length) {
    return;
  }
  const { pendingsLength } =
    transactionHistoryService.getPendingsAddresses(addresses);
  setPendingTxCount(pendingsLength);
  timeRef.current = pendingsLength
    ? setInterval(resetFetchHistoryTxCount, 5000)
    : null;
});

const thorttleGetSuccessAndFailList = debounce(refreshSuccessAndFailList, 1000);

runIIFEFunc(() => {
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
});
