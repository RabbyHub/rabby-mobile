import React, { useRef, useCallback, useEffect, useMemo } from 'react';

import {
  KeyringAccount,
  CORE_KEYRING_TYPES,
  KEYRING_TYPE,
} from '@rabby-wallet/keyring-utils';

import {
  contactService,
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
import { useAtomicRequest } from './common/useAtomicAction';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { deleteDBResourceForAddress } from '@/databases/sync/assets';
import { filterMyAccounts } from '@/utils/account';
import { isEqual, unionBy } from 'lodash';
import { BalanceEntity } from '@/databases/entities/balance';
import { updateHistoryTimeSingleAddress } from './historyTokenDict';
import { useCreationWithShallowCompare } from './common/useMemozied';
import { matomoRequestEvent } from '@/utils/analytics';
import { fetchAllAccounts, KeyringAccountWithAlias } from '@/core/apis/account';
import { zCreate } from '@/core/utils/reexports';
import {
  makeAvoidParallelAsyncFunc,
  resolveValFromUpdater,
  runIIFEFunc,
  UpdaterOrPartials,
} from '@/core/utils/store';
import { EVENT_SWITCH_ACCOUNT, eventBus } from '@/utils/events';
import { useBalanceAccounts } from './useAccountsBalance';
import { sortAccountList } from '@/utils/sortAccountList';

export type { KeyringAccountWithAlias as /** @deprecated */ KeyringAccountWithAlias };

// const fetchingAccountsAtom = atom(false);

type Store = {
  accounts: KeyringAccountWithAlias[];
  fetchingAccounts: boolean;
  pinnedAddresses: IPinAddress[];
  currentAccount: KeyringAccountWithAlias | null;
};
const zAccountStore = zCreate<Store>((set, get) => {
  return {
    accounts: [],
    fetchingAccounts: false,

    pinnedAddresses: preferenceService.getPinAddresses(),
    currentAccount: null,
  };
});

runIIFEFunc(() => {
  keyringService.once('unlock', () => {
    fetchAllAccounts().then(accounts => {
      setAccounts(accounts);
    });
  });
});

function setAccounts(valOrFunc: UpdaterOrPartials<Store['accounts']>) {
  zAccountStore.setState(prev => {
    const { newVal, changed } = resolveValFromUpdater(prev.accounts, valOrFunc);

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

const doFetchAccounts = makeAvoidParallelAsyncFunc(async () => {
  const nextAccounts = await fetchAllAccounts();
  setAccounts(nextAccounts);

  return nextAccounts;
});

export const storeApisAccounts = {
  fetchAccounts: doFetchAccounts,
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
  return useCallback(
    async (account: KeyringAccount) => {
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
    [accounts, fetchAccounts],
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
  matteredChainBalancesAll: MatteredChainBalances;
  testnetMatteredChainBalances: MatteredChainBalances;
};
const matteredBalancesStore = zCreate<MatteredBalancesState>(() => ({
  matteredChainBalances: {},
  matteredChainBalancesAll: {},
  testnetMatteredChainBalances: {},
}));

function setMattredChainBalances(
  valOrFunc: UpdaterOrPartials<MatteredChainBalances>,
) {
  matteredBalancesStore.setState(prev => {
    const { newVal, changed } = resolveValFromUpdater(
      prev.matteredChainBalances,
      valOrFunc,
      { strict: true },
    );

    if (!changed) return prev;

    return { ...prev, matteredChainBalances: newVal };
  });
}

function setMattredChainBalancesAll(
  valOrFunc: UpdaterOrPartials<MatteredChainBalances>,
) {
  matteredBalancesStore.setState(prev => {
    const { newVal, changed } = resolveValFromUpdater(
      prev.matteredChainBalancesAll,
      valOrFunc,
      { strict: true },
    );

    if (!changed) return prev;

    return { ...prev, matteredChainBalancesAll: newVal };
  });
}

function setTestMattredChainBalances(
  valOrFunc: UpdaterOrPartials<MatteredChainBalances>,
) {
  matteredBalancesStore.setState(prev => {
    const { newVal, changed } = resolveValFromUpdater(
      prev.testnetMatteredChainBalances,
      valOrFunc,
      { strict: true },
    );

    if (!changed) return prev;

    return { ...prev, testnetMatteredChainBalances: newVal };
  });
}

export function useChainBalances() {
  const matteredChainBalances = matteredBalancesStore(
    s => s.matteredChainBalances,
  );
  const matteredChainBalancesAll = matteredBalancesStore(
    s => s.matteredChainBalancesAll,
  );
  const testnetMatteredChainBalances = matteredBalancesStore(
    s => s.testnetMatteredChainBalances,
  );

  return {
    matteredChainBalances,
    setMattredChainBalances,

    matteredChainBalancesAll,
    setMattredChainBalancesAll,

    testnetMatteredChainBalances,
    setTestMattredChainBalances,
  };
}

export function useLoadMatteredChainBalances({
  account: currentAccount,
}: {
  account?: Account;
}) {
  const {
    matteredChainBalances,
    setMattredChainBalances,

    matteredChainBalancesAll,
    setMattredChainBalancesAll,

    testnetMatteredChainBalances,
    setTestMattredChainBalances,
  } = useChainBalances();

  const currentAccountAddr = currentAccount?.address;

  const isShowTestnet = false;

  const fetchMatteredChainBalance = useCallback(
    async (options?: {
      isTestnet?: boolean;
    }): Promise<{
      matteredChainBalances: MatteredChainBalances;
      testnetMatteredChainBalances: MatteredChainBalances;
    }> => {
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

      setMattredChainBalances(matteredChainBalances);
      setTestMattredChainBalances(testnetMatteredChainBalances);

      return {
        matteredChainBalances,
        testnetMatteredChainBalances,
      };
    },
    [
      currentAccountAddr,
      isShowTestnet,
      setMattredChainBalances,
      setTestMattredChainBalances,
    ],
  );

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
      unionAddresses.map(address => fetchSingleAddressBalanceFromDb(address)),
    );

    const mainnetBalance: TotalBalanceResponse = {
      chain_list: [],
      total_usd_value: 0,
    };

    allResults.forEach(result => {
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
  const fetchOrderedChainList = useCallback(
    async (opts: { supportChains?: CHAINS_ENUM[] }) => {
      const { supportChains } = opts || {};
      const { pinned, matteredChainBalances } = await Promise.allSettled([
        preferenceService.getPreference('pinnedChain'),
        fetchMatteredChainBalance(),
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
    },
    [fetchMatteredChainBalance],
  );

  const allMatteredChainBalances = useMemo(() => {
    return {
      ...testnetMatteredChainBalances,
      ...matteredChainBalances,
    };
  }, [testnetMatteredChainBalances, matteredChainBalances]);

  return {
    matteredChainBalances,
    testnetMatteredChainBalances,
    allMatteredChainBalances,

    matteredChainBalancesAll, // all addresses summed
    fetchAllAddressesChainBalance,

    fetchMatteredChainBalance,
    /** @deprecated */
    getMatteredChainBalance: fetchMatteredChainBalance,

    fetchOrderedChainList,
    /** @deprecated */
    getOrderedChainList: fetchOrderedChainList,
  };
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
