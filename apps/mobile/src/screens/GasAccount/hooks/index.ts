import { RootNames } from '@/constant/layout';
import { openapi } from '@/core/request';
import { openExternalUrl } from '@/core/utils/linking';
import { navigationRef } from '@/utils/navigation';
import useInfiniteScroll from 'ahooks/lib/useInfiniteScroll';
import { uniqBy } from 'lodash';
import { useCallback, useEffect, useMemo } from 'react';
import { Linking, Platform } from 'react-native';
import useAsync from 'react-use/lib/useAsync';
import {
  storeApiGasAccount,
  useGasAccountHistoryRefresh,
  useGasAccountSign,
  useGasBalanceRefresh,
} from './atom';
import { useRequest } from 'ahooks';
import { apisHomeTabIndex } from '@/hooks/navigation';

export const useGasAccountInfo = () => {
  const { sig, accountId } = useGasAccountSign();

  const { refreshId } = useGasBalanceRefresh();

  const {
    data: value,
    runAsync: runFetchGasAccountInfo,
    loading,
    error,
  } = useRequest(
    async () => {
      return storeApiGasAccount.fetchGasAccountInfo();
    },
    {
      refreshDeps: [sig, accountId, refreshId],
      cacheKey: `current-gas-account-info-${accountId}`,
      onError() {
        storeApiGasAccount.setGasAccount();
      },
    },
  );

  if (
    error?.message?.includes('gas account verified failed') &&
    sig &&
    accountId
  ) {
    storeApiGasAccount.setGasAccount();
  }

  return { loading, value, runFetchGasAccountInfo };
};

export const useGasAccountInfoV2 = ({ address }: { address: string }) => {
  return useRequest(
    async () => {
      return openapi.getGasAccountInfoV2({ id: address });
    },
    {
      refreshDeps: [address],
      cacheKey: `gas-account-info-v2-${address}`,
    },
  );
};

export const useGasAccountGoBack = () => {
  const navigation = navigationRef;
  return useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.reset({
        index: 0,
        routes: [
          {
            name: RootNames.StackRoot,
            params: {
              screen: RootNames.Home,
            },
          },
        ],
      });
      apisHomeTabIndex.setTabIndex(0);
    }
  }, [navigation]);
};

export const useGasAccountMethods = () => {
  return {
    login: storeApiGasAccount.loginGasAccount,
    logout: storeApiGasAccount.logoutGasAccount,
  };
};

export const useGasAccountLogin = ({
  loading,
  value,
}: Pick<ReturnType<typeof useGasAccountInfo>, 'loading' | 'value'>) => {
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

  const { refreshId: refreshTxListCount, refresh: refreshListTx } =
    useGasAccountHistoryRefresh();

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
    withdrawList: History['recharge_list'];
    list: History['history_list'];
    totalCount: number;
  }>(
    async d => {
      if (!sig || !accountId) {
        return {
          rechargeList: [],
          withdrawList: [],
          list: [],
          totalCount: 0,
        };
      }
      const data = await openapi.getGasAccountHistory({
        sig: sig!,
        account_id: accountId!,
        start: d?.list?.length && d?.list?.length > 1 ? d?.list?.length : 0,
        limit: 10,
      });

      const rechargeList = data.recharge_list;
      const historyList = data.history_list;
      const withdrawList = data.withdraw_list;
      return {
        rechargeList: rechargeList || [],
        withdrawList: withdrawList || [],
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
            (data.list.length || 0) +
              (data?.rechargeList?.length || 0) +
              (data?.withdrawList?.length || 0)
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
  }, [sig, refreshTxListCount, accountId]);

  useEffect(() => {
    if (value?.history_list) {
      mutate(d => {
        if (!d) {
          return;
        }

        if (
          value?.recharge_list?.length !== d.rechargeList.length ||
          value?.withdraw_list?.length !== d.withdrawList.length
        ) {
          refreshGasAccountBalance();
        }
        return {
          withdrawList: value?.withdraw_list,
          rechargeList: value?.recharge_list,
          totalCount: value.pagination.total,
          list: uniqBy(
            [...(value?.history_list || []), ...(d?.list || [])],
            e => `${e?.create_at}` as string,
          ),
        };
      });
    }
  }, [mutate, refreshGasAccountBalance, value]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    const hasSomePending = Boolean(
      txList?.rechargeList?.length || txList?.withdrawList?.length,
    );
    if (!loading && !loadingMore && hasSomePending) {
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
    loadMore,
    noMore,
  };
};

export const gotoDeBankAppL2 = () => {
  const gotoAppStore = () =>
    openExternalUrl(
      Platform.OS === 'android'
        ? 'https://play.google.com/store/apps/details?id=com.debank.meme'
        : 'https://apps.apple.com/us/app/debank-crypto-defi-portfolio/id1621278377',
    );

  const urlScheme = 'debank://account';

  Linking.canOpenURL(urlScheme)
    .then(supported => {
      if (supported) {
        Linking.openURL(urlScheme);
      } else {
        gotoAppStore();
      }
    })
    .catch(() => {
      gotoAppStore();
    });
};

export const useAml = () => {
  const { accountId } = useGasAccountSign();

  const { value } = useAsync(async () => {
    if (accountId) {
      return openapi.getGasAccountAml(accountId);
    }
    return {
      is_risk: false,
    };
  }, [accountId]);

  return value?.is_risk;
};
