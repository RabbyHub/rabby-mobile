import { useCallback, useRef, useState } from 'react';
import { atom, useAtom } from 'jotai';
import { apiBalance } from '@/core/apis';
import { keyringService, preferenceService } from '@/core/services';
import { KEYRING_CLASS, KeyringTypeName } from '@rabby-wallet/keyring-utils';
import PQueue from 'p-queue';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { unionBy } from 'lodash';
import { useAtomCallback } from 'jotai/utils';
import { zCreate } from '@/core/utils/reexports';
import { resolveValFromUpdater, UpdaterOrPartials } from '@/core/utils/store';

export interface balanceAccountType {
  address: string;
  balance: number;
  evmBalance: number;
  type: KeyringTypeName;
  brandName: string;
  alias?: string;
  aliasName?: string;
}

const waitQueueFinished = (q: PQueue) => {
  return new Promise(resolve => {
    q.on('idle', () => {
      resolve(null);
    });
  });
};

type BalanceState = {
  balance: balanceAccountType[];
  balanceCache: balanceAccountType[];
  length: number;
};
const balanceStore = zCreate<BalanceState>(() => ({
  balance: [],
  balanceCache: [],
  length: 0,
}));

export function useBalanceAccounts() {
  return {
    balanceAccounts: balanceStore(s => s.balance),
  };
}

function setBalanceAccounts(
  valOrFunc: UpdaterOrPartials<balanceAccountType[]>,
) {
  balanceStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev.balance, valOrFunc);

    return { ...prev, balance: newVal };
  });
}

function setBalanceCacheAccounts(
  valOrFunc: UpdaterOrPartials<balanceAccountType[]>,
) {
  balanceStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev.balanceCache, valOrFunc);

    return { ...prev, balanceCache: newVal };
  });
}

function setAccountsLength(valOrFunc: UpdaterOrPartials<number>) {
  balanceStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev.length, valOrFunc);

    return { ...prev, length: newVal };
  });
}

type BalanceLoadingState = {
  balanceLoading: boolean;
  loadBalanceFromApiStage: LoadBalanceStage;
};
const balanceLoadingStore = zCreate<BalanceLoadingState>(() => ({
  balanceLoading: false,
  loadBalanceFromApiStage: 'idle',
}));
function setLoading(valOrFunc: UpdaterOrPartials<BalanceLoadingState>) {
  balanceLoadingStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev, valOrFunc);

    return { ...prev, ...newVal };
  });
}
function getBalanceLoading() {
  return balanceLoadingStore.getState().balanceLoading;
}

export type LoadBalanceStage = 'idle' | 'loading' | 'finished';
export default function useAccountsBalance(opts?: {
  cacheTime?: number;
  accountsNoUnique?: boolean;
}) {
  const { cacheTime = 10 * 60 * 1000, accountsNoUnique = true } = opts || {};
  const balanceAccounts = balanceStore(s => s.balance);
  const balanceCacheAccounts = balanceStore(s => s.balanceCache);

  const accountsLength = balanceStore(s => s.length);
  const balanceLoading = balanceLoadingStore(s => s.balanceLoading);
  const loadBalanceFromApiStage = balanceLoadingStore(
    s => s.loadBalanceFromApiStage,
  );
  // const getBalanceLoading = useAtomCallback(
  //   useCallback(get => get(loadAccountsBalanceAtom).balanceLoading, []),
  // );
  const lastTimeStamps = useRef<number>(0);

  const isNeedFetchData = useCallback(() => {
    const currentTime = Date.now();
    const diff = currentTime - lastTimeStamps.current;
    if (diff > cacheTime) {
      lastTimeStamps.current = currentTime;
      return true;
    }
    return false;
  }, [cacheTime]);

  const fetchTotalBalance = useCallback(
    async (fetchType: 'from_cache' | 'from_api') => {
      try {
        if (getBalanceLoading()) {
          console.log('fetchTotalBalance loading return');
          return;
        }
        setLoading(prev => ({ ...prev, balanceLoading: true }));
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
          ? unionBy(formatList, account => account.address.toLowerCase())
          : formatList;

        // deault first get from cache store
        uniqueList.map(({ address, type, brandName }) => {
          const account = address.toLowerCase();
          const cacheData = preferenceService.getAddressBalance(account);
          if (uniqueList.find(o => isSameAddress(o.address, account))) {
            cacheBalancesArr.push({
              address: account,
              balance: cacheData?.total_usd_value || 0,
              evmBalance: cacheData?.evm_usd_value || 0,
              type,
              brandName,
            });
          }
        });
        setBalanceCacheAccounts(cacheBalancesArr);
        setBalanceAccounts(cacheBalancesArr);

        if (fetchType === 'from_api') {
          setLoading(prev => ({ ...prev, loadBalanceFromApiStage: 'loading' }));
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
                    evmBalance: resData?.evm_usd_value || 0,
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
                    evmBalance: cacheData?.evm_usd_value || 0,
                    type,
                    brandName,
                  });
                }
              }
            });
          }
          await waitQueueFinished(queue);
          setBalanceAccounts(queueBalanceArr);
          setLoading(prev => ({
            ...prev,
            loadBalanceFromApiStage: 'finished',
          }));
        }
      } catch (e) {
        console.error('fetchTotalBalance  error', e);
      } finally {
        setLoading(prev => ({
          ...prev,
          balanceLoading: false,
          loadBalanceFromApiStage: 'idle',
        }));
      }
    },
    [
      // getBalanceLoading,
      accountsNoUnique,
      // setLoading,
      // setAccountsLength,
      // setBalanceCacheAccounts,
      // setBalanceAccounts,
    ],
  );

  const triggerUpdate = useCallback(
    async (forceFromApi?: boolean) => {
      // if (isNeedFetchData() || forceFromApi) {
      //   fetchTotalBalance();
      // }
      const isForceFetchFromApi = isNeedFetchData() || forceFromApi;
      console.log(
        'triggerUpdate fetchTotalBalance',
        isForceFetchFromApi ? 'from_api' : 'from_cache',
      );
      if (forceFromApi) {
        lastTimeStamps.current = Date.now();
      }
      fetchTotalBalance(isForceFetchFromApi ? 'from_api' : 'from_cache');
    },
    [fetchTotalBalance, isNeedFetchData],
  );

  const getTotalBalance = useCallback(
    (addresses: string[]) => {
      let total = 0;
      let totalEvm = 0;
      addresses.forEach(address => {
        const account = balanceAccounts.find(item =>
          isSameAddress(item.address, address.toLowerCase()),
        );
        total += Number(account?.balance) || 0;
        totalEvm += Number(account?.evmBalance) || 0;
      });
      return { total, totalEvm };
    },
    [balanceAccounts],
  );

  return {
    balanceAccounts,
    balanceCacheAccounts,
    accountsLength, // maybe has some same address with other type
    triggerUpdate,
    balanceLoading,
    loadBalanceFromApiStage,
    getTotalBalance,
  };
}
