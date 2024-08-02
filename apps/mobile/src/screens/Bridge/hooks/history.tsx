import { useInfiniteScroll } from 'ahooks';
import React, { useEffect, useRef, useState } from 'react';
import { uniqBy } from 'lodash';
import { useCurrentAccount } from '@/hooks/account';
import { openapi } from '@/core/request';
import useAsync from 'react-use/lib/useAsync';

export const usePollBridgePendingNumber = (timer = 10000) => {
  const [refetchCount, setRefetchCount] = useState(0);

  const { currentAccount: account } = useCurrentAccount({
    disableAutoFetch: true,
  });

  const { value, loading, error } = useAsync(async () => {
    if (!account?.address) {
      return 0;
    }

    const data = await openapi.getBridgeHistoryList({
      user_addr: account!.address,
      start: 0,
      limit: 10,
    });
    return (
      data?.history_list?.filter(item => item?.status === 'pending')?.length ||
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

export const useBridgeHistory = () => {
  const { currentAccount } = useCurrentAccount({ disableAutoFetch: true });

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
        5,
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
      return getBridgeHistoryList(addr, 0, 5);
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
