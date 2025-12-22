import { openapi } from '@/core/request';
import { SwapItem } from '@rabby-wallet/rabby-api/dist/types';
import useInfiniteScroll from 'ahooks/lib/useInfiniteScroll';
import { uniqBy } from 'lodash';
import { useCallback, useEffect, useRef, useState } from 'react';
import useAsync from 'react-use/lib/useAsync';
import { swapRefresh, useRefreshId } from './atom';
import { useInterval, useMount, useRequest } from 'ahooks';
import { swapService, transactionHistoryService } from '@/core/services';
import { useSceneAccountInfo } from '@/hooks/accountsSwitcher';
import {
  SwapTxHistoryItem,
  SendTxHistoryItem,
} from '@/core/services/transactionHistory';
import { zCreate } from '@/core/utils/reexports';
import { UpdaterOrPartials, resolveValFromUpdater } from '@/core/utils/store';

const swapTxHistoryVisibleStore = zCreate<boolean>(() => false);
function setSwapTxHistoryVisible(valOrFunc: UpdaterOrPartials<boolean>) {
  swapTxHistoryVisibleStore.setState(prev => {
    const { newVal, changed } = resolveValFromUpdater(prev, valOrFunc, {
      strict: false,
    });

    if (!changed) return prev;

    return newVal;
  });
}

export const useSwapTxHistoryVisible = () => {
  const visible = swapTxHistoryVisibleStore();
  return {
    visible,
    setVisible: setSwapTxHistoryVisible,
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

  const refreshSwapTxListCount = useRefreshId();
  const refreshSwapListTx = swapRefresh;

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

const swapHistoryState = zCreate<{
  swapPendingCount: number;
  swapPendingTxData: SwapItem | null;
  swapHistoryRedDot: boolean;
}>(() => ({
  swapPendingCount: 0,
  swapPendingTxData: null,
  swapHistoryRedDot: false,
}));

export const setSwapPendingCount = (valOrFunc: UpdaterOrPartials<number>) => {
  swapHistoryState.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev.swapPendingCount, valOrFunc, {
      strict: false,
    });

    return {
      ...prev,
      swapPendingCount: newVal,
    };
  });
};
export const useReadPendingCount = () => {
  return swapHistoryState(state => state.swapPendingCount);
};
function setSwapHistoryRedDot(valOrFunc: UpdaterOrPartials<boolean>) {
  swapHistoryState.setState(prev => {
    const { newVal } = resolveValFromUpdater(
      prev.swapHistoryRedDot,
      valOrFunc,
      {
        strict: false,
      },
    );

    return {
      ...prev,
      swapHistoryRedDot: newVal,
    };
  });
}

function setSwapPendingTxData(valOrFunc: UpdaterOrPartials<SwapItem | null>) {
  swapHistoryState.setState(prev => {
    const { newVal } = resolveValFromUpdater(
      prev.swapPendingTxData,
      valOrFunc,
      {
        strict: false,
      },
    );

    return {
      ...prev,
      swapPendingTxData: newVal,
    };
  });
}

export const useReadSwapHistoryRedDot = () => {
  return swapHistoryState(state => state.swapHistoryRedDot);
};

export const fetchLocalSwapPendingTx = (address: string) => {
  return transactionHistoryService.getRecentPendingTxHistory(
    address,
    'swap',
  ) as SwapTxHistoryItem;
};

export const fetchRefreshLocalData = (
  data: SwapTxHistoryItem | SendTxHistoryItem,
  type: 'swap' | 'send',
) => {
  if (data.status !== 'pending') {
    // has done
    return;
  }

  const address = data.address;
  const chainId = data.chainId;
  const hash = data.hash;
  const newData = transactionHistoryService.getRecentTxHistory(
    address,
    hash,
    chainId,
    type,
  );

  if (newData?.status !== 'pending') {
    return newData;
  }
};

export const usePollSwapPendingNumber = (timer = 10000) => {
  const [localPendingTxData, setLocalPendingTxData] = useState<
    SwapTxHistoryItem | SendTxHistoryItem | null
  >(null);

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
      setSwapPendingTxData(txData?.[0] || null);

      return txData?.[0] || null;
    },
    {
      onSuccess(v) {
        setSwapPendingTxData(v);
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
      const refreshTx = fetchRefreshLocalData(
        localPendingTxData,
        'swap',
      ) as SwapTxHistoryItem;
      if (refreshTx) {
        // if (refreshTx.maxGasTx.action?.actionData?.cancelTx) {
        //   setLocalPendingTxData(null);
        // } else {
        setLocalPendingTxData(refreshTx);
        setSwapHistoryRedDot(true);
        // }
      }
    }
  }, 1000);

  const clearLocalPendingTxData = () => {
    setLocalPendingTxData(null);
  };

  useEffect(() => {
    if ((!loading && value !== undefined) || error) {
      timerRef.current && clearTimeout(timerRef.current);
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
  }, [currentAccount?.address]);

  useEffect(() => {
    timerRef.current && clearTimeout(timerRef.current);
  }, [currentAccount?.address]);

  return {
    runAsync,
    localPendingTxData,
    clearLocalPendingTxData,
    runFetchLocalPendingTx,
    setSwapHistoryRedDot,
    clearSwapHistoryRedDot,
  };
};
