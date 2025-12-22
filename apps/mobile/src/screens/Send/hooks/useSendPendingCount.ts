import { apisTransactionHistory } from '@/core/apis/transactionHistory';
import { transactionHistoryService } from '@/core/services';
import { useMyAccounts } from '@/hooks/account';
import { useSceneAccountInfo } from '@/hooks/accountsSwitcher';
import { eventBus, EVENTS } from '@/utils/events';
import { useFocusEffect } from '@react-navigation/native';
import { useRequest } from 'ahooks';
import { unionBy } from 'lodash';
import { useCallback, useMemo, useState } from 'react';
import { zCreate } from '@/core/utils/reexports';
import { UpdaterOrPartials, resolveValFromUpdater } from '@/core/utils/store';

const sendPendingCountStore = zCreate<{
  pendingCount: number;
  successTxList: string[];
  failTxList: string[];
}>()(() => ({
  pendingCount: 0,
  successTxList: [],
  failTxList: [],
}));

function setPendingCount(valOrFunc: UpdaterOrPartials<number>) {
  sendPendingCountStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev.pendingCount, valOrFunc);
    return { ...prev, pendingCount: newVal };
  });
}

function setSuccessTxList(valOrFunc: UpdaterOrPartials<string[]>) {
  sendPendingCountStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev.successTxList, valOrFunc);
    return { ...prev, successTxList: newVal };
  });
}

function setFailTxList(valOrFunc: UpdaterOrPartials<string[]>) {
  sendPendingCountStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev.failTxList, valOrFunc);
    return { ...prev, failTxList: newVal };
  });
}

export const useReadSendPendingCount = () => {
  const { pendingCount } = sendPendingCountStore();
  return pendingCount;
};

export const useReadSendSuccessTxList = () => {
  const { successTxList } = sendPendingCountStore();
  return successTxList;
};

export const useReadSendFailTxList = () => {
  const { failTxList } = sendPendingCountStore();
  return failTxList;
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

  const res = useRequest(fetchPendingCount, {
    onSuccess(v) {
      setPendingCount(v);
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
