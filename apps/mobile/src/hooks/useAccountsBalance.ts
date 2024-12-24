import { useRef, useState } from 'react';
import { atom, useAtom } from 'jotai';
import { apiBalance } from '@/core/apis';
import { keyringService, preferenceService } from '@/core/services';
import { KEYRING_CLASS, KeyringTypeName } from '@rabby-wallet/keyring-utils';
import { useMemoizedFn } from 'ahooks';
import PQueue from 'p-queue';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';

export interface balanceAccountType {
  address: string;
  balance: number;
  type: KeyringTypeName;
  brandName: string;
}

const waitQueueFinished = (q: PQueue) => {
  return new Promise(resolve => {
    q.on('idle', () => {
      resolve(null);
    });
  });
};

const balanceAtom = atom<balanceAccountType[]>([]);
const balanceCacheAtom = atom<balanceAccountType[]>([]);
const lengthAtom = atom<number>(0);

export default function useAccountsBalance(opts?: {
  cacheTime?: number;
  accountsNoUnique?: boolean;
}) {
  const { cacheTime = 10 * 60 * 1000, accountsNoUnique = true } = opts || {};
  const [balanceAccounts, setBalanceAccounts] = useAtom(balanceAtom);
  const [balanceCacheAccounts, setBalanceCacheAccounts] =
    useAtom(balanceCacheAtom);
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
      try {
        if (balanceLoading) {
          console.log('fetchTotalBalance  loading return');
          return;
        }
        setBalanceLoading(true);
        // batch update
        const cacheBalancesArr = [] as balanceAccountType[];

        const list = await keyringService.getAllVisibleAccountsArray();

        const formatList = list.filter(
          a =>
            a.type !== KEYRING_CLASS.WATCH &&
            a.type !== KEYRING_CLASS.GNOSIS &&
            a.type !== KEYRING_CLASS.WALLETCONNECT,
        );
        // .map(a => a.address.toLowerCase());

        setAccountsLength(formatList.length);

        const uniqueList = accountsNoUnique
          ? formatList.filter(
              (value, index, self) => self.indexOf(value) === index,
            )
          : formatList;

        // deault first get from cache store
        uniqueList.map(({ address, type, brandName }) => {
          const account = address.toLowerCase();
          const cacheData = preferenceService.getAddressBalance(account);
          if (uniqueList.find(o => isSameAddress(o.address, account))) {
            cacheBalancesArr.push({
              address: account,
              balance: cacheData?.total_usd_value || 0,
              type,
              brandName,
            });
          }
        });
        setBalanceCacheAccounts(cacheBalancesArr);
        setBalanceAccounts(cacheBalancesArr);

        if (fetchType === 'from_api') {
          const queueBalanceArr = [] as balanceAccountType[];
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
                const resData = await apiBalance.getAddressBalance(account, {
                  force: true,
                });
                if (uniqueList.find(o => isSameAddress(o.address, account))) {
                  queueBalanceArr.push({
                    address: account,
                    balance: resData?.total_usd_value || 0,
                    type,
                    brandName,
                  });
                }
              } catch (e) {
                console.log('fetchTotalBalance  error', e);
                // api fetch error fallback get from cache store
                const cacheData = preferenceService.getAddressBalance(account);
                if (uniqueList.find(o => isSameAddress(o.address, account))) {
                  queueBalanceArr.push({
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
          setBalanceAccounts(queueBalanceArr);
        }
      } catch (e) {
        console.error('fetchTotalBalance  error', e);
      } finally {
        setBalanceLoading(false);
      }
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
    if (forceFromApi) {
      lastTimeStamps.current = Date.now();
    }
    fetchTotalBalance(isForceFetchFromApi ? 'from_api' : 'from_cache');
  });

  return {
    balanceAccounts,
    balanceCacheAccounts,
    accountsLength, // maybe has some same address with other type
    triggerUpdate,
    balanceLoading,
  };
}
