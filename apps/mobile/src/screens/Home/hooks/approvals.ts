import { useCallback, useEffect, useMemo } from 'react';
import { atom, useAtom } from 'jotai';
import useAsyncFn from 'react-use/lib/useAsyncFn';

import { KeyringAccountWithAlias, useAccounts } from '@/hooks/account';
import { openapi } from '@/core/request';
import { ApprovalStatus } from '@rabby-wallet/rabby-api/dist/types';
import { KEYRING_CLASS, KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import PQueue from 'p-queue';
import { useMemoizedFn } from 'ahooks';
import { Account } from '@/core/services/preference';
import { zCreate } from '@/core/utils/reexports';
import { resolveValFromUpdater, UpdaterOrPartials } from '@/core/utils/store';
import { useCreationWithShallowCompare } from '@/hooks/common/useMemozied';

// const approvalStatusAtom = atom<ApprovalStatus[]>([]);
const approvalStatusStore = zCreate<ApprovalStatus[]>(() => []);
function setApprovalState(valOrFunc: UpdaterOrPartials<ApprovalStatus[]>) {
  approvalStatusStore.setState(prev => {
    const { newVal, changed } = resolveValFromUpdater(prev, valOrFunc, {
      strict: true,
    });

    if (!changed) return prev;

    return newVal;
  });
}

export function useApprovalAlert({
  account: currentAccount,
}: {
  account: Account | null | undefined;
}) {
  const approvalState = approvalStatusStore(s => s);

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

interface IApprovalsAlert {
  total: number;
  address2count: {
    [address: string]: number;
  };
  loading: boolean;
}

const queue = new PQueue({
  interval: 1000,
  intervalCap: 10,
  concurrency: 10,
});

const waitQueueFinished = (q: PQueue) => {
  return new Promise(resolve => {
    q.on('empty', () => {
      if (q.pending <= 0) {
        resolve(null);
      }
    });
  });
};

async function fetchApprovalAmount(address: string): Promise<number> {
  try {
    const approvalCountRes = await openapi.getApprovalCount(address);
    return approvalCountRes.total_asset_cnt;
  } catch (error) {
    console.error(`Error fetching approval amount for ${address}:`, error);
    return 0;
  }
}

export const approvalDataAtom = atom<Record<string, number>>({});
export const useApprovalsCount = () => {
  const [appprovalInfo, setAppprovalInfo] = useAtom(approvalDataAtom);

  const getAllApprovalCount = useCallback(
    async (displayAccounts: KeyringAccountWithAlias[]) => {
      if (!displayAccounts.length) {
        return;
      }
      displayAccounts.forEach(item => {
        queue.add(async () => {
          try {
            const amount = await fetchApprovalAmount(item.address);

            setAppprovalInfo(prev => ({
              ...prev,
              [item.address]: amount,
            }));
          } catch (error) {
            console.error(`Error processing address ${item.address}:`, error);
            setAppprovalInfo(prev => ({
              ...prev,
              [item.address]: 0,
            }));
          }
        });
      });

      return waitQueueFinished(queue);
    },
    [setAppprovalInfo],
  );
  return {
    address2Count: appprovalInfo,
    getAllApprovalCount,
  };
};

// const appprovalsAlertAtom = atom<IApprovalsAlert>({
//   total: 0,
//   address2count: {},
//   loading: false,
// });
const approvalsAlertStore = zCreate<IApprovalsAlert>(() => ({
  total: 0,
  address2count: {},
  loading: false,
}));
function setAlertInfo(valOrFunc: UpdaterOrPartials<IApprovalsAlert>) {
  approvalsAlertStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev, valOrFunc, {
      strict: false,
    });

    return { ...prev, ...newVal };
  });
}

let lastTimeStamps = 0;

const alertQueue = new PQueue({
  interval: 1000,
  intervalCap: 10,
  concurrency: 10,
});

export const useApprovalAlertCounts = (cacheTime: number) => {
  const alertInfo = approvalsAlertStore(s => s);
  const { accounts } = useAccounts({
    disableAutoFetch: true,
  });
  const displayAccounts = useCreationWithShallowCompare(
    () => accounts.filter(acc => !FILTER_ACCOUNT_TYPES.includes(acc.type)),
    [accounts],
  );

  const isNeedFetchData = useMemoizedFn(() => {
    const currentTime = Date.now();
    const diff = currentTime - lastTimeStamps;
    if (diff > cacheTime) {
      lastTimeStamps = currentTime;
      return true;
    }
    return false;
  });

  const getAllApprovalInfo = useCallback(async () => {
    try {
      if (!displayAccounts.length) {
        return;
      }
      if (approvalsAlertStore.getState().loading) {
        return;
      }
      const address2count = {};
      let total = 0;
      setAlertInfo(pre => ({
        ...pre,
        loading: true,
      }));
      displayAccounts.forEach(acc => {
        alertQueue.add(async () => {
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
          } catch (error) {
            console.error(
              `Error fetching approval amount for ${acc.address}:`,
              error,
            );
          }
        });
      });

      await waitQueueFinished(alertQueue);

      setAlertInfo({
        total,
        address2count,
        loading: false,
      });
    } catch (error) {
      console.error('get all alert info error', error);
      setAlertInfo({
        total: 0,
        address2count: {},
        loading: false,
      });
    }
  }, [displayAccounts]);

  const triggerUpdate = useMemoizedFn(() => {
    if (isNeedFetchData()) {
      getAllApprovalInfo();
    }
  });

  const forceUpdate = useMemoizedFn(() => {
    getAllApprovalInfo();
    lastTimeStamps = Date.now();
  });

  useEffect(() => {
    forceUpdate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayAccounts?.length]);

  return {
    alertInfo,
    triggerUpdate,
    getAllApprovalInfo,
    forceUpdate,
  };
};
