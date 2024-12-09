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

interface IApprovalsInfo {
  total: number;
  address2count: {
    [address: string]: number;
  };
  address2approvalCount: {
    [address: string]: number;
  };
  loading: boolean;
}

const appprovalsMap = atom<IApprovalsInfo>({
  total: 0,
  address2count: {},
  loading: false,
  address2approvalCount: {},
});

// TODO: ONLY FOR TEST need use rabby-api pkg
const getApprovalAccount = async (address: string) => {
  try {
    const approvalCountRes = await fetch(
      `https://approval.rabby-api.debank.dbkops.com/v1/user/total_approval_asset_cnt?id=${address}`,
    ).then(res => res.json());
    return approvalCountRes?.['total_asset_cnt'] || 0;
  } catch (error) {
    console.log('🔍 CUSTOM_LOGGER:=>: getApprovalAccount)', error);
    return 0;
  }
};
export const useApprovalAlertCounts = () => {
  const [appprovalInfo, setAppprovalInfo] = useAtom(appprovalsMap);
  const { accounts, fetchAccounts } = useAccounts({
    disableAutoFetch: true,
  });
  const displayAccounts = accounts.filter(
    acc => !FILTER_ACCOUNT_TYPES.includes(acc.type),
  );

  const getAllApprovalInfo = useCallback(async () => {
    if (!displayAccounts.length) {
      return;
    }
    console.log('refresh alerts');
    const address2count = {};
    const address2ApprovalCount = {};
    let total = 0;
    setAppprovalInfo(pre => ({
      ...pre,
      loading: true,
    }));
    await Promise.all(
      displayAccounts.map(async acc => {
        try {
          const data = await openapi.approvalStatus(acc.address);
          // TODO: const approvalCount = await openapi.getApprovalCount(acc.address);
          console.log('🔍 CUSTOM_LOGGER:=>: acc.address)', acc.address);
          const approvalCount = await getApprovalAccount(acc.address);

          address2ApprovalCount[acc.address] = approvalCount;
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

    setAppprovalInfo({
      total,
      address2count,
      loading: false,
      address2approvalCount: address2ApprovalCount,
    });
  }, [displayAccounts, setAppprovalInfo]);

  useEffect(() => {
    if (
      Object.keys(appprovalInfo.address2count).length ||
      appprovalInfo.loading
    ) {
      return;
    }
    getAllApprovalInfo();
  }, [appprovalInfo.address2count, appprovalInfo.loading, getAllApprovalInfo]);

  return {
    appprovalInfo,
    getAllApprovalInfo,
    fetchAccounts,
  };
};
