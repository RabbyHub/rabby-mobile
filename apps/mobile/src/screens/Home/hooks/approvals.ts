import { useCallback, useEffect, useMemo, useState } from 'react';
import { atom, useAtom } from 'jotai';
import useAsyncFn from 'react-use/lib/useAsyncFn';

import { useAccounts, useCurrentAccount } from '@/hooks/account';
import { openapi } from '@/core/request';
import { ApprovalStatus } from '@rabby-wallet/rabby-api/dist/types';
import { KEYRING_CLASS, KEYRING_TYPE } from '@rabby-wallet/keyring-utils';

const approvalStatusAtom = atom<ApprovalStatus[]>([]);

export function useApprovalAlert() {
  const { currentAccount } = useCurrentAccount();
  const [approvalState, setApprovalState] = useAtom(approvalStatusAtom);

  const [, loadApprovalStatus] = useAsyncFn(async () => {
    if (
      currentAccount?.address &&
      currentAccount.type !== KEYRING_TYPE.WatchAddressKeyring
    ) {
      try {
        const data = await openapi.approvalStatus(currentAccount!.address);
        setApprovalState(data);
      } catch (error) {}
    }
    return;
  }, [currentAccount?.address]);

  useEffect(() => {
    loadApprovalStatus();
  }, [loadApprovalStatus]);

  const approvalRiskAlert = useMemo(() => {
    return approvalState.reduce(
      (pre, now) =>
        pre + now.nft_approval_danger_cnt + now.token_approval_danger_cnt,
      0,
    );
  }, [approvalState]);

  return {
    loadApprovalStatus,
    approvalRiskAlert,
  };
}

export const FILTER_ACCOUNT_TYPES = [KEYRING_CLASS.WATCH, KEYRING_CLASS.GNOSIS];

interface IApprovalAlertInfo {
  total: number;
  address2count: {
    [address: string]: number;
  };
  loading: boolean;
}

const appprovalAlertMap = atom<IApprovalAlertInfo>({
  total: 0,
  address2count: {},
  loading: false,
});
export const useApprovalAlertCounts = () => {
  const [appprovalAlertInfo, setAppprovalAlertInfo] =
    useAtom(appprovalAlertMap);
  const { accounts, fetchAccounts } = useAccounts({
    disableAutoFetch: true,
  });
  const displayAccounts = accounts.filter(
    acc => !FILTER_ACCOUNT_TYPES.includes(acc.type),
  );

  const getAllAlert = useCallback(async () => {
    if (!displayAccounts.length) {
      return;
    }
    console.log('refresh alerts');
    const address2count = {};
    let total = 0;
    setAppprovalAlertInfo(pre => ({
      ...pre,
      loading: true,
    }));
    await Promise.all(
      displayAccounts.map(async acc => {
        try {
          const data = await openapi.approvalStatus(acc.address);
          if (data) {
            const alertCount = data.reduce(
              (pre, now) =>
                pre +
                now.nft_approval_danger_cnt +
                now.token_approval_danger_cnt,
              0,
            );
            address2count[acc.address] = alertCount;
            total += alertCount;
          }
          return true;
        } catch (error) {
          console.error('get approvalStatus', error);
          return false;
        }
      }),
    );
    setAppprovalAlertInfo({
      total,
      address2count,
      loading: false,
    });
  }, [displayAccounts, setAppprovalAlertInfo]);

  useEffect(() => {
    if (
      Object.keys(appprovalAlertInfo.address2count).length ||
      appprovalAlertInfo.loading
    ) {
      return;
    }
    getAllAlert();
  }, [
    appprovalAlertInfo.address2count,
    appprovalAlertInfo.loading,
    getAllAlert,
  ]);

  return {
    appprovalAlertInfo,
    getAllAlert,
    fetchAccounts,
  };
};
