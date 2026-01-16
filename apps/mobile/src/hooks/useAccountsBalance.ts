import { useCallback, useMemo, useRef, useState } from 'react';
import { apiBalance } from '@/core/apis';
import { keyringService, preferenceService } from '@/core/services';
import { KEYRING_CLASS, KeyringTypeName } from '@rabby-wallet/keyring-utils';
import PQueue from 'p-queue';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { unionBy } from 'lodash';
import { zCreate, zMutative } from '@/core/utils/reexports';
import {
  resolveValFromUpdater,
  runIIFEFunc,
  UpdaterOrPartials,
} from '@/core/utils/store';
import { perfEvents } from '@/core/utils/perf';
import { HOME_REFRESH_INTERVAL } from '@/constant/home';
import { makeSWRKeyAsyncFunc } from '@/core/utils/concurrency';
import { getAccountList, getTop10MyAccounts } from '@/core/apis/account';
import { Account } from '@/core/services/preference';
import { EvmTotalBalanceResponse } from '@/databases/hooks/balance';

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

export type AccountsBalanceState = {
  balance: Record<string, BalanceAccountType>;
  notMatteredBalance: Record<string, BalanceAccountType>;
  /** @deprecated */
  // balanceCache: Record<string, BalanceAccountType>;
  matteredAccountLength: number;
};
const balanceStore = zCreate(
  zMutative<AccountsBalanceState>(() => ({
    balance: {},
    notMatteredBalance: {},
    matteredAccountLength: 0,
  })),
);

runIIFEFunc(() => {
  perfEvents.once('USER_MANUALLY_UNLOCK', () => {
    getTop10MyAccounts().then(({ top10Accounts }) => {
      const result = top10Accounts.reduce((acc, account) => {
        const lcAddr = account.address.toLowerCase();
        const cacheData = preferenceService.getAddressBalance(lcAddr);
        acc[lcAddr] = makeAccountBalanceFromCache(account, {
          res: cacheData,
          notMattered: false,
        });

        return acc;
      }, {} as Record<string, BalanceAccountType>);

      setAccountsBalance(result);
    });
  });
});

export function getBalanceCacheAccounts() {
  return balanceStore.getState().balance;
}

export function useBalanceAccounts() {
  return {
    balanceAccounts: balanceStore(s => s.balance),
  };
}

function setAccountsBalance(
  valOrFunc: UpdaterOrPartials<AccountsBalanceState['balance']>,
  options?: { notMattered?: boolean; setFromRemoteApi?: boolean },
) {
  const { notMattered = false, setFromRemoteApi } = options || {};
  if (!notMattered) {
    balanceStore.setState(prev => {
      const { newVal, changed, isChangedObjectInput } = resolveValFromUpdater(
        prev.balance,
        valOrFunc,
        {
          strict: true,
        },
      );

      if (changed || isChangedObjectInput) {
        setTimeout(() => {
          perfEvents.emit('ACCOUNTS_BALANCE_UPDATE', {
            prevState: prev.balance,
            nextState: newVal,
            setFromRemoteApi: setFromRemoteApi,
          });
        }, 0);
      }

      if (!changed) return prev;

      prev.balance = newVal;
    });
  } else {
    balanceStore.setState(prev => {
      const { newVal, changed } = resolveValFromUpdater(
        prev.notMatteredBalance,
        valOrFunc,
        {
          strict: true,
        },
      );
      if (!changed) return prev;

      prev.notMatteredBalance = newVal;
    });
  }
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

export function useLoadBalanceFromApiStage() {
  const loadBalanceFromApiStage = balanceLoadingStore(
    s => s.loadBalanceFromApiStage,
  );

  return { loadBalanceFromApiStage };
}

function computeTotalBalance(
  addresses: string[],
  balanceAccounts: AccountsBalanceState['balance'] = balanceStore.getState()
    .balance,
) {
  let total = 0;
  let totalEvm = 0;

  addresses.forEach(address => {
    const account = balanceAccounts[address.toLowerCase()];
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

    return balanceAccounts[address.toLowerCase()];
  },
};

function makeAccountBalanceFromCache(
  account: Account,
  options?: {
    res?: EvmTotalBalanceResponse | null;
    notMattered: boolean;
  },
) {
  const { res = null, notMattered = false } = options || {};
  const lcAddr = account.address.toLowerCase();
  const cacheData = res || preferenceService.getAddressBalance(lcAddr);

  const accountBalance = {
    address: lcAddr,
    balance: cacheData?.total_usd_value || 0,
    evmBalance: cacheData?.evm_usd_value || 0,
    type: account.type,
    brandName: account.brandName,
  };

  balanceStore.setState(prev => {
    if (!notMattered) {
      prev.balance[lcAddr] = accountBalance;
    } else {
      prev.notMatteredBalance[lcAddr] = accountBalance;
    }
  });

  return accountBalance;
}

async function fetchAccountsBalanceFromApi(
  accounts: Account[],
  options?: {
    retBalance?: Record<string, BalanceAccountType>;
    notMattered?: boolean;
  },
) {
  const { retBalance = {}, notMattered = false } = options || {};
  // get from server api by queue
  const queue = new PQueue({ interval: 2000, intervalCap: 10 });
  for (let i = 0; i < accounts.length; i++) {
    if (!accounts[i]) continue;
    const account = accounts[i]!;
    const { type, address, brandName } = account;
    const lcAddr = address.toLowerCase();
    // batch fetch by queue
    queue.add(async () => {
      try {
        const resData = await apiBalance.getAddressBalance(lcAddr, {
          force: true,
        });
        retBalance[lcAddr] = makeAccountBalanceFromCache(account, {
          res: resData,
          notMattered,
        });
      } catch (e) {
        console.error('fetchTotalBalance error', e);
        // api fetch error fallback get from cache store
        retBalance[lcAddr] = makeAccountBalanceFromCache(account, {
          notMattered,
        });
      }
    });
  }
  await waitQueueFinished(queue);

  return { retBalance };
}

export const fetchTotalBalance = makeSWRKeyAsyncFunc(
  async (fetchType: 'from_cache' | 'from_api' | 'not_mattered:from_api') => {
    const retBalances = {} as Record<string, BalanceAccountType>;
    try {
      setLoading(prev => ({ ...prev, balanceLoading: true }));
      console.debug('[perf] fetchTotalBalance:: fetchType', fetchType);

      let caredAccounts = [] as Account[];
      if (fetchType === 'from_api' || fetchType === 'from_cache') {
        const { sortedAccounts } = await getAccountList({ filter: 'onlyMine' });
        caredAccounts = sortedAccounts;
      } else if (fetchType === 'not_mattered:from_api') {
        const { accounts } = await getAccountList({ filter: 'onlyOthers' });
        caredAccounts = accounts;
      }
      const uniqueList = unionBy(caredAccounts, account =>
        account.address.toLowerCase(),
      );
      const notMattered = fetchType === 'not_mattered:from_api';
      // first get from cache store
      uniqueList.map(account => {
        const lcAddr = account.address.toLowerCase();
        const cacheData = preferenceService.getAddressBalance(lcAddr);
        retBalances[lcAddr] = makeAccountBalanceFromCache(account, {
          res: cacheData,
          notMattered,
        });
      });
      setAccountsBalance(retBalances, { notMattered });

      switch (fetchType) {
        case 'from_api': {
          const top10Accounts = uniqueList.slice(0, 10);
          setLoading(prev => ({ ...prev, loadBalanceFromApiStage: 'loading' }));
          const { retBalance } = await fetchAccountsBalanceFromApi(
            top10Accounts,
            { notMattered: false },
          );
          setAccountsBalance(retBalance, {
            notMattered: false,
            setFromRemoteApi: true,
          });
          setLoading(prev => ({
            ...prev,
            loadBalanceFromApiStage: 'finished',
          }));
        }
        case 'not_mattered:from_api': {
          const top10Accounts = uniqueList.slice(0, 10);
          const { retBalance } = await fetchAccountsBalanceFromApi(
            top10Accounts,
            { notMattered: true },
          );
          setAccountsBalance(retBalance, { notMattered: true });
          break;
        }
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

    return retBalances;
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

  const { triggerUpdate } = useAccountsBalanceTrigger();

  const getTotalBalance = useCallback(
    (addresses: string[]) => {
      let total = 0;
      let totalEvm = 0;
      addresses.forEach(address => {
        const account = balanceAccounts[address.toLowerCase()];
        total += Number(account?.balance) || 0;
        totalEvm += Number(account?.evmBalance) || 0;
      });
      return { total, totalEvm };
    },
    [balanceAccounts],
  );

  return {
    balanceAccounts,
    triggerUpdate,
    getTotalBalance,
  };
}

// const accountsBalanceStatics = zCreate(
//   zMutative<{
//     /** @future */
//     top10AccountsTotalBalance: number;
//   }>(() => ({
//     top10AccountsTotalBalance: 0,
//   })),
// )

// export function useTop10AccountsTotalBalance() {
//   const top10AccountsTotalBalance = accountsBalanceStatics(
//     s => s.top10AccountsTotalBalance,
//   );

//   return {
//     top10AccountsTotalBalance,
//   };
// }

// runIIFEFunc(() => {
//   perfEvents.subscribe('ACCOUNTS_MAYBE_CHANGED', async () => {
//     getTop10MyAccounts().then(({ top10Accounts }) => {
//       const result = getLatestTotalBalance(
//         top10Accounts
//           .slice(0, 10)
//           .map(acc => acc.address)
//       );

//       accountsBalanceStatics.setState(prev => {
//         prev.top10AccountsTotalBalance = result.total;
//       });
//     });
//   });
// });
