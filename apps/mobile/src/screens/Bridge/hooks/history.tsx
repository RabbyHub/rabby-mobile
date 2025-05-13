import { useInfiniteScroll, useRequest } from 'ahooks';
import React, { useEffect, useRef, useState } from 'react';
import { uniqBy } from 'lodash';
import { currentAccountAtom, useCurrentAccount } from '@/hooks/account';
import { openapi } from '@/core/request';
import useAsync from 'react-use/lib/useAsync';
import { atom, useAtom, useAtomValue } from 'jotai';

const pendingCountAtom = atom(0);
export const useReadBridgePendingCount = () => {
  return useAtomValue(pendingCountAtom);
};
export const usePollBridgePendingNumber = (timer = 10000) => {
  const [, setCount] = useAtom(pendingCountAtom);

  const { currentAccount: account } = useCurrentAccount({
    disableAutoFetch: true,
  });

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
      return (
        data?.history_list?.filter(item => item?.status === 'pending')
          ?.length || 0
      );
    },
    {
      refreshDeps: [account],
      onSuccess(v) {
        setCount(v);
      },
    },
  );

  const timerRef = useRef<NodeJS.Timeout>();

  const { loading, error, data: value, runAsync } = res;

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

  return res;
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
