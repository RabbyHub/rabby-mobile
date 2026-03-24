import { useCallback, useRef } from 'react';
import { KeyringTypeName } from '@rabby-wallet/keyring-utils';
import { unionBy } from 'lodash';
import { zCreate, zMutative } from '@/core/utils/reexports';
import { resolveValFromUpdater, UpdaterOrPartials } from '@/core/utils/store';
import { HOME_REFRESH_INTERVAL } from '@/constant/home';
import { makeSWRKeyAsyncFunc } from '@/core/utils/concurrency';
import { filterOutTop10Accounts, getAccountList } from '@/core/apis/account';
import { Account } from '@/core/services/preference';
import balanceStore, { IBalanceData } from '@/store/balance';
import { perfEvents } from '@/core/utils/perf';
import { makeJsEEClass } from '@/core/services/_utils';
import accountStore from '@/store/account';

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
  selectedAddresses: string[];
  /** @deprecated */
  // balanceCache: Record<string, BalanceAccountType>;
  matteredAccountLength: number;
};
export const balanceAccountsStore = zCreate(
  zMutative<AccountsBalanceState>(() => ({
    balance: {},
    selectedAddresses: [],
    matteredAccountLength: 0,
  })),
);

type AccountsBalanceChangeSource =
  | 'manual_refresh'
  | 'balance_changed'
  | 'accounts_changed';

type AccountsBalanceEventBusListeners = {
  SELECTION_CHANGED: (ctx: {
    prevAddresses: string[];
    nextAddresses: string[];
    balance: AccountsBalanceState['balance'];
    matteredAccountLength: number;
    source: AccountsBalanceChangeSource;
  }) => void;
  BALANCE_CHANGED: (ctx: {
    addresses: string[];
    changedAddresses: string[];
    balance: AccountsBalanceState['balance'];
    source: AccountsBalanceChangeSource;
  }) => void;
};

const { EventEmitter: AccountsBalanceEE } =
  makeJsEEClass<AccountsBalanceEventBusListeners>();
export const accountsBalanceEvents = new AccountsBalanceEE();

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

export const syncBalanceAccountStore = () => {
  const state = balanceAccountsStore.getState();
  if (!state.selectedAddresses.length) return;
  const nextBalance = buildBalanceAccountsFromSelectedState(
    state.balance,
    balanceStore.getState().balanceMap,
    state.selectedAddresses,
  );

  setAccountsBalanceState(
    {
      balance: nextBalance,
    },
    {
      source: 'balance_changed',
    },
  );
};

function areAddressListsEqual(prev: string[], next: string[]) {
  if (prev.length !== next.length) {
    return false;
  }

  return prev.every((address, index) => address === next[index]);
}

function getChangedBalanceAddresses(
  prevBalance: AccountsBalanceState['balance'],
  nextBalance: AccountsBalanceState['balance'],
  selectedAddresses: string[],
) {
  return selectedAddresses.filter(address => {
    const prev = prevBalance[address];
    const next = nextBalance[address];

    return (
      prev?.balance !== next?.balance || prev?.evmBalance !== next?.evmBalance
    );
  });
}

function setAccountsBalanceState(
  valOrFunc: UpdaterOrPartials<AccountsBalanceState>,
  meta?: {
    source: AccountsBalanceChangeSource;
  },
) {
  const prevState = balanceAccountsStore.getState();
  balanceAccountsStore.setState(prev => {
    const { newVal, changed } = resolveValFromUpdater(prev, valOrFunc, {
      strict: true,
    });
    if (!changed) return prev;

    return newVal;
  });

  const nextState = balanceAccountsStore.getState();
  if (nextState === prevState || !meta) {
    return;
  }

  const selectionChanged = !areAddressListsEqual(
    prevState.selectedAddresses,
    nextState.selectedAddresses,
  );
  const changedAddresses = getChangedBalanceAddresses(
    prevState.balance,
    nextState.balance,
    nextState.selectedAddresses,
  );

  if (selectionChanged) {
    accountsBalanceEvents.emit('SELECTION_CHANGED', {
      prevAddresses: prevState.selectedAddresses,
      nextAddresses: nextState.selectedAddresses,
      balance: nextState.balance,
      matteredAccountLength: nextState.matteredAccountLength,
      source: meta.source,
    });
  }

  if (changedAddresses.length) {
    accountsBalanceEvents.emit('BALANCE_CHANGED', {
      addresses: nextState.selectedAddresses,
      changedAddresses,
      balance: nextState.balance,
      source: meta.source,
    });
  }
}

function buildBalanceAccountsFromSelectedState(
  current: AccountsBalanceState['balance'],
  balanceMap: Record<string, IBalanceData>,
  selectedAddresses: string[],
) {
  return selectedAddresses.reduce((acc, address) => {
    const prev = current[address];
    const latest = balanceMap[address];

    acc[address] = {
      address,
      balance: latest?.totalBalance || 0,
      evmBalance: latest?.evmBalance || 0,
      type: prev?.type || ('' as KeyringTypeName),
      brandName: prev?.brandName || '',
      aliasName: prev?.aliasName,
    };

    return acc;
  }, {} as AccountsBalanceState['balance']);
}

async function getMatteredAccountsSnapshot() {
  const { sortedAccounts } = await getAccountList({ filter: 'onlyMine' });
  const matteredAccountLength = sortedAccounts.length;
  const { top10Accounts } = filterOutTop10Accounts(sortedAccounts, {
    gatherSameAddress: false,
  });
  const selectedAccounts = unionBy(top10Accounts, account =>
    account.address.toLowerCase(),
  );
  const selectedAddresses = selectedAccounts.map(account =>
    account.address.toLowerCase(),
  );

  return {
    selectedAccounts,
    selectedAddresses,
    matteredAccountLength,
  };
}

export function startProcessAccountBalanceEvents() {
  perfEvents.subscribe('USER_MANUALLY_UNLOCK', async () => {
    syncBalanceAccountStore();
  });

  balanceStore.subscribe(state => {
    const current = balanceAccountsStore.getState();
    if (!current.selectedAddresses.length) return;

    const nextBalance = buildBalanceAccountsFromSelectedState(
      current.balance,
      state.balanceMap,
      current.selectedAddresses,
    );

    setAccountsBalanceState(
      {
        ...current,
        balance: nextBalance,
      },
      {
        source: 'balance_changed',
      },
    );
  });

  let prevSelectionSignature = '';
  const syncSelectionFromAccounts = async () => {
    const { selectedAccounts, selectedAddresses, matteredAccountLength } =
      await getMatteredAccountsSnapshot();
    const nextBalance = buildBalanceAccountsFromList(
      selectedAccounts,
      balanceStore.getState().balanceMap,
    );

    setAccountsBalanceState(
      prev => ({
        ...prev,
        balance: nextBalance,
        selectedAddresses,
        matteredAccountLength,
      }),
      {
        source: 'accounts_changed',
      },
    );
  };

  accountStore.subscribe(state => {
    const accountsSignature = state.accounts
      .map(
        account =>
          `${account.address.toLowerCase()}::${account.type}::${
            account.brandName
          }`,
      )
      .sort()
      .join('|');
    const pinSignature = state.pinnedAddresses
      .map(item => `${item.address.toLowerCase()}::${item.brandName}`)
      .join('|');
    const nextSignature = `${accountsSignature}##${pinSignature}`;

    if (nextSignature === prevSelectionSignature) {
      return;
    }

    prevSelectionSignature = nextSignature;
    syncSelectionFromAccounts();
  });

  syncSelectionFromAccounts();
}

export function getBalanceCacheAccounts() {
  return balanceAccountsStore.getState().balance;
}

export function useBalanceAccounts() {
  return {
    balanceAccounts: balanceAccountsStore(s => s.balance),
  };
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
      const selectedAccounts = uniqueList.slice(0, 10);
      const selectedAddresses = selectedAccounts.map(account =>
        account.address.toLowerCase(),
      );

      if (selectedAccounts.length) {
        if (fetchType === 'from_api') {
          await balanceStore
            .getState()
            .batchGetTotalBalance(selectedAddresses, true);
        } else {
          await balanceStore
            .getState()
            .batchGetTotalBalance(selectedAddresses, false);
        }
      }

      const balanceMap = balanceStore.getState().balanceMap;
      Object.assign(
        retBalances,
        buildBalanceAccountsFromList(selectedAccounts, balanceMap),
      );
      setAccountsBalanceState(
        {
          balance: retBalances,
          selectedAddresses,
          matteredAccountLength: caredAccounts.length,
        },
        {
          source: 'manual_refresh',
        },
      );
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
    getTotalBalance,
  };
}
