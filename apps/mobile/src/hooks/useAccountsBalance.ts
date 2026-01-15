import { useCallback, useRef } from 'react';
import { KeyringTypeName } from '@rabby-wallet/keyring-utils';
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
import balanceStore, { IBalanceData } from '@/store/balance';

export interface BalanceAccountType {
  address: string;
  balance: number;
  evmBalance: number;
  type: KeyringTypeName;
  brandName: string;
  alias?: string;
  aliasName?: string;
}

export type AccountsBalanceState = {
  balance: Record<string, BalanceAccountType>;
  /** @deprecated */
  // balanceCache: Record<string, BalanceAccountType>;
  matteredAccountLength: number;
};
export const balanceAccountsStore = zCreate(
  zMutative<AccountsBalanceState>(() => ({
    balance: {},
    matteredAccountLength: 0,
  })),
);

const buildBalanceAccountsFromList = (
  accounts: Account[],
  balanceMap: Record<string, IBalanceData>,
) => {
  return accounts.reduce((acc, account) => {
    const lcAddr = account.address.toLowerCase();
    const balance = balanceMap[lcAddr];
    acc[lcAddr] = {
      address: lcAddr,
      balance: balance?.totalBalance || 0,
      evmBalance: balance?.evmBalance || 0,
      type: account.type,
      brandName: account.brandName,
      aliasName: account.aliasName,
    };

    return acc;
  }, {} as AccountsBalanceState['balance']);
};

runIIFEFunc(() => {
  perfEvents.once('USER_MANUALLY_UNLOCK', () => {
    getTop10MyAccounts().then(async ({ top10Accounts }) => {
      const addresses = top10Accounts.map(account =>
        account.address.toLowerCase(),
      );
      await balanceStore.getState().batchGetTotalBalance(addresses, false);
      const balanceMap = balanceStore.getState().balanceMap;
      const result = buildBalanceAccountsFromList(top10Accounts, balanceMap);
      setAccountsBalance(result);
    });
  });
});

export function getBalanceCacheAccounts() {
  return balanceAccountsStore.getState().balance;
}

export function useBalanceAccounts() {
  return {
    balanceAccounts: balanceAccountsStore(s => s.balance),
  };
}

function setAccountsBalance(
  valOrFunc: UpdaterOrPartials<AccountsBalanceState['balance']>,
) {
  balanceAccountsStore.setState(prev => {
    const { newVal, changed, isChangedObjectInput } = resolveValFromUpdater(
      prev.balance,
      valOrFunc,
      {
        strict: true,
      },
    );
    if (!changed) return prev;

    prev.balance = newVal;
  });
}

export function useLoadBalanceFromApiStage() {
  const isLoading = balanceStore(s =>
    Object.values(s.isLoadingByAddress).some(Boolean),
  );
  const loadBalanceFromApiStage: LoadBalanceStage = isLoading
    ? 'loading'
    : 'finished';

  return { loadBalanceFromApiStage };
}

function computeTotalBalance(
  addresses: string[],
  balanceAccounts?: AccountsBalanceState['balance'],
) {
  let total = 0;
  let totalEvm = 0;
  if (!balanceAccounts) {
    balanceAccounts = balanceAccountsStore.getState().balance;
  }
  addresses.forEach(address => {
    const account = balanceAccounts[address.toLowerCase()];
    total += Number(account?.balance) || 0;
    totalEvm += Number(account?.evmBalance) || 0;
  });

  return { total, totalEvm };
}

export const apisAccountsBalance = {
  computeTotalBalance,
};

export const fetchTotalBalance = makeSWRKeyAsyncFunc(
  async (fetchType: 'from_cache' | 'from_api') => {
    const retBalances = {} as Record<string, BalanceAccountType>;
    try {
      console.debug('[perf] fetchTotalBalance:: fetchType', fetchType);

      let caredAccounts = [] as Account[];
      const { sortedAccounts } = await getAccountList({ filter: 'onlyMine' });
      caredAccounts = sortedAccounts;
      const uniqueList = unionBy(caredAccounts, account =>
        account.address.toLowerCase(),
      );
      const addresses = uniqueList.map(account =>
        account.address.toLowerCase(),
      );
      if (addresses.length) {
        await balanceStore.getState().batchGetTotalBalance(addresses, false);
      }

      if (fetchType === 'from_api') {
        const top10Accounts = uniqueList.slice(0, 10);
        if (top10Accounts.length) {
          await balanceStore.getState().batchGetTotalBalance(
            top10Accounts.map(account => account.address.toLowerCase()),
            true,
          );
        }
      }

      const balanceMap = balanceStore.getState().balanceMap;
      Object.assign(
        retBalances,
        buildBalanceAccountsFromList(uniqueList, balanceMap),
      );
      setAccountsBalance(retBalances);
    } catch (e) {
      console.error('fetchTotalBalance  error', e);
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
  const balanceAccounts = balanceAccountsStore(s => s.balance);
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
