import { openapi } from '@/core/request';
import { useCurrentAccount } from '@/hooks/account';
import useInfiniteScroll from 'ahooks/lib/useInfiniteScroll';
import { uniqBy } from 'lodash';
import { useCallback, useEffect, useRef, useState } from 'react';
import useAsync from 'react-use/lib/useAsync';

const getList = async (addr: string, start = 0, limit = 20) => {
  const data = await openapi.getBuyHistory({
    user_addr: addr,
    start,
    limit,
  });

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

  const { value, loading, error } = useAsync(async () => {
    const account = currentAccount;
    if (!account?.address) {
      return 0;
    }

    const data = await getList(account!.address, 0, 20);

    return data?.list?.filter(item => item?.status === 'pending')?.length || 0;
  }, [refetchCount, currentAccount?.address]);

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
