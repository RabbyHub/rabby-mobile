import { RootNames } from '@/constant/layout';
import { openapi } from '@/core/request';
import { openExternalUrl } from '@/core/utils/linking';
import { navigationRef } from '@/utils/navigation';
import { useCallback, useEffect, useMemo } from 'react';
import { Linking, Platform } from 'react-native';
import useAsync from 'react-use/lib/useAsync';
import { gasAccountStore, storeApiGasAccount, useGasAccountSign } from './atom';
import { useRequest } from 'ahooks';
import { apisHomeTabIndex } from '@/hooks/navigation';
import { getIsGasAccountLoggedIn } from './loginState';
import { addressUtils } from '@rabby-wallet/base-utils';

export const useGasAccountInfo = () => {
  const { sig, accountId } = useGasAccountSign();
  const snapshot = gasAccountStore(s => s.snapshot);
  const value = snapshot.accountInfo;
  const snapshotAccountId = (
    snapshot.accountInfo as
      | {
          account?: {
            id?: string;
          };
        }
      | undefined
  )?.account?.id;
  const loading = snapshot.status === 'refreshing' && !snapshot.accountInfo;
  const runFetchGasAccountInfo = useCallback(() => {
    return storeApiGasAccount.refreshSnapshot();
  }, []);

  useEffect(() => {
    if (!sig || !accountId) {
      return;
    }

    if (
      !snapshot.accountInfo ||
      snapshot.dirty ||
      (snapshotAccountId &&
        !addressUtils.isSameAddress(snapshotAccountId, accountId))
    ) {
      runFetchGasAccountInfo().catch(error => {
        console.error('useGasAccountInfo refresh error', error);
      });
    }
  }, [
    accountId,
    runFetchGasAccountInfo,
    sig,
    snapshot.accountInfo,
    snapshotAccountId,
    snapshot.dirty,
  ]);

  return { loading, value, runFetchGasAccountInfo };
};

export const useGasAccountInfoV2 = ({ address }: { address?: string }) => {
  const targetAddress = address;

  return useRequest(() => openapi.getGasAccountInfoV2({ id: targetAddress! }), {
    refreshDeps: [targetAddress],
    ready: !!targetAddress,
    ...(targetAddress
      ? { cacheKey: `gas-account-info-v2-${targetAddress}` }
      : {}),
  });
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
  };
};

export const useGasAccountLogin = () => {
  const { sig, accountId } = useGasAccountSign();

  const { login } = useGasAccountMethods();

  const isLogin = useMemo(
    () => getIsGasAccountLoggedIn({ sig, accountId }),
    [sig, accountId],
  );

  return { login, isLogin };
};

export const useGasAccountHistory = () => {
  const { sig, accountId } = useGasAccountSign();
  const history = gasAccountStore(s => s.history);
  useEffect(() => {
    if (!sig || !accountId) {
      const shouldClearHistory =
        history.status !== 'ready' ||
        history.totalCount > 0 ||
        history.list.length > 0 ||
        history.rechargeList.length > 0 ||
        history.withdrawList.length > 0;

      if (shouldClearHistory) {
        storeApiGasAccount.refreshHistory().catch(error => {
          console.error('useGasAccountHistory clear error', error);
        });
      }
      return;
    }

    if (
      history.status === 'idle' &&
      !history.list.length &&
      !history.rechargeList.length &&
      !history.withdrawList.length
    ) {
      storeApiGasAccount.refreshHistory().catch(error => {
        console.error('useGasAccountHistory refresh error', error);
      });
    }
  }, [
    accountId,
    history.list.length,
    history.rechargeList.length,
    history.totalCount,
    history.status,
    history.withdrawList.length,
    sig,
  ]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    const hasSomePending = Boolean(
      history.rechargeList.length || history.withdrawList.length,
    );
    if (
      history.status !== 'refreshing' &&
      !history.loadingMore &&
      hasSomePending
    ) {
      timer = setTimeout(() => {
        storeApiGasAccount.refreshHistory().catch(error => {
          console.error('pending history refresh error', error);
        });
      }, 2000);
    }
    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [
    history.loadingMore,
    history.rechargeList.length,
    history.status,
    history.withdrawList.length,
  ]);

  const txList = useMemo(
    () => ({
      rechargeList: history.rechargeList,
      withdrawList: history.withdrawList,
      list: history.list,
      totalCount: history.totalCount,
    }),
    [
      history.list,
      history.rechargeList,
      history.totalCount,
      history.withdrawList,
    ],
  );

  const noMore =
    history.totalCount <=
    history.list.length +
      history.rechargeList.length +
      history.withdrawList.length;

  return {
    loading: history.status === 'refreshing' && !history.lastFetchedAt,
    txList,
    loadingMore: !!history.loadingMore,
    loadMore: storeApiGasAccount.loadMoreHistory,
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
