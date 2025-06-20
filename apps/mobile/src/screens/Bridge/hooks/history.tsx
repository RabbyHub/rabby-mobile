import { useInfiniteScroll, useMemoizedFn, useRequest } from 'ahooks';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { uniqBy } from 'lodash';
import { openapi } from '@/core/request';
import useAsync from 'react-use/lib/useAsync';
import { atom, useAtom, useAtomValue } from 'jotai';
import { TransactionGroup } from '@/core/services/transactionHistory';
import { bridgeService, transactionHistoryService } from '@/core/services';
import { findChain } from '@/utils/chain';
import { BridgeHistory } from '@rabby-wallet/rabby-api/dist/types';
import { useSceneAccountInfo } from '@/hooks/accountsSwitcher';

const pendingCountAtom = atom(0);
const bridgeLocalTxDataAtom = atom<TransactionGroup | null>(null);
const bridgeTxDataPendingAtom = atom<BridgeHistory | null>(null);
export const bridgeHistoryRedDotAtom = atom(false);

export const useReadBridgePendingCount = () => {
  return useAtomValue(pendingCountAtom);
};

export const useReadBridgeHistoryRedDot = () => {
  return useAtomValue(bridgeHistoryRedDotAtom);
};

export const fetchLocalBridgePendingTx = (address: string) => {
  const { completeds: _completeds, pendings: _pendings } =
    transactionHistoryService.getList(address);

  const txs = [..._pendings, ..._completeds].filter(item => {
    const chain = findChain({ id: item.chainId });
    return (
      !chain?.isTestnet &&
      item.isPending &&
      !item.maxGasTx.action?.actionData.cancelTx &&
      (item.$ctx?.ga?.source === 'bridge' ||
        item.$ctx?.ga?.source === 'approvalAndBridge|bridge')
    );
  });

  return txs.sort((a, b) => b.createdAt - a.createdAt)[0];
};

export const usePollBridgePendingNumber = (timer = 10000) => {
  const [, setCount] = useAtom(pendingCountAtom);
  const [pendingTxData, setPendingTxData] = useAtom(bridgeTxDataPendingAtom);
  // const [localPendingTxData, setLocalPendingTxData] = useAtom(
  //   bridgeLocalTxDataAtom,
  // );

  const [, setBridgeHistoryRedDot] = useAtom(bridgeHistoryRedDotAtom);

  const { finalSceneCurrentAccount: account } = useSceneAccountInfo({
    forScene: 'MakeTransactionAbout',
  });

  const timerRef = useRef<NodeJS.Timeout>();
  const clearTimer = useMemoizedFn(() => {
    timerRef.current && clearTimeout(timerRef.current);
  });

  useEffect(() => {
    if (account?.address) {
      setPendingTxData(null);
      clearTimer();
    }
  }, [account?.address, clearTimer, setPendingTxData]);

  const res = useRequest(
    async () => {
      if (!account?.address) {
        return 0;
      }

      const data = await openapi.getBridgeHistoryList({
        user_addr: account!.address,
        start: 0,
        limit: 10,
      });

      const openModalTs = bridgeService.getOpenBridgeHistoryTs(account.address);
      const ts = data?.history_list
        ?.filter(item => item?.status !== 'pending')
        .sort((a, b) => b.create_at - a.create_at);
      if (openModalTs) {
        setBridgeHistoryRedDot(ts?.[0]?.create_at > openModalTs / 1000);
      } else {
        bridgeService.setOpenBridgeHistoryTs(account.address);
      }

      // const pendingTx = data?.history_list
      //   ?.filter(item => item?.status === 'pending')
      //   .sort((a, b) => b.create_at - a.create_at);

      updatePendingTxData(data.history_list);

      return (
        data?.history_list?.filter(item => item?.status === 'pending')
          ?.length || 0
      );
    },
    {
      refreshDeps: [account?.address],
      onSuccess(v) {
        setCount(v);
      },
    },
  );

  // const runFetchLocalPendingTx = useCallback(() => {
  //   if (account?.address) {
  //     const resTx = fetchLocalBridgePendingTx(account.address);
  //     setLocalPendingTxData(resTx);
  //   }
  // }, [account?.address, setLocalPendingTxData]);

  // useEffect(() => {
  //   runFetchLocalPendingTx();
  // }, [runFetchLocalPendingTx]);

  const updatePendingTxData = useCallback(
    (historyList: BridgeHistory[]) => {
      const recentlyData = historyList.sort(
        (a, b) => b.create_at - a.create_at,
      )[0];
      const isPending = recentlyData?.status === 'pending';
      if (isPending) {
        setPendingTxData(recentlyData);
      } else {
        // update pending tx data to completed data
        if (pendingTxData?.detail_url === recentlyData?.detail_url) {
          setPendingTxData(recentlyData);
          setBridgeHistoryRedDot(true);
        }
      }
    },
    [setPendingTxData, pendingTxData, setBridgeHistoryRedDot],
  );

  const { loading, error, data: value, runAsync } = res;

  useEffect(() => {
    if ((!loading && value !== undefined) || error) {
      clearTimer();
      timerRef.current = setTimeout(() => {
        runAsync();
      }, timer);
    }

    return clearTimer;
  }, [loading, value, error, timer, runAsync, clearTimer]);

  useEffect(() => {
    return clearTimer;
  }, [clearTimer]);

  const clearLocalPendingTxData = () => {
    // setLocalPendingTxData(null);
    setPendingTxData(null);
  };

  const clearBridgeHistoryRedDot = useCallback(() => {
    setBridgeHistoryRedDot(false);
    const currentTs = bridgeService.getOpenBridgeHistoryTs(account?.address!);
    bridgeService.setOpenBridgeHistoryTs(account?.address!);
    return currentTs;
  }, [setBridgeHistoryRedDot, account?.address]);

  // useInterval(() => {
  //   if (localPendingTxData) {
  //     const refreshTx = fetchRefreshLocalData(localPendingTxData);
  //     if (refreshTx) {
  //       if (refreshTx.maxGasTx.action?.actionData?.cancelTx) {
  //         setLocalPendingTxData(null);
  //       } else {
  //         setLocalPendingTxData(refreshTx);
  //         setBridgeHistoryRedDot(true);
  //       }
  //     }
  //   }
  // }, 1000);

  return {
    runAsync,
    // localPendingTxData,
    pendingTxData,
    clearLocalPendingTxData,
    // runFetchLocalPendingTx,
    setBridgeHistoryRedDot,
    clearBridgeHistoryRedDot,
  };
};

export const useBridgeHistory = () => {
  const { finalSceneCurrentAccount: currentAccount } = useSceneAccountInfo({
    forScene: 'MakeTransactionAbout',
  });

  const addr = currentAccount?.address || '';

  const [refreshTxListCount, setRefreshListTx] = useState(0);
  const refreshBridgeListTx = React.useCallback(() => {
    setRefreshListTx(e => e + 1);
  }, []);
  const isInBridge = true;

  const getBridgeHistoryList = React.useCallback(
    async (addr: string, start = 0, limit = 5) => {
      const data = await openapi.getBridgeHistoryList({
        user_addr: addr,
        start: start,
        limit: limit,
      });
      return {
        list: data?.history_list,
        last: data,
        totalCount: data?.total_cnt,
      };
    },
    [],
  );

  const {
    data: txList,
    loading,
    loadMore,
    loadingMore,
    noMore,
    mutate,
  } = useInfiniteScroll(
    d =>
      getBridgeHistoryList(
        addr,
        d?.list?.length && d?.list?.length > 1 ? d?.list?.length : 0,
        20,
      ),
    {
      reloadDeps: [isInBridge],
      isNoMore(data) {
        if (data) {
          return data?.list.length >= data?.totalCount;
        }
        return true;
      },
      manual: !isInBridge || !addr,
    },
  );

  const { value } = useAsync(async () => {
    if (addr) {
      return getBridgeHistoryList(addr, 0, 20);
    }
  }, [addr, refreshTxListCount]);

  useEffect(() => {
    if (value?.list) {
      mutate(d => {
        if (!d) {
          return;
        }
        return {
          last: d?.last,
          totalCount: d?.totalCount,
          list: uniqBy(
            [...(value.list || []), ...(d?.list || [])],
            e => `${e.chain}-${e.detail_url}`,
          ),
        };
      });
    }
  }, [mutate, value]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (
      !loading &&
      !loadingMore &&
      txList?.list?.some(e => e.status !== 'completed') &&
      isInBridge
    ) {
      timer = setTimeout(refreshBridgeListTx, 2000);
    }
    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [loading, loadingMore, refreshBridgeListTx, txList?.list, isInBridge]);

  return {
    loading,
    txList,
    loadingMore,
    loadMore,
    noMore,
  };
};
