import { openapi } from '@/core/request';
import { BuyItemEntity } from '@/databases/entities/buyItem';
import { HistoryItemEntity } from '@/databases/entities/historyItem';
import { useSyncHistoryDB } from '@/databases/hooks/history';
import { syncRemoteBuyHistory } from '@/databases/sync/assets';
import { useCurrentAccount } from '@/hooks/account';
import {
  BuyHistoryItem,
  BuyHistoryList,
} from '@rabby-wallet/rabby-api/dist/types';
import useInfiniteScroll from 'ahooks/lib/useInfiniteScroll';
import { uniqBy } from 'lodash';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { runOnJS } from 'react-native-reanimated';
import useAsync from 'react-use/lib/useAsync';
import useAsyncFn from 'react-use/lib/useAsyncFn';
import useDebounce from 'react-use/lib/useDebounce';

export const usePendingBuyItemData = (
  addr: string,
  id: string,
  status: BuyHistoryItem['status'],
) => {
  const [{ loading, value }, fetchHistory] = useAsyncFn(() => {
    return openapi.getBuyHistory({
      user_addr: addr,
      start: 0,
      limit: 20,
    });
  }, [addr]);

  const { syncSingleAddress } = useSyncHistoryDB();

  const isPending = status === 'pending';

  useDebounce(
    () => {
      const initFetch = !!addr && !!id && isPending && !loading && !value;
      const refetch =
        !!addr &&
        !!id &&
        !loading &&
        !!value &&
        value?.histories?.find(e => e.id === id)?.status === 'pending';
      if (initFetch || refetch) {
        fetchHistory();
      }
    },
    5000,
    [fetchHistory, id, isPending, loading, value, value?.histories],
  );

  useEffect(() => {
    if (
      isPending &&
      addr &&
      value?.histories?.find(e => e.id === id)?.status === 'success'
    ) {
      syncSingleAddress(addr);
    }
  }, [isPending, addr, id, value?.histories, syncSingleAddress]);

  useEffect(() => {
    if (addr && value?.histories.length) {
      syncBuyHistory(addr, value);
    }
  }, [addr, value]);

  const data = useMemo(() => {
    const target = value?.histories?.find(e => e.id === id);
    if (target && target.status !== 'pending') {
      return target;
    }
    return;
  }, [value, id]);

  return data;
};

const syncBuyHistory = async (addr: string, data: BuyHistoryList) => {
  const isExpiredTimeAgo = new Date().getTime() - 15 * 24 * 60 * 60 * 1000; // 15 days ago

  const latestTime = (await BuyItemEntity.getLatestTime(addr)) || 0;
  const pendingIdList = ((await BuyItemEntity.getAllPending(addr)) || [])
    .filter(i => i.create_at > isExpiredTimeAgo)
    .map(e => e.id);

  const added = data.histories.filter(
    i => pendingIdList.includes(i.id) || i.create_at > latestTime,
  );
  if (added?.length) {
    runOnJS(syncRemoteBuyHistory)(addr, added);
  }
};

const getList = async (addr: string, start = 0, limit = 20) => {
  const data = await openapi.getBuyHistory({
    user_addr: addr,
    start,
    limit,
  });

  if (data?.histories?.length) {
    try {
      syncBuyHistory(addr, data);
    } catch (error) {
      console.log('syncBuyHistory in BuyScreen error', error);
    }
  }

  return {
    list: data?.histories,
    last: data,
    totalCount: data?.pagination.total,
  };
};

export const useBuyHistory = () => {
  const { currentAccount } = useCurrentAccount();
  const addr = currentAccount?.address || '';

  const [refresh, setRefresh] = useState(0);
  const refreshListTx = useCallback(() => {
    setRefresh(e => e + 1);
  }, []);

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
      getList(
        addr,
        d?.list?.length && d?.list?.length > 1 ? d?.list?.length : 0,
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
      return getList(addr, 0);
    }
  }, [addr, refresh]);

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
            e => `${e.chain}-${e.tx_id}-${e.create_at}-${e.id}`,
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
      txList?.list?.some(e => e.status === 'pending')
    ) {
      timer = setTimeout(refreshListTx, 2000);
    }
    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [loading, loadingMore, txList?.list, refreshListTx]);

  return {
    loading,
    txList,
    loadingMore,
    loadMore,
    noMore,
    reload,
  };
};

export const usePollBuyPendingNumber = (timer = 10000) => {
  const [refetchCount, setRefetchCount] = useState(0);

  const { currentAccount } = useCurrentAccount({ disableAutoFetch: true });

  const {
    value: pendingData,
    loading,
    error,
  } = useAsync(async () => {
    const account = currentAccount;
    if (!account?.address) {
      return [0, undefined, undefined] as const;
    }

    const data = await getList(account!.address, 0, 20);

    const isSuccess = data?.last?.histories[0].status === 'success';

    const txId = isSuccess
      ? data?.last?.histories[0]?.receive_tx_id
      : undefined;
    const chain = isSuccess
      ? data?.last?.histories[0]?.receive_chain_id
      : undefined;

    return [
      data?.list?.filter(item => item?.status === 'pending')?.length || 0,
      txId,
      chain,
    ] as const;
  }, [refetchCount, currentAccount?.address]);

  const timerRef = useRef<NodeJS.Timeout>();

  const [pendingNumber, txId, chain] = pendingData || [];

  const { syncSingleAddress } = useSyncHistoryDB();

  useEffect(() => {
    if ((!loading && pendingNumber !== undefined) || error) {
      timerRef.current = setTimeout(() => {
        setRefetchCount(e => e + 1);
      }, timer);
    }

    return () => {
      timerRef.current && clearTimeout(timerRef.current);
    };
  }, [loading, pendingNumber, error, timer]);

  useEffect(() => {
    if (currentAccount?.address) {
      if (pendingNumber === 0) {
        const sync = async () => {
          if (!txId || !chain) {
            return;
          }
          const item = await HistoryItemEntity.findOne({
            where: {
              txHash: txId,
              chain: chain,
            },
          });

          if (!item) {
            syncSingleAddress(currentAccount?.address);
          }
        };
        sync();
      } else {
        syncSingleAddress(currentAccount?.address);
      }
    }
  }, [pendingNumber, currentAccount?.address, syncSingleAddress, txId, chain]);

  useEffect(() => {
    return () => {
      timerRef.current && clearTimeout(timerRef.current);
    };
  }, []);

  return pendingNumber;
};
