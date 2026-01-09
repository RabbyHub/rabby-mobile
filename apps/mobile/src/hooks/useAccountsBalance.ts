import { useCallback, useRef, useState } from 'react';
import { apiBalance } from '@/core/apis';
import { keyringService, preferenceService } from '@/core/services';
import { KEYRING_CLASS, KeyringTypeName } from '@rabby-wallet/keyring-utils';
import PQueue from 'p-queue';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { unionBy } from 'lodash';
import { zCreate } from '@/core/utils/reexports';
import { resolveValFromUpdater, UpdaterOrPartials } from '@/core/utils/store';
import { perfEvents } from '@/core/utils/perf';
import { HOME_REFRESH_INTERVAL } from '@/constant/home';
import { makeSWRKeyAsyncFunc } from '@/core/utils/concurrency';

export interface BalanceAccountType {
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
  balance: BalanceAccountType[];
  balanceCache: BalanceAccountType[];
  matteredAccountLength: number;
};
const balanceStore = zCreate<BalanceState>(() => ({
  balance: [],
  balanceCache: [],
  matteredAccountLength: 0,
}));

export function getBalanceCacheAccounts() {
  return balanceStore.getState().balanceCache;
}

export function useBalanceAccounts() {
  return {
    balanceAccounts: balanceStore(s => s.balance),
  };
}

function setBalanceAccounts(
  valOrFunc: UpdaterOrPartials<BalanceAccountType[]>,
) {
  balanceStore.setState(prev => {
    const { newVal, changed } = resolveValFromUpdater(prev.balance, valOrFunc, {
      strict: true,
    });
    if (!changed) return prev;

    perfEvents.emit('ACCOUNTS_BALANCE_UPDATE', {
      prevState: prev.balance,
      nextState: newVal,
    });

    return { ...prev, balance: newVal };
  });
}

function setBalanceCacheAccounts(
  valOrFunc: UpdaterOrPartials<BalanceAccountType[]>,
) {
  balanceStore.setState(prev => {
    const { newVal, changed } = resolveValFromUpdater(
      prev.balanceCache,
      valOrFunc,
      { strict: true },
    );
    if (!changed) return prev;

    return { ...prev, balanceCache: newVal };
  });
}

function setAccountsLength(valOrFunc: UpdaterOrPartials<number>) {
  balanceStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(
      prev.matteredAccountLength,
      valOrFunc,
    );

    return { ...prev, matteredAccountLength: newVal };
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
// function getBalanceLoading() {
//   return balanceLoadingStore.getState().balanceLoading;
// }

export function useLoadBalanceFromApiStage() {
  const loadBalanceFromApiStage = balanceLoadingStore(
    s => s.loadBalanceFromApiStage,
  );

  return { loadBalanceFromApiStage };
}

function computeTotalBalance(
  addresses: string[],
  balanceAccounts: BalanceAccountType[],
) {
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
}

function getLatestTotalBalance(addresses: string[]) {
  const balanceAccounts = balanceStore.getState().balance;

  return computeTotalBalance(addresses, balanceAccounts);
}

export const apisAccountsBalance = {
  computeTotalBalance,
  getLatestTotalBalance,
  getBalanceByAddress: (address: string) => {
    const balanceAccounts = balanceStore.getState().balance;

    return balanceAccounts.find(item =>
      isSameAddress(item.address, address.toLowerCase()),
    );
  },
};

export const fetchTotalBalance = makeSWRKeyAsyncFunc(
  async (fetchType: 'from_cache' | 'from_api') => {
    const retBalancesArr = [] as BalanceAccountType[];
    try {
      // if (getBalanceLoading()) {
      //   console.log('fetchTotalBalance loading return');
      //   // return;
      // }
      setLoading(prev => ({ ...prev, balanceLoading: true }));
      // batch update

      const list = await keyringService.getAllVisibleAccountsArray();

      const formatList = list.filter(
        a =>
          a.type !== KEYRING_CLASS.WATCH &&
          a.type !== KEYRING_CLASS.GNOSIS &&
          a.type !== KEYRING_CLASS.WALLETCONNECT,
      );
      // .map(a => a.address.toLowerCase());

      setAccountsLength(formatList.length);

      const uniqueList = unionBy(formatList, account =>
        account.address.toLowerCase(),
      );

      // deault first get from cache store
      uniqueList.map(({ address, type, brandName }) => {
        const account = address.toLowerCase();
        const cacheData = preferenceService.getAddressBalance(account);
        if (uniqueList.find(o => isSameAddress(o.address, account))) {
          retBalancesArr.push({
            address: account,
            balance: cacheData?.total_usd_value || 0,
            evmBalance: cacheData?.evm_usd_value || 0,
            type,
            brandName,
          });
        }
      });
      setBalanceCacheAccounts(retBalancesArr);
      setBalanceAccounts(retBalancesArr);

      if (fetchType === 'from_api') {
        setLoading(prev => ({ ...prev, loadBalanceFromApiStage: 'loading' }));
        const queueBalanceArr = [] as BalanceAccountType[];
        // get from server api by queue
        const queue = new PQueue({
          interval: 2000,
          intervalCap: 10,
        });
        for (let i = 0; i < uniqueList.length; i++) {
          if (!uniqueList[i]) continue;
          const { type, address, brandName } = uniqueList[i]!;
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

    return retBalancesArr;
  },
  ctx => {
    return `fetchTotalBalance-${ctx.args[0]}`;
  },
);

const CACHE_TIME = HOME_REFRESH_INTERVAL; // 10 minutes
export type LoadBalanceStage = 'idle' | 'loading' | 'finished';
export function useAccountsBalanceTrigger() {
  const lastTimeStamps = useRef<number>(0);

  const isNeedFetchData = useCallback(() => {
    const currentTime = Date.now();
    const diff = currentTime - lastTimeStamps.current;
    if (diff > CACHE_TIME) {
      lastTimeStamps.current = currentTime;
      return true;
    }
    return false;
  }, []);

  const triggerUpdate = useCallback(
    async (forceFromApi?: boolean) => {
      // if (isNeedFetchData() || forceFromApi) {
      //   fetchTotalBalance();
      // }
      const isForceFetchFromApi = isNeedFetchData() || forceFromApi;
      console.debug(
        '[perf] triggerUpdate fetchTotalBalance',
        isForceFetchFromApi ? 'from_api' : 'from_cache',
      );
      if (forceFromApi) {
        lastTimeStamps.current = Date.now();
      }
      return fetchTotalBalance(isForceFetchFromApi ? 'from_api' : 'from_cache');
    },
    [isNeedFetchData],
  );

  return {
    triggerUpdate,
  };
}

export default function useAccountsBalance() {
  const balanceAccounts = balanceStore(s => s.balance);
  const balanceCacheAccounts = balanceStore(s => s.balanceCache);
  const accountsLength = balanceStore(s => s.matteredAccountLength);

  const { triggerUpdate } = useAccountsBalanceTrigger();

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
    getTotalBalance,
  };
}
