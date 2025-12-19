import { useEffect, useRef, useState } from 'react';
import { apiBalance } from '@/core/apis';
import { preferenceService } from '@/core/services';
import { useMemoizedFn } from 'ahooks';
import PQueue from 'p-queue';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { Account } from '@/core/services/preference';

const waitQueueFinished = (q: PQueue) => {
  return new Promise(resolve => {
    q.on('idle', () => {
      resolve(null);
    });
  });
};

export function useSpecifyAccountsBalance(accounts: Account[]) {
  const [balanceAccounts, setBalanceAccounts] = useState(accounts);

  const [balanceLoading, setBalanceLoading] = useState(false);

  const fetchTotalBalance = useMemoizedFn(async () => {
    try {
      if (balanceLoading) {
        return;
      }
      if (!balanceAccounts.length) {
        setBalanceAccounts(accounts);
      }
      setBalanceLoading(true);
      // batch update
      // const cacheBalancesArr = [] as BalanceAccountType[];

      const list = accounts || [];

      const uniqueList = list;

      const queueBalanceArr = [] as typeof balanceAccounts;
      // get from server api by queue
      const queue = new PQueue({
        interval: 2000,
        intervalCap: 10,
      });
      for (let i = 0; i < uniqueList.length; i++) {
        const { type, address, brandName } = uniqueList[i];
        const account = address.toLowerCase();
        // batch fetch by queue
        queue.add(async () => {
          try {
            const resData = await apiBalance.getAddressBalance(account, {});
            if (uniqueList.find(o => isSameAddress(o.address, account))) {
              queueBalanceArr.push({
                ...uniqueList[i],
                address: account,
                balance: resData?.total_usd_value || 0,
                type,
                brandName,
              });

              setBalanceAccounts?.(preAccounts => {
                return preAccounts.map(e => {
                  if (isSameAddress(e.address, account)) {
                    return { ...e, balance: resData.total_usd_value };
                  }
                  return e;
                });
              });
            }
          } catch (e) {
            console.log('fetchTotalBalance  error', e);
            // api fetch error fallback get from cache store
            const cacheData = preferenceService.getAddressBalance(account);
            if (uniqueList.find(o => isSameAddress(o.address, account))) {
              queueBalanceArr.push({
                ...uniqueList[i],
                address: account,
                balance: cacheData?.total_usd_value || 0,
                type,
                brandName,
              });
            }
          }
        });
      }
      await waitQueueFinished(queue);
    } catch (e) {
      console.error('fetchTotalBalance  error', e);
    } finally {
      setBalanceLoading(false);
    }
  });

  return {
    balanceAccounts,
    balanceLoading,
    setBalanceAccounts,
    fetchTotalBalance,
  };
}
