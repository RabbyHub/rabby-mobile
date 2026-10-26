import { RootNames } from '@/constant/layout';
import { openapi } from '@/core/request';
import { openExternalUrl } from '@/core/utils/linking';
import { navigationRef } from '@/utils/navigation';
import { useCallback, useEffect, useMemo } from 'react';
import { Linking, Platform } from 'react-native';
import useAsync from 'react-use/lib/useAsync';
import { gasAccountStore, storeApiGasAccount, useGasAccountSign } from './atom';
import { useMemoizedFn, useRequest } from 'ahooks';
import { apisHomeTabIndex } from '@/hooks/navigation';
import { getIsGasAccountLoggedIn } from './loginState';
import { addressUtils } from '@rabby-wallet/base-utils';
import { useShallow } from 'zustand/react/shallow';

export const useGasAccountInfo = () => {
  const { value, status } = gasAccountStore(
    useShallow(state => ({
      value: state.snapshot.accountInfo,
      status: state.snapshot.status,
    })),
  );
  const loading = status === 'refreshing' && !value;
  const runFetchGasAccountInfo = useCallback(() => {
    return storeApiGasAccount.refreshSnapshot();
  }, []);

  return { loading, value, runFetchGasAccountInfo };
};

const getSnapshotAccountId = (
  accountInfo: ReturnType<
    typeof gasAccountStore.getState
  >['snapshot']['accountInfo'],
) =>
  (
    accountInfo as
      | {
          account?: {
            id?: string;
          };
        }
      | undefined
  )?.account?.id;

const activateGasAccountSnapshot = () => {
  const state = gasAccountStore.getState();
  const { sig, accountId } = state.session;
  if (!sig || !accountId || state.snapshot.status === 'refreshing') {
    return;
  }

  const snapshotAccountId = getSnapshotAccountId(state.snapshot.accountInfo);
  if (
    state.snapshot.accountInfo &&
    !state.snapshot.dirty &&
    (!snapshotAccountId ||
      addressUtils.isSameAddress(snapshotAccountId, accountId))
  ) {
    return;
  }

  void storeApiGasAccount.refreshSnapshot().catch(error => {
    console.error('activateGasAccountSnapshot refresh error', error);
  });
};

/**
 * Activates the snapshot resource without subscribing the caller's render tree
 * to Gas Account state. Large approval screens only need the side effect.
 */
export const useGasAccountSnapshotActivation = () => {
  useEffect(() => {
    activateGasAccountSnapshot();

    return gasAccountStore.subscribe((state, previousState) => {
      const sessionChanged =
        state.session.sig !== previousState.session.sig ||
        state.session.accountId !== previousState.session.accountId;
      const snapshotInvalidated =
        state.snapshot.dirty && !previousState.snapshot.dirty;
      const snapshotCleared =
        !state.snapshot.accountInfo && !!previousState.snapshot.accountInfo;

      if (sessionChanged || snapshotInvalidated || snapshotCleared) {
        activateGasAccountSnapshot();
      }
    });
  }, []);
};

export const useGasAccountInfoV2 = ({ address }: { address?: string }) => {
  const targetAddress = address;

  const request = useRequest(
    () => openapi.getGasAccountInfoV2({ id: targetAddress! }),
    {
      refreshDeps: [targetAddress],
      ready: !!targetAddress,
      ...(targetAddress
        ? { cacheKey: `gas-account-info-v2-${targetAddress}` }
        : {}),
    },
  );
  const refreshWhenIdle = useMemoizedFn(() => {
    if (!targetAddress || request.loading) {
      return;
    }
    request.refresh();
  });

  return {
    ...request,
    refresh: refreshWhenIdle,
  };
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
  const history = gasAccountStore(
    useShallow(state => ({
      list: state.history.list,
      rechargeList: state.history.rechargeList,
      withdrawList: state.history.withdrawList,
      totalCount: state.history.totalCount,
      status: state.history.status,
      lastFetchedAt: state.history.lastFetchedAt,
      loadingMore: state.history.loadingMore,
    })),
  );
  const confirmedCount = history.list.length;
  const pendingCount =
    history.rechargeList.length + history.withdrawList.length;
  const hasHistory = confirmedCount > 0 || pendingCount > 0;
  const hasPendingHistory = pendingCount > 0;

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

  const noMore = history.totalCount <= confirmedCount;

  return {
    loading: history.status === 'refreshing' && !history.lastFetchedAt,
    txList,
    loadingMore: !!history.loadingMore,
    loadMore: storeApiGasAccount.loadMoreHistory,
    noMore,
    hasHistory,
    hasPendingHistory,
  };
};

export const useGasAccountHistorySummary = () => {
  const summary = gasAccountStore(
    useShallow(state => ({
      status: state.history.status,
      lastFetchedAt: state.history.lastFetchedAt,
      confirmedCount: state.history.list.length,
      rechargeCount: state.history.rechargeList.length,
      withdrawCount: state.history.withdrawList.length,
    })),
  );
  const hasHistory =
    summary.confirmedCount + summary.rechargeCount + summary.withdrawCount > 0;

  return {
    ...summary,
    loading: summary.status === 'refreshing' && !summary.lastFetchedAt,
    hasHistory,
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
