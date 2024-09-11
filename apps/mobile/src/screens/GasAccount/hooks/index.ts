import { toast } from '@/components/Toast';
import { INTERNAL_REQUEST_SESSION } from '@/constant';
import { sendRequest } from '@/core/apis/sendRequest';
import { openapi } from '@/core/request';
import { preferenceService } from '@/core/services';
import useInfiniteScroll from 'ahooks/lib/useInfiniteScroll';
import { uniqBy } from 'lodash';
import pRetry from 'p-retry';
import React, { useEffect } from 'react';
import { useCallback, useMemo, useState } from 'react';
import useAsync from 'react-use/lib/useAsync';
import {
  useGasAccountSign,
  useGasBalanceRefresh,
  useSetGasAccount,
} from './atom';

export const useGasAccountInfo = () => {
  const { sig, accountId } = useGasAccountSign();

  const { refreshId } = useGasBalanceRefresh();

  const setGasAccount = useSetGasAccount();

  const { value, loading, error } = useAsync(async () => {
    if (!sig || !accountId) {
      return undefined;
    }
    return openapi.getGasAccountInfo({ sig, id: accountId }).then(e => {
      if (e.account.id) {
        return e;
      }
      setGasAccount();
      return undefined;
    });
  }, [sig, accountId, refreshId]);

  if (
    error?.message?.includes('gas account verified failed') &&
    sig &&
    accountId
  ) {
    setGasAccount();
  }

  return { loading, value };
};

export const useGasAccountMethods = () => {
  const { sig, accountId } = useGasAccountSign();

  const setGasAccount = useSetGasAccount();

  const login = useCallback(async () => {
    const account = await preferenceService.getCurrentAccount();
    if (!account) throw new Error('background.error.noCurrentAccount');
    const { text } = await openapi.getGasAccountSignText(account.address);
    const signature = await sendRequest<string>(
      {
        method: 'personal_sign',
        params: [text, account.address],
      },
      INTERNAL_REQUEST_SESSION,
    );

    if (signature) {
      const result = await pRetry(
        async () =>
          openapi.loginGasAccount({
            sig: signature,
            account_id: account.address,
          }),
        {
          retries: 2,
        },
      );

      if (result?.success) {
        setGasAccount(signature, account);
      }
    }
  }, [setGasAccount]);

  const logout = useCallback(async () => {
    if (sig && accountId) {
      const result = await openapi.logoutGasAccount({
        sig,
        account_id: accountId,
      });
      if (result.success) {
        setGasAccount();
      } else {
        toast.show('please retry');
      }
    }
  }, [accountId, setGasAccount, sig]);

  return { login, logout };
};

export const useGasAccountLogin = ({
  loading,
  value,
}: ReturnType<typeof useGasAccountInfo>) => {
  const { sig, accountId } = useGasAccountSign();

  const { login, logout } = useGasAccountMethods();

  const isLogin = useMemo(
    () => (!loading ? !!value?.account?.id : !!sig && !!accountId),
    [sig, accountId, loading, value?.account?.id],
  );

  return { login, logout, isLogin };
};

export const useGasAccountHistory = () => {
  const { sig, accountId } = useGasAccountSign();

  const [refreshTxListCount, setRefreshListTx] = useState(0);
  const refreshListTx = React.useCallback(() => {
    setRefreshListTx(e => e + 1);
  }, []);

  const { refresh: refreshGasAccountBalance } = useGasBalanceRefresh();

  type History = Awaited<ReturnType<typeof openapi.getGasAccountHistory>>;

  const {
    data: txList,
    loading,
    loadMore,
    loadingMore,
    noMore,
    mutate,
  } = useInfiniteScroll<{
    rechargeList: History['recharge_list'];
    list: History['history_list'];
    totalCount: number;
  }>(
    async d => {
      const data = await openapi.getGasAccountHistory({
        sig: sig!,
        account_id: accountId!,
        start: d?.list?.length && d?.list?.length > 1 ? d?.list?.length : 0,
        limit: 5,
      });

      const rechargeList = data.recharge_list;
      const historyList = data.history_list;

      return {
        rechargeList: rechargeList || [],
        list: historyList,
        totalCount: data.pagination.total,
      };
    },

    {
      reloadDeps: [sig],
      isNoMore(data) {
        if (data) {
          return (
            data.totalCount <=
            (data.list.length || 0) + (data?.rechargeList?.length || 0)
          );
        }
        return true;
      },
      manual: !sig || !accountId,
    },
  );

  const { value } = useAsync(async () => {
    if (sig && accountId && refreshTxListCount) {
      return openapi.getGasAccountHistory({
        sig,
        account_id: accountId,
        start: 0,
        limit: 5,
      });
    }
  }, [sig, refreshTxListCount]);

  useEffect(() => {
    if (value?.history_list) {
      mutate(d => {
        if (!d) {
          return;
        }

        if (value?.recharge_list?.length !== d.rechargeList.length) {
          refreshGasAccountBalance();
        }
        return {
          rechargeList: value?.recharge_list,
          totalCount: value.pagination.total,
          list: uniqBy(
            [...(value?.history_list || []), ...(d?.list || [])],
            e => `${e.chain_id}${e.tx_id}` as string,
          ),
        };
      });
    }
  }, [mutate, refreshGasAccountBalance, value]);

  useEffect(() => {
    if (!noMore && !loadingMore && loadMore) {
      loadMore();
    }
  }, [loadMore, loading, loadingMore, noMore]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (!loading && !loadingMore && !!txList?.rechargeList?.length) {
      timer = setTimeout(refreshListTx, 2000);
    }
    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [loading, loadingMore, refreshListTx, txList]);

  return {
    loading,
    txList,
    loadingMore,
  };
};
