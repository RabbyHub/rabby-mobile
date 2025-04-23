import { transactionHistoryService } from '@/core/services';
import { TransactionGroup } from '@/core/services/transactionHistory';
import { useMyAccounts } from '@/hooks/account';
import { HistoryDisplayItem } from '@/screens/Transaction/MultiAddressHistory';
import { findChain } from '@/utils/chain';
import { SendRequireData } from '@rabby-wallet/rabby-action';
import { useMemoizedFn, useRequest } from 'ahooks';
import dayjs from 'dayjs';
import { unionBy } from 'lodash';
import { useMemo } from 'react';

interface DisplayHistoryItem {
  isDateStart?: boolean;
  time: number;
  data: HistoryDisplayItem | TransactionGroup;
}
function markFirstItems(
  arr: (HistoryDisplayItem | TransactionGroup)[],
): DisplayHistoryItem[] {
  if (arr.length === 0) {
    return [];
  }
  const newArr: DisplayHistoryItem[] = [];
  for (let i = 0; i < arr.length; i++) {
    const item = arr[i];
    const newItem: DisplayHistoryItem = {
      data: item,
      time:
        ('time_at' in item ? item.time_at * 1000 : undefined) ||
        ('completedAt' in item && item.completedAt
          ? item.completedAt
          : new Date().getTime()),
    };

    const prev = arr[i - 1];

    if (i === 0) {
      newItem.isDateStart = true;
    } else {
      // judgs is date start
      const curDate = dayjs(newItem.time);
      const prevTime =
        ('time_at' in prev ? prev.time_at * 1000 : undefined) ||
        ('completedAt' in prev && prev.completedAt
          ? prev.completedAt
          : new Date().getTime());
      const prevDate = dayjs(prevTime); // get time at
      if (!curDate.isSame(prevDate, 'date')) {
        newItem.isDateStart = true;
      }
    }

    newArr.push(newItem);
  }

  return newArr;
}

export const useRecentSend = () => {
  const { accounts } = useMyAccounts({
    disableAutoFetch: true,
  });
  const unionAccounts = useMemo(() => {
    return unionBy(accounts, account => account.address.toLowerCase());
  }, [accounts]);

  const { data: historyList, runAsync } = useRequest(async () => {
    return batchFetchLocalTx();
  });

  const batchFetchLocalTx = async () => {
    const list: TransactionGroup[] = [];
    const accountList = unionAccounts;
    for (let i = 0; i < accountList.length; i++) {
      const account = accountList[i];
      if (!account) {
        continue;
      }
      const addr = account.address.toLowerCase();
      const localTxs = fetchLocalTx(addr);
      list.push(...localTxs);
    }
    return list;
  };

  const fetchLocalTx = useMemoizedFn((address: string) => {
    const { completeds: _completeds } =
      transactionHistoryService.getList(address);

    const completeds = _completeds.filter(item => {
      const chain = findChain({ id: item.chainId });
      return (
        !chain?.isTestnet &&
        !item.isSubmitFailed &&
        item.$ctx?.ga?.source === 'sendToken'
      );
    });

    return completeds;
  });

  const markedList = useMemo(() => {
    return markFirstItems(
      unionBy(historyList, item => {
        if ('projectDict' in item) {
          return `${item.address.toLowerCase()}-${item.id}`;
        } else {
          return `${item.address.toLowerCase()}-${item.maxGasTx.hash}`;
        }
      }) || [],
    );
  }, [historyList]);

  // TODO: limit to 24 hours
  const recentHistory = useMemo(() => {
    return markedList
      .sort((a, b) => b.time - a.time)
      .map(item => {
        if ('projectDict' in item.data) {
          return {
            toAddress: item.data.sends[0].to_addr,
            time: item.time / 1000,
          };
        } else {
          return {
            toAddress:
              item.data.maxGasTx.action?.actionData.send?.to ||
              (item.data.maxGasTx.action?.requiredData as SendRequireData)
                ?.protocol?.name ||
              '',
            time: item.time / 1000,
          };
        }
      })
      .filter(item => item.toAddress.length && item.time)
      .slice(0, 3);
  }, [markedList]);

  return {
    markedList,
    runAsync,
    recentHistory,
  };
};
