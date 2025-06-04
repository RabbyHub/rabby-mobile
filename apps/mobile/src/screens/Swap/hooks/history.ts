import { openapi } from '@/core/request';
import { useCurrentAccount } from '@/hooks/account';
import { SwapItem } from '@rabby-wallet/rabby-api/dist/types';
import useInfiniteScroll from 'ahooks/lib/useInfiniteScroll';
import { atom, useAtom, useAtomValue, useSetAtom } from 'jotai';
import { uniqBy } from 'lodash';
import { useCallback, useEffect, useRef, useState } from 'react';
import useAsync from 'react-use/lib/useAsync';
import { refreshIdAtom } from './atom';
import { useInterval, useMount, useRequest } from 'ahooks';
import { swapService, transactionHistoryService } from '@/core/services';
import { findChain } from '@/utils/chain';
import { TransactionGroup } from '@/core/services/transactionHistory';
import { useSceneAccountInfo } from '@/hooks/accountsSwitcher';
const swapTxHistoryVisibleAtom = atom(false);

export const useSwapTxHistoryVisible = () => {
  const [visible, setVisible] = useAtom(swapTxHistoryVisibleAtom);
  return {
    visible,
    setVisible,
  };
};

const getSwapList = async (addr: string, start = 0, limit = 5) => {
  const data = await openapi.getSwapTradeList({
    user_addr: addr,
    start: `${start}`,
    limit: `${limit}`,
  });
  return {
    list: data?.history_list,
    last: data,
    totalCount: data?.total_cnt,
  };
};

export const useSwapHistory = () => {
  const { finalSceneCurrentAccount: currentAccount } = useSceneAccountInfo({
    forScene: 'MakeTransactionAbout',
  });
  const addr = currentAccount?.address || '';

  const refreshSwapTxListCount = useAtomValue(refreshIdAtom);
  const refreshSwapListTx = useSetAtom(refreshIdAtom);

  if (!addr) {
    throw new Error('no addr');
  }

  const {
    data: txList,
    loading,
    loadMore,
    loadingMore,
    noMore,
    mutate,
    reload,
  } = useInfiniteScroll(
    d =>
      getSwapList(
        addr,
        d?.list?.length && d?.list?.length > 1 ? d?.list?.length : 0,
        20,
      ),
    {
      isNoMore(data) {
        if (data) {
          return data?.list.length >= data?.totalCount;
        }
        return true;
      },
      manual: !addr,
    },
  );

  const { value } = useAsync(async () => {
    if (addr) {
      return getSwapList(addr, 0, 20);
    }
  }, [addr, refreshSwapTxListCount]);

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
            e => `${e.chain}-${e.tx_id}`,
          ) as SwapItem[],
        };
      });
    }
  }, [mutate, value]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (
      !loading &&
      !loadingMore &&
      txList?.list?.some(e => e.status !== 'Finished')
    ) {
      timer = setTimeout(refreshSwapListTx, 2000);
    }
    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [loading, loadingMore, txList?.list, refreshSwapListTx]);

  return {
    loading,
    txList,
    loadingMore,
    loadMore,
    noMore,
    reload,
  };
};

export const swapPendingCountAtom = atom(0);
export const swapPendingTxDataAtom = atom<SwapItem | null>(null);
export const swapLocalTxDataAtom = atom<TransactionGroup | null>(null);
export const swapHistoryRedDotAtom = atom(false);
export const useReadPendingCount = () => {
  return useAtomValue(swapPendingCountAtom);
};

export const fetchLocalSwapPendingTx = (address: string) => {
  const { completeds: _completeds, pendings: _pendings } =
    transactionHistoryService.getList(address);

  const txs = [..._pendings, ..._completeds].filter(item => {
    const chain = findChain({ id: item.chainId });
    return (
      !chain?.isTestnet &&
      item.isPending &&
      !item.maxGasTx.action?.actionData.cancelTx &&
      (item.$ctx?.ga?.source === 'swap' ||
        item.$ctx?.ga?.source === 'approvalAndSwap|swap')
    );
  });

  return txs.sort((a, b) => b.createdAt - a.createdAt)[0];
};

export const fetchRefreshLocalData = (data: TransactionGroup) => {
  if (!data.isPending) {
    // has done
    return;
  }

  const address = data.address;
  const chainId = data.chainId;
  const nonce = data.nonce;
  const groups = transactionHistoryService.getPendingTxsByNonce(
    address,
    chainId,
    nonce,
  );

  if (!groups?.[0].isPending) {
    return groups[0];
  }
};

export const usePendingTxData = () => {
  return useAtomValue(swapPendingCountAtom);
};

export const useReadSwapHistoryRedDot = () => {
  return useAtomValue(swapHistoryRedDotAtom);
};
export const usePollSwapPendingNumber = (timer = 10000) => {
  const [, setCount] = useAtom(swapPendingCountAtom);
  const [, setTxData] = useAtom(swapPendingTxDataAtom);
  const [localPendingTxData, setLocalPendingTxData] =
    useAtom(swapLocalTxDataAtom);
  const [, setSwapHistoryRedDot] = useAtom(swapHistoryRedDotAtom);
  const { finalSceneCurrentAccount: currentAccount } = useSceneAccountInfo({
    forScene: 'MakeTransactionAbout',
  });
  const res = useRequest(
    async () => {
      const account = currentAccount;
      if (!account?.address) {
        return null;
      }

      const data = await openapi.getSwapTradeList({
        user_addr: account!.address,
        start: '0',
        limit: '20',
      });

      const txData = data?.history_list
        ?.filter(item => item?.status === 'Pending')
        .sort((a, b) => b.create_at - a.create_at);

      const openModalTs = swapService.getOpenSwapHistoryTs(account.address);
      const ts = data?.history_list
        ?.filter(item => item?.status !== 'Pending')
        .sort((a, b) => b.finished_at - a.finished_at);
      if (openModalTs) {
        setSwapHistoryRedDot(ts?.[0]?.finished_at > openModalTs / 1000);
      } else {
        swapService.setOpenSwapHistoryTs(account.address);
      }
      // judge if the tx is in local storage todo
      setTxData(txData?.[0] || null);

      return txData?.[0] || null;
    },
    {
      onSuccess(v) {
        setTxData(v);
      },
      refreshDeps: [currentAccount],
    },
  );

  const timerRef = useRef<NodeJS.Timeout>();

  const { loading, error, data: value, runAsync } = res;

  const runFetchLocalPendingTx = useCallback(() => {
    if (currentAccount?.address) {
      const resTx = fetchLocalSwapPendingTx(currentAccount.address);
      setLocalPendingTxData(resTx);
    }
  }, [currentAccount?.address, setLocalPendingTxData]);

  useEffect(() => {
    runFetchLocalPendingTx();
  }, [runFetchLocalPendingTx]);

  useInterval(() => {
    if (localPendingTxData) {
      const refreshTx = fetchRefreshLocalData(localPendingTxData);
      if (refreshTx) {
        if (refreshTx.maxGasTx.action?.actionData?.cancelTx) {
          setLocalPendingTxData(null);
        } else {
          setLocalPendingTxData(refreshTx);
          setSwapHistoryRedDot(true);
        }
      }
    }
  }, 1000);

  const clearLocalPendingTxData = () => {
    setLocalPendingTxData(null);
  };

  useEffect(() => {
    if ((!loading && value !== undefined) || error) {
      timerRef.current = setTimeout(() => {
        runAsync();
      }, timer);
    }

    return () => {
      timerRef.current && clearTimeout(timerRef.current);
    };
  }, [loading, value, error, timer, runAsync]);

  useEffect(() => {
    return () => {
      timerRef.current && clearTimeout(timerRef.current);
    };
  }, []);

  const clearSwapHistoryRedDot = useCallback(() => {
    setSwapHistoryRedDot(false);
    const currentTs = swapService.getOpenSwapHistoryTs(
      currentAccount?.address!,
    );
    swapService.setOpenSwapHistoryTs(currentAccount?.address!);
    return currentTs;
  }, [setSwapHistoryRedDot, currentAccount?.address]);

  return {
    runAsync,
    localPendingTxData,
    clearLocalPendingTxData,
    runFetchLocalPendingTx,
    setSwapHistoryRedDot,
    clearSwapHistoryRedDot,
  };
};
