import React, { useRef, useCallback, useEffect, useMemo } from 'react';

import {
  KeyringAccount,
  CORE_KEYRING_TYPES,
  KEYRING_TYPE,
} from '@rabby-wallet/keyring-utils';

import {
  keyringService,
  preferenceService,
  transactionHistoryService,
} from '@/core/services';
import { removeAddress } from '@/core/apis/address';
import { Account, IPinAddress } from '@/core/services/preference';
import { getWalletIcon } from '@/utils/walletInfo';
import { TotalBalanceResponse } from '@rabby-wallet/rabby-api/dist/types';
import {
  DisplayChainWithWhiteLogo,
  formatChainToDisplay,
  varyAndSortChainItems,
} from '@/utils/chain';
import { CHAINS_ENUM, Chain } from '@/constant/chains';
import { coerceFloat } from '@/utils/number';
import { requestOpenApiMultipleNets } from '@/utils/openapi';
import * as apiBalance from '@/core/apis/balance';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { deleteDBResourceForAddress } from '@/databases/sync/assets';
import { filterMyAccounts } from '@/utils/account';
import { isEqual, unionBy } from 'lodash';
import { BalanceEntity } from '@/databases/entities/balance';
import { updateHistoryTimeSingleAddress } from './historyTokenDict';
import { useCreationWithShallowCompare } from './common/useMemozied';
import { matomoRequestEvent } from '@/utils/analytics';
import {
  accountEvents,
  fetchAllAccounts,
  KeyringAccountWithAlias,
} from '@/core/apis/account';
import { zCreate } from '@/core/utils/reexports';
import {
  resolveValFromUpdater,
  runIIFEFunc,
  UpdaterOrPartials,
} from '@/core/utils/store';
import { EVENT_SWITCH_ACCOUNT, eventBus } from '@/utils/events';
import { useBalanceAccounts } from './useAccountsBalance';
import { perfEvents } from '@/core/utils/perf';
import { AccountInfoEntity } from '@/databases/entities/accountInfo';
import { EntityAccountBase } from '@/databases/entities/base';
import { ormEvents } from '@/databases/entities/_helpers';

export type { KeyringAccountWithAlias as /** @deprecated */ KeyringAccountWithAlias };

type Store = {
  accounts: KeyringAccountWithAlias[];
  fetchingAccounts: boolean;
  pinnedAddresses: IPinAddress[];
  currentAccount: KeyringAccountWithAlias | null;

  newlyAddedAccounts: Record<
    AccountInfoEntity['_db_id'],
    Awaited<ReturnType<typeof AccountInfoEntity.getAccountsAddedIn>>[0]
  >;
};
const zAccountStore = zCreate<Store>((set, get) => {
  return {
    accounts: [],
    fetchingAccounts: false,

    pinnedAddresses: preferenceService.getPinAddresses(),
    currentAccount: null,

    newlyAddedAccounts: {},
  };
});

const fetchAndSet = (options?: { confirmChanged?: boolean }) => {
  fetchAllAccounts().then(accounts => {
    setAccounts(accounts);
  });
};

async function fetchNewlyAddedAccounts() {
  return AccountInfoEntity.getAccountsAddedIn(
    NEWLY_ADDED_ACCOUNT_DURATION,
  ).then(accounts => {
    zAccountStore.setState(prev => {
      const newVal = accounts.reduce((accu, cur) => {
        accu[cur._db_id] = cur;
        return accu;
      }, {} as Store['newlyAddedAccounts']);

      if (isEqual(prev.newlyAddedAccounts, newVal)) return prev;

      return {
        ...prev,
        newlyAddedAccounts: newVal,
      };
    });

    return accounts;
  });
}

const NEWLY_ADDED_ACCOUNT_DURATION = 10 * 60 * 1000;

export function useIsNewlyAddedAccount(account: KeyringAccount) {
  const dbId = useMemo(() => {
    return EntityAccountBase.buildDBId({
      address: account.address,
      type: account.type,
      brandName: account.brandName,
    });
  }, [account.address, account.type, account.brandName]);
  const newlyAddedAccount = zAccountStore(
    s => s.newlyAddedAccounts[dbId] ?? null,
  );

  return {
    newlyAddedAccount,
    isNewlyAdded:
      !!newlyAddedAccount &&
      Date.now() - newlyAddedAccount.updated_at <= NEWLY_ADDED_ACCOUNT_DURATION,
  };
}

export function useDevNewlyAddedAccounts() {
  const newlyAddedAccounts = zAccountStore(s => s.newlyAddedAccounts);
  return {
    newlyAddedAccounts: useMemo(
      () => Object.values(newlyAddedAccounts),
      [newlyAddedAccounts],
    ),
  };
}

export function startManageAccountStoreLifecycle() {
  keyringService.once('unlock', () => {
    fetchAndSet();
  });

  keyringService.on('newAccount', (account: Account) => {
    fetchAndSet();
  });
  // removedAccount
  keyringService.on('removedAccount', async (account: Account) => {
    fetchAndSet();

    await AccountInfoEntity.deleteByAccount(account);
    await fetchNewlyAddedAccounts();
  });

  keyringService.store.subscribe(state => {
    if (state.booted && state.vault) {
      fetchAndSet();
    }
  });

  accountEvents.on('ACCOUNT_ADDED', async ({ accounts, scene }) => {
    await AccountInfoEntity.recordNewAccount(accounts);
    await fetchNewlyAddedAccounts();
  });

  ormEvents.on(`account_info:removed`, () => {
    fetchNewlyAddedAccounts();
  });

  fetchNewlyAddedAccounts();
  setInterval(() => {
    fetchNewlyAddedAccounts();
  }, 10 * 1e3);
}

function setAccounts(valOrFunc: UpdaterOrPartials<Store['accounts']>) {
  zAccountStore.setState(prev => {
    const { newVal, changed } = resolveValFromUpdater(
      prev.accounts,
      valOrFunc,
      { strict: true },
    );

    setTimeout(() => {
      perfEvents.emit('ACCOUNTS_MAYBE_CHANGED', { confirmed: changed });
    }, 0);

    if (changed) {
      return { ...prev, accounts: newVal };
    }

    return prev;
  });
}

export function setCurrentAccount(
  valOrFunc: UpdaterOrPartials<Store['currentAccount']>,
) {
  zAccountStore.setState(prev => {
    const { newVal, changed } = resolveValFromUpdater(
      prev.currentAccount,
      valOrFunc,
      { strict: true },
    );

    if (changed) {
      return { ...prev, currentAccount: newVal };
    }

    return prev;
  });
}
eventBus.on(EVENT_SWITCH_ACCOUNT, v => {
  setCurrentAccount(v);
});

function setPinAddresses(
  valOrFunc: UpdaterOrPartials<Store['pinnedAddresses']>,
) {
  zAccountStore.setState(prev => {
    const { newVal, changed } = resolveValFromUpdater(
      prev.pinnedAddresses,
      valOrFunc,
    );

    if (changed) {
      return { ...prev, pinnedAddresses: newVal };
    }

    return prev;
  });
}

const doFetchAccounts = async () => {
  const nextAccounts = await fetchAllAccounts();
  setAccounts(nextAccounts);

  return nextAccounts;
};

export const storeApisAccounts = {
  fetchAccounts: doFetchAccounts,
  setCurrentCaredAddress,
};

export function useAccounts(opts?: { disableAutoFetch?: boolean }) {
  const accounts = zAccountStore(s => s.accounts);

  const { disableAutoFetch = false } = opts || {};

  useEffect(() => {
    if (!disableAutoFetch) {
      doFetchAccounts();
    }
  }, [disableAutoFetch]);

  const stableAccounts = useCreationWithShallowCompare(() => {
    return accounts;
  }, [accounts]);

  return {
    accounts: stableAccounts,
    fetchAccounts: doFetchAccounts,
  };
}

export const storeApiAccounts = {
  getAccounts() {
    return zAccountStore.getState().accounts;
  },
  getPinAddresses() {
    return zAccountStore.getState().pinnedAddresses;
  },
};

export function useMyAccounts(opts?: { disableAutoFetch?: boolean }) {
  const allAccounts = zAccountStore(s => s.accounts);

  const { disableAutoFetch = false } = opts || {};

  useEffect(() => {
    if (!disableAutoFetch) {
      doFetchAccounts();
    }
  }, [disableAutoFetch]);

  const accounts = useCreationWithShallowCompare(() => {
    return filterMyAccounts(allAccounts);
  }, [allAccounts]);

  return {
    accounts,
    fetchAccounts: doFetchAccounts,
  };
}

export const usePinAddresses = (opts?: { disableAutoFetch?: boolean }) => {
  const { disableAutoFetch = false } = opts || {};
  const pinAddresses = zAccountStore(s => s.pinnedAddresses);

  /**
   * @deprecated
   */
  const getPinAddresses = useCallback(() => {
    const addresses = preferenceService.getPinAddresses();
    setPinAddresses(addresses);
  }, []);

  const getPinAddressesAsync = useCallback(async () => {
    return getPinAddresses();
  }, [getPinAddresses]);

  const togglePinAddressAsync = useCallback(
    (payload: {
      brandName: Account['brandName'];
      address: Account['address'];
      nextPinned?: boolean;
    }) => {
      const allPinAddresses = preferenceService.getPinAddresses();

      const {
        nextPinned = !allPinAddresses.some(
          highlighted =>
            isSameAddress(highlighted.address, payload.address) &&
            highlighted.brandName === payload.brandName,
        ),
      } = payload;

      const addresses = [...allPinAddresses];
      const newItem = {
        brandName: payload.brandName,
        address: payload.address,
      };
      if (nextPinned) {
        addresses.unshift(newItem);
        preferenceService.updatePinAddresses(addresses);
        matomoRequestEvent({
          category: 'Pin Address',
          action: 'PinAddress_Finish',
        });
      } else {
        const toggleIdx = addresses.findIndex(
          addr =>
            addr.brandName === payload.brandName &&
            isSameAddress(addr.address, payload.address),
        );
        if (toggleIdx > -1) {
          addresses.splice(toggleIdx, 1);
        }
        preferenceService.updatePinAddresses(addresses);
      }
      setPinAddresses(addresses);
    },
    [],
  );

  useEffect(() => {
    if (!disableAutoFetch) {
      getPinAddressesAsync();
    }
  }, [disableAutoFetch, getPinAddressesAsync]);

  return {
    pinAddresses,
    getPinAddressesAsync,
    togglePinAddressAsync,
  };
};

export const usePinnedAccountList = () => {
  const pinAddresses = zAccountStore(s => s.pinnedAddresses);
  const accounts = zAccountStore(s => s.accounts);
  const { balanceAccounts } = useBalanceAccounts();

  const pinnedAccountList = useMemo(() => {
    const res: KeyringAccountWithAlias[] = [];
    pinAddresses?.forEach(pinAddr => {
      const item = accounts.find(account => {
        return (
          isSameAddress(pinAddr.address, account.address) &&
          account.brandName === pinAddr.brandName
        );
      });
      if (
        item &&
        ![
          KEYRING_TYPE.GnosisKeyring,
          KEYRING_TYPE.WatchAddressKeyring,
          KEYRING_TYPE.WalletConnectKeyring,
        ].includes(item.type)
      ) {
        const account = balanceAccounts.find(acc =>
          isSameAddress(acc.address, item.address),
        );
        res.push({
          ...item,
          balance: account?.balance || item.balance || 0,
          evmBalance: account?.evmBalance || item.evmBalance || 0,
        });
      }
    });
    return res;
  }, [accounts, balanceAccounts, pinAddresses]);

  return pinnedAccountList;
};

export function useRemoveAccount() {
  const { accounts, fetchAccounts } = useAccounts({ disableAutoFetch: true });
  const { togglePinAddressAsync } = usePinAddresses({ disableAutoFetch: true });
  return useCallback(
    async (account: KeyringAccount) => {
      togglePinAddressAsync({ ...account, nextPinned: false });
      await removeAddress(account);
      await fetchAccounts();
      if (
        accounts.filter(acc => isSameAddress(acc.address, account.address))
          .length === 1
      ) {
        await deleteDBResourceForAddress(account.address);
        updateHistoryTimeSingleAddress(account.address, 0);
        transactionHistoryService.clearSuccessAndFailList(account.address);
      }
    },
    [accounts, fetchAccounts, togglePinAddressAsync],
  );
}

export function useWalletBrandLogo<T extends string>(brandName?: T) {
  const RcWalletIcon = useMemo(() => {
    return getWalletIcon(brandName);
  }, [brandName]) as T extends void
    ? null
    : React.FC<import('react-native-svg').SvgProps>;

  return {
    RcWalletIcon,
  };
}

type MatteredChainBalances = {
  [P in Chain['serverId']]?: DisplayChainWithWhiteLogo;
};
type MatteredBalancesState = {
  matteredChainBalances: MatteredChainBalances;
  testnetMatteredChainBalances: MatteredChainBalances;
};
function getDefaultMatteredBalancesState(): MatteredBalancesState {
  return {
    matteredChainBalances: {},
    testnetMatteredChainBalances: {},
  };
}
type MatteredBalancesStore = Record<string, MatteredBalancesState>;
const addrMatteredBalancesStore = zCreate<{
  currentAddress: string;
  store: MatteredBalancesStore;
}>(() => {
  return {
    currentAddress: '',
    store: {},
  };
});

export function setCurrentCaredAddress(
  address: string,
  options?: { forceFetch?: true },
) {
  const addr = address.toLowerCase();
  addrMatteredBalancesStore.setState(prev => {
    return {
      ...prev,
      currentAddress: address.toLowerCase(),
    };
  });
  const currentAddress = addrMatteredBalancesStore.getState().currentAddress;
  const needFetch =
    options?.forceFetch || address.toLowerCase() !== currentAddress;

  if (needFetch) {
    fetchMatteredChainBalance({ address: addr });
  }
}

function setMattredChainBalancesByAddr(
  addr: string,
  valOrFunc: UpdaterOrPartials<MatteredChainBalances>,
) {
  const address = addr.toLowerCase();
  addrMatteredBalancesStore.setState(prev => {
    const { newVal, changed } = resolveValFromUpdater(
      prev.store[address]?.matteredChainBalances || {},
      valOrFunc,
      { strict: false },
    );

    // if (!changed) return prev;

    return {
      ...prev,
      store: {
        ...prev.store,
        [address]: {
          ...getDefaultMatteredBalancesState(),
          ...prev.store[address],
          matteredChainBalances: newVal,
        },
      },
    };
  });
}

function setTestMattredChainBalances(
  addr: string,
  valOrFunc: UpdaterOrPartials<MatteredChainBalances>,
) {
  const address = addr.toLowerCase();
  addrMatteredBalancesStore.setState(prev => {
    const { newVal, changed } = resolveValFromUpdater(
      prev.store[address]?.testnetMatteredChainBalances || {},
      valOrFunc,
      { strict: false },
    );

    // if (!changed) return prev;

    return {
      ...prev,
      store: {
        ...prev.store,
        [address]: {
          ...getDefaultMatteredBalancesState(),
          ...prev.store[address],
          testnetMatteredChainBalances: newVal,
        },
      },
    };
  });
}

const allMatteredBalancesStore = zCreate<MatteredChainBalances>(() => {
  return {};
});
function setMattredChainBalancesAll(
  valOrFunc: UpdaterOrPartials<MatteredChainBalances>,
) {
  allMatteredBalancesStore.setState(prev => {
    const { newVal, changed } = resolveValFromUpdater(
      prev?.matteredChainBalancesAll || {},
      valOrFunc,
      { strict: false },
    );

    // if (!changed) return prev;

    return newVal;
  });
}

const DEFAULT_MATTERED_BALANCES_STATE = getDefaultMatteredBalancesState();
export function useChainBalances() {
  const matteredChainBalances = addrMatteredBalancesStore(
    s =>
      (s.currentAddress
        ? s.store[s.currentAddress]?.matteredChainBalances
        : null) || DEFAULT_MATTERED_BALANCES_STATE.matteredChainBalances,
  );
  const testnetMatteredChainBalances = addrMatteredBalancesStore(
    s =>
      (s.currentAddress
        ? s.store[s.currentAddress]?.testnetMatteredChainBalances
        : null) || DEFAULT_MATTERED_BALANCES_STATE.testnetMatteredChainBalances,
  );

  return {
    matteredChainBalances,
    testnetMatteredChainBalances,
  };
}

const isShowTestnet = false;

const fetchSingleAddressBalanceFromDb = async (
  address: string,
): Promise<{
  mainnet: TotalBalanceResponse | null;
  testnet: TotalBalanceResponse | null;
}> => {
  return requestOpenApiMultipleNets<
    TotalBalanceResponse | null,
    {
      mainnet: TotalBalanceResponse | null;
      testnet: TotalBalanceResponse | null;
    }
  >(
    ctx => {
      if (!isShowTestnet && ctx.isTestnetTask) {
        return null;
      }
      return BalanceEntity.queryBalance(address, true);
    },
    {
      needTestnetResult: isShowTestnet,
      processResults: ({ mainnet, testnet }) => {
        return {
          mainnet: mainnet,
          testnet: testnet,
        };
      },
      fallbackValues: {
        mainnet: null,
        testnet: null,
      },
    },
  );
};
const fetchAllAddressesChainBalance = async (): Promise<{
  matteredChainBalances: MatteredChainBalances;
}> => {
  console.log('fetchAllAddressesChainBalance exe');
  const addresses = await keyringService.getAllAddresses();
  const filtered = addresses.filter(item =>
    CORE_KEYRING_TYPES.includes(item.type as any),
  );
  const unionAddresses = unionBy(filtered, 'address').map(i =>
    i.address.toLowerCase(),
  );

  const allResults = await Promise.all(
    unionAddresses.map(async address => {
      return {
        address,
        result: await fetchSingleAddressBalanceFromDb(address),
      };
    }),
  );

  const mainnetBalance: TotalBalanceResponse = {
    chain_list: [],
    total_usd_value: 0,
  };

  allResults.forEach(({ address, result }) => {
    if (result.mainnet?.chain_list) {
      result.mainnet.chain_list.forEach(chain => {
        const existingChain = mainnetBalance.chain_list.find(
          c => c.id === chain.id,
        );
        if (existingChain) {
          existingChain.usd_value = existingChain.usd_value + chain.usd_value;
        } else {
          mainnetBalance.chain_list.push(chain);
        }
      });
    }
  });

  const mainnetTotalUsdValue = (mainnetBalance?.chain_list || []).reduce(
    (accu, cur) => accu + coerceFloat(cur.usd_value),
    0,
  );
  const matteredChainBalances = (mainnetBalance?.chain_list || []).reduce(
    (accu, cur) => {
      const curUsdValue = coerceFloat(cur.usd_value);
      if (curUsdValue > 1 && curUsdValue / mainnetTotalUsdValue > 0.01) {
        accu[cur.id] = formatChainToDisplay(cur);
      }
      return accu;
    },
    {} as MatteredChainBalances,
  );

  setMattredChainBalancesAll(matteredChainBalances);
  console.log('fetchAllAddressesChainBalance  done');
  return {
    matteredChainBalances,
  };
};

const fetchMatteredChainBalance = async ({
  address,
}: {
  address?: string;
  // isTestnet?: boolean;
} = {}): Promise<{
  matteredChainBalances: MatteredChainBalances;
  testnetMatteredChainBalances: MatteredChainBalances;
}> => {
  const currentAccountAddr =
    address || addrMatteredBalancesStore.getState().currentAddress;

  const result = await requestOpenApiMultipleNets<
    TotalBalanceResponse | null,
    {
      mainnet: TotalBalanceResponse | null;
      testnet: TotalBalanceResponse | null;
    }
  >(
    ctx => {
      if (!isShowTestnet && ctx.isTestnetTask) {
        return null;
      }

      return apiBalance.getAddressCacheBalance(
        currentAccountAddr,
        ctx.isTestnetTask,
      );
    },
    {
      needTestnetResult: isShowTestnet,
      processResults: ({ mainnet, testnet }) => {
        return {
          mainnet: mainnet,
          testnet: testnet,
        };
      },
      fallbackValues: {
        mainnet: null,
        testnet: null,
      },
    },
  );

  const mainnetTotalUsdValue = (result.mainnet?.chain_list || []).reduce(
    (accu, cur) => accu + coerceFloat(cur.usd_value),
    0,
  );
  const matteredChainBalances = (result.mainnet?.chain_list || []).reduce(
    (accu, cur) => {
      const curUsdValue = coerceFloat(cur.usd_value);
      // TODO: only leave chain with blance greater than $1 and has percentage 1%
      if (curUsdValue > 1 && curUsdValue / mainnetTotalUsdValue > 0.01) {
        accu[cur.id] = formatChainToDisplay(cur);
      }
      return accu;
    },
    {} as MatteredChainBalances,
  );

  const testnetTotalUsdValue = (result.testnet?.chain_list || []).reduce(
    (accu, cur) => accu + coerceFloat(cur.usd_value),
    0,
  );
  const testnetMatteredChainBalances = (
    result.testnet?.chain_list || []
  ).reduce((accu, cur) => {
    const curUsdValue = coerceFloat(cur.usd_value);

    if (curUsdValue > 1 && curUsdValue / testnetTotalUsdValue > 0.01) {
      accu[cur.id] = formatChainToDisplay(cur);
    }
    return accu;
  }, {} as MatteredChainBalances);

  if (currentAccountAddr) {
    setMattredChainBalancesByAddr(currentAccountAddr, matteredChainBalances);
    setTestMattredChainBalances(
      currentAccountAddr,
      testnetMatteredChainBalances,
    );
  }

  return {
    matteredChainBalances,
    testnetMatteredChainBalances,
  };
};

const fetchOrderedChainList = async (opts: {
  address?: string;
  supportChains?: CHAINS_ENUM[];
}) => {
  const { address, supportChains } = opts || {};
  const { pinned, matteredChainBalances } = await Promise.allSettled([
    preferenceService.getPreference('pinnedChain'),
    fetchMatteredChainBalance({ address }),
  ]).then(([pinnedChain, balance]) => {
    return {
      pinned: (pinnedChain.status === 'fulfilled'
        ? pinnedChain.value
        : []) as CHAINS_ENUM[],
      matteredChainBalances: (balance.status === 'fulfilled'
        ? // only SUPPORT mainnet now
          balance.value.matteredChainBalances
        : {}) as MatteredChainBalances,
    };
  });

  const { matteredList, unmatteredList } = varyAndSortChainItems({
    supportChains,
    pinned,
    matteredChainBalances,
  });

  return {
    matteredList,
    unmatteredList,
    firstChain: matteredList[0],
  };
};

export function useLoadMatteredChainBalances({
  account: currentAccount,
}: {
  account?: Account;
}) {
  const currentAccountAddr = currentAccount?.address;

  useEffect(() => {
    setCurrentCaredAddress(currentAccountAddr || '');
  }, [currentAccountAddr]);

  const { matteredChainBalances, testnetMatteredChainBalances } =
    useChainBalances();

  return {
    matteredChainBalances,
    testnetMatteredChainBalances,

    fetchAllAddressesChainBalance,

    fetchMatteredChainBalance,
    /** @deprecated */
    getMatteredChainBalance: fetchMatteredChainBalance,

    fetchOrderedChainList,
    /** @deprecated */
    getOrderedChainList: fetchOrderedChainList,
  };
}

export function useMatteredChainBalancesAll() {
  const matteredChainBalancesAll = allMatteredBalancesStore(s => s);

  return { matteredChainBalancesAll };
}

export const useFallbackAccount = () => {
  const accounts = useMyAccounts({
    disableAutoFetch: true,
  });
  const firstAccount = accounts[0];
  useEffect(() => {
    if (!preferenceService.getFallbackAccount()) {
      preferenceService.setCurrentAccount(firstAccount);
    }
  }, [firstAccount]);
  return firstAccount || preferenceService.getFallbackAccount();
};
