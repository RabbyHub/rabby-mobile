import { transactionHistoryService } from '@/core/services';
import { useMyAccounts } from '@/hooks/account';
import { useSceneAccountInfo } from '@/hooks/accountsSwitcher';
import {
  TransactionGroup,
  SendTxHistoryItem,
} from '@/core/services/transactionHistory';
import { fetchRefreshLocalData } from '@/screens/Swap/hooks';
import { HistoryDisplayItem } from '@/screens/Transaction/MultiAddressHistory';
import { findChain } from '@/utils/chain';
import { SendRequireData } from '@rabby-wallet/rabby-action';
import { useInterval, useMemoizedFn, useRequest } from 'ahooks';
import dayjs from 'dayjs';
import { atom, useAtom } from 'jotai';
import { sortBy, unionBy } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { TxDisplayItem } from '@rabby-wallet/rabby-api/dist/types';
import { Hex, isValidHexAddress } from '@metamask/utils';

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
          : 'isPending' in item && item.isPending
          ? Date.now()
          : 0),
    };

    const prev = arr[i - 1];

    if (i === 0) {
      newItem.isDateStart = true;
    } else {
      const curDate = dayjs(newItem.time);
      const prevTime =
        ('time_at' in prev ? prev.time_at * 1000 : undefined) ||
        ('completedAt' in prev && prev.completedAt
          ? prev.completedAt
          : 'isPending' in prev && prev.isPending
          ? Date.now()
          : 0);
      const prevDate = dayjs(prevTime);
      if (newItem.time && !curDate.isSame(prevDate, 'day')) {
        newItem.isDateStart = true;
      }
    }

    newArr.push(newItem);
  }

  return newArr;
}

/**
 * @description fetch local sending/sent tx
 * @param address
 */
const fetchLocalSendTx = (address: string) => {
  const { completeds: _completeds, pendings: _pendings } =
    transactionHistoryService.getList(address);

  return [..._pendings, ..._completeds].filter(item => {
    const chain = findChain({ id: item.chainId });
    return (
      !chain?.isTestnet &&
      !item.maxGasTx.action?.actionData.cancelTx &&
      item.$ctx?.ga?.source === 'sendToken'
    );
  });
};

export type RecentHistoryItem = {
  toAddress: string;
  /**
   * @description unix timestamp in seconds
   */
  time: number;
  isFailed: boolean;
  isPending: boolean;
};
export const useRecentSend = ({
  useAllHistory,
}: {
  useAllHistory?: boolean;
} = {}) => {
  const { accounts } = useMyAccounts({
    disableAutoFetch: true,
  });
  const unionAccounts = useMemo(() => {
    return unionBy(accounts, account => account.address.toLowerCase());
  }, [accounts]);

  const { data: historyList, runAsync } = useRequest(async () => {
    return batchFetchLocalTx();
  });

  const { finalSceneCurrentAccount: currentAccount } = useSceneAccountInfo({
    forScene: 'MakeTransactionAbout',
  });

  const batchFetchLocalTx = async () => {
    const list: TransactionGroup[] = [];
    const accountList = useAllHistory ? unionAccounts : [currentAccount];
    for (let i = 0; i < accountList.length; i++) {
      const account = accountList[i];
      if (!account) {
        continue;
      }
      const addr = account.address.toLowerCase();
      const localTxs = fetchLocalSendTx(addr);
      list.push(...localTxs);
    }
    return list;
  };

  const markedList = useMemo(() => {
    const sortedList = historyList?.sort(
      (a, b) =>
        (b.isPending ? Date.now() : b?.completedAt || 0) -
        (a.isPending ? Date.now() : a?.completedAt || 0),
    );

    return markFirstItems(
      unionBy(sortedList, item => {
        if ('projectDict' in item) {
          return `${item.address.toLowerCase()}-${
            (item as unknown as TxDisplayItem).id
          }`;
        } else {
          return `${item.address.toLowerCase()}-${item.maxGasTx.hash}`;
        }
      }) || [],
    );
  }, [historyList]);

  const { recentHistory, unionedRecentHistory } = useMemo(() => {
    const recentList = markedList
      .sort((a, b) => b.time - a.time)
      .filter(item => item.time > Date.now() - 60 * 60 * 1000) // in 1 hours
      .map(item => {
        if ('project_item' in item.data) {
          return {
            toAddress: item.data.sends[0].to_addr,
            time: item.time / 1000,
            isFailed: item.data.tx?.status !== 1,
            isPending: false,
          };
        } else {
          return {
            toAddress:
              item.data.maxGasTx.action?.actionData.send?.to ||
              (item.data.maxGasTx.action?.requiredData as SendRequireData)
                ?.protocol?.name ||
              '',
            time: item.time / 1000,
            isFailed:
              item.data.isSubmitFailed ||
              item.data.isFailed ||
              item.data.isWithdrawed,
            isPending: item.data.isPending,
          };
        }
      })
      .filter(
        item =>
          item.toAddress.length &&
          item.time &&
          !item.isFailed &&
          !item.isPending,
      );

    const unionedRecentHistory = unionBy(
      recentList,
      item => `${item.toAddress.toLowerCase()}`,
    ).slice(0, 3);

    return {
      recentHistory: recentList,
      unionedRecentHistory: unionedRecentHistory,
    };
  }, [markedList]);

  return {
    markedList,
    unionedRecentHistory,
    runAsync,
    recentHistory,
  };
};

export const fetchLocalSendPendingTx = (address: string) => {
  // const { completeds: _completeds, pendings: _pendings } =
  //   transactionHistoryService.getList(address);

  // const txs = [..._pendings, ..._completeds].filter(item => {
  //   const chain = findChain({ id: item.chainId });
  //   return (
  //     !chain?.isTestnet &&
  //     item.isPending &&
  //     !item.maxGasTx.action?.actionData.cancelTx &&
  //     item.$ctx?.ga?.source === 'sendToken'
  //   );
  // });

  // return txs.sort((a, b) => b.createdAt - a.createdAt)[0];
  return transactionHistoryService.getRecentPendingTxHistory(address, 'send');
};

const localPendingTxDataAtom = atom<SendTxHistoryItem | null>(null);

export const useRecentSendPendingTx = (isForMultipleAddress: boolean) => {
  const [localPendingTxData, setLocalPendingTxData] = useAtom(
    localPendingTxDataAtom,
  );
  const { finalSceneCurrentAccount: currentAccount } = useSceneAccountInfo({
    forScene: 'MakeTransactionAbout',
  });

  const clearLocalPendingTxData = useCallback(() => {
    setLocalPendingTxData(null);
  }, [setLocalPendingTxData]);

  const runFetchLocalPendingTx = useCallback(() => {
    if (currentAccount?.address) {
      const resTx = fetchLocalSendPendingTx(
        currentAccount.address,
      ) as SendTxHistoryItem;
      setLocalPendingTxData(resTx);
    }
  }, [currentAccount?.address, setLocalPendingTxData]);

  useEffect(() => {
    runFetchLocalPendingTx();
  }, [runFetchLocalPendingTx]);

  useInterval(() => {
    if (localPendingTxData) {
      const refreshTx = fetchRefreshLocalData(
        localPendingTxData,
        'send',
      ) as SendTxHistoryItem;
      if (refreshTx) {
        setLocalPendingTxData(refreshTx);
      }
    }
  }, 1000);

  return {
    localPendingTxData,
    clearLocalPendingTxData,
    runFetchLocalPendingTx,
  };
};

export function useRecentSendToHistoryFor(toAddress?: string) {
  const { recentHistory, runAsync } = useRecentSend({ useAllHistory: true });

  return {
    recentHistory:
      toAddress && isValidHexAddress(toAddress as Hex)
        ? recentHistory.filter(
            item => item.toAddress.toLowerCase() === toAddress.toLowerCase(),
          )
        : [],
    reFetch: runAsync,
  };
}
