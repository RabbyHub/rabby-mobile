import { apisTransactionHistory } from '@/core/apis/transactionHistory';
import { transactionHistoryService } from '@/core/services';
import { useMyAccounts } from '@/hooks/account';
import { useSceneAccountInfo } from '@/hooks/accountsSwitcher';
import { eventBus, EVENTS } from '@/utils/events';
import { useFocusEffect } from '@react-navigation/native';
import { useRequest } from 'ahooks';
import { atom, useAtom, useAtomValue } from 'jotai';
import { unionBy } from 'lodash';
import { useCallback, useMemo, useState } from 'react';

const pendingCountAtom = atom(0);
const successTxListAtom = atom<string[]>([]);
const failTxListAtom = atom<string[]>([]);

export const useReadSendPendingCount = () => {
  return useAtomValue(pendingCountAtom);
};

export const useReadSendSuccessTxList = () => {
  return useAtomValue(successTxListAtom);
};

export const useReadSendFailTxList = () => {
  return useAtomValue(failTxListAtom);
};

export const usePollSendPendingCount = (params?: {
  isForMultipleAddress?: boolean;
  pollingInterval?: number;
}) => {
  const { isForMultipleAddress = false, pollingInterval = 10000 } =
    params || {};

  const { accounts } = useMyAccounts({
    disableAutoFetch: true,
  });
  const unionAccounts = useMemo(() => {
    return unionBy(accounts, account => account.address.toLowerCase());
  }, [accounts]);

  const { finalSceneCurrentAccount: currentAccount } = useSceneAccountInfo({
    forScene: 'MakeTransactionAbout',
  });

  const fetchPendingCount = async () => {
    let total = 0;
    const accountList = isForMultipleAddress ? unionAccounts : [currentAccount];
    for (let i = 0; i < accountList.length; i++) {
      const account = accountList[i];
      if (!account) {
        continue;
      }
      const addr = account.address.toLowerCase();
      const data = await apisTransactionHistory.getRabbySendPendingTxs({
        address: addr,
      });

      total += data.length || 0;
    }
    return total;
  };
  const [, setCount] = useAtom(pendingCountAtom);

  const res = useRequest(fetchPendingCount, {
    onSuccess(v) {
      setCount(v);
    },
    refreshDeps: [isForMultipleAddress, currentAccount?.address],
  });

  const { runAsync } = res;

  useFocusEffect(
    useCallback(() => {
      const refresh = () => {
        runAsync();
      };
      refresh();
      eventBus.addListener(EVENTS.RELOAD_TX, refresh);
      return () => {
        eventBus.removeListener(EVENTS.RELOAD_TX, refresh);
      };
    }, [runAsync]),
  );

  return res;
};
