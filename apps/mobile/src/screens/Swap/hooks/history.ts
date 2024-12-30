import { openapi } from '@/core/request';
import { useCurrentAccount } from '@/hooks/account';
import { SwapItem } from '@rabby-wallet/rabby-api/dist/types';
import useInfiniteScroll from 'ahooks/lib/useInfiniteScroll';
import { atom, useAtom, useAtomValue, useSetAtom } from 'jotai';
import { uniqBy } from 'lodash';
import { useEffect, useRef, useState } from 'react';
import useAsync from 'react-use/lib/useAsync';
import { refreshIdAtom } from './atom';

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
  const { currentAccount } = useCurrentAccount();
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
        5,
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
      return getSwapList(addr, 0, 5);
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

export const usePollSwapPendingNumber = (timer = 10000) => {
  const [refetchCount, setRefetchCount] = useState(0);

  const { currentAccount } = useCurrentAccount();
  const { value, loading, error } = useAsync(async () => {
    const account = currentAccount;
    if (!account?.address) {
      return 0;
    }

    const data = await openapi.getSwapTradeList({
      user_addr: account!.address,
      start: '0',
      limit: '10',
    });
    return (
      data?.history_list?.filter(item => item?.status === 'Pending')?.length ||
      0
    );
  }, [refetchCount]);

  const timerRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if ((!loading && value !== undefined) || error) {
      timerRef.current = setTimeout(() => {
        setRefetchCount(e => e + 1);
      }, timer);
    }

    return () => {
      timerRef.current && clearTimeout(timerRef.current);
    };
  }, [loading, value, error, timer]);

  useEffect(() => {
    return () => {
      timerRef.current && clearTimeout(timerRef.current);
    };
  }, []);

  return value;
};
