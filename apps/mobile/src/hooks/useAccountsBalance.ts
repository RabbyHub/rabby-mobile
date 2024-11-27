import { useCallback, useEffect, useRef, useState } from 'react';
import { atom, useAtom } from 'jotai';
import { apiBalance } from '@/core/apis';
import { keyringService, preferenceService } from '@/core/services';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import { useMemoizedFn } from 'ahooks';

interface balanceAccountType {
  address: string;
  balance: number;
}

const balanceAtom = atom<balanceAccountType[]>([]);
const lengthAtom = atom<number>(0);

export default function useAccountsBalance(opts?: {
  cacheTime?: number;
  accountsNoUnique?: boolean;
}) {
  const { cacheTime = 10 * 60 * 1000, accountsNoUnique = true } = opts || {};
  const [balanceAccounts, setBalanceAccounts] = useAtom(balanceAtom);
  const [accountsLength, setAccountsLength] = useAtom(lengthAtom);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const lastTimeStamps = useRef<number>(0);

  const isNeedFetchData = useMemoizedFn(() => {
    const currentTime = Date.now();
    const diff = currentTime - lastTimeStamps.current;
    if (diff > cacheTime) {
      lastTimeStamps.current = currentTime;
      return true;
    }
    return false;
  });
  const fetchTotalBalance = useMemoizedFn(
    async (fetchType: 'from_cache' | 'from_api') => {
      if (balanceLoading) {
        console.log('fetchTotalBalance  loading return');
        return;
      }
      setBalanceLoading(true);
      // cache data to batch update
      const balancesArr = [] as balanceAccountType[];

      const list = await keyringService.getAllVisibleAccountsArray();

      const formatList = list
        .filter(
          a =>
            a.type !== KEYRING_CLASS.WATCH && a.type !== KEYRING_CLASS.GNOSIS,
        )
        .map(a => a.address.toLowerCase());

      setAccountsLength(formatList.length);

      const uniqueList = accountsNoUnique
        ? formatList.filter(
            (value, index, self) => self.indexOf(value) === index,
          )
        : formatList;

      const accountPromises = uniqueList.map(async account => {
        if (fetchType === 'from_cache') {
          const cacheData = preferenceService.getAddressBalance(account);
          balancesArr.push({
            address: account,
            balance: cacheData?.total_usd_value || 0,
          });
          return;
        }

        try {
          // get from server api
          const resData = await apiBalance.getAddressBalance(account, {
            force: true,
          });
          balancesArr.push({
            address: account,
            balance: resData?.total_usd_value || 0,
          });
        } catch (e) {
          console.log('accountPromises  error', e);
          // api fetch error fallback get from cache store
          const cacheData = preferenceService.getAddressBalance(account);
          balancesArr.push({
            address: account,
            balance: cacheData?.total_usd_value || 0,
          });
        }
      });

      await Promise.all(accountPromises);

      setBalanceAccounts(balancesArr);
      setBalanceLoading(false);
    },
  );

  const triggerUpdate = useMemoizedFn((forceFromApi?: boolean) => {
    // if (isNeedFetchData() || forceFromApi) {
    //   fetchTotalBalance();
    // }
    const isForceFetchFromApi = isNeedFetchData() || forceFromApi;
    console.log(
      'triggerUpdate  fetchTotalBalance',
      isForceFetchFromApi ? 'from_api' : 'from_cache',
    );
    fetchTotalBalance(isForceFetchFromApi ? 'from_api' : 'from_cache');
  });

  return {
    balanceAccounts,
    accountsLength, // maybe has some same address with other type
    triggerUpdate,
    balanceLoading,
  };
}
