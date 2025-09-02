import React, { useRef, useCallback, useEffect, useMemo } from 'react';

import { atom, useAtom } from 'jotai';
import {
  KeyringAccount,
  CORE_KEYRING_TYPES,
} from '@rabby-wallet/keyring-utils';
import * as Sentry from '@sentry/react-native';

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
import { appServiceEvents } from '@/core/services/_utils';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { deleteDBResourceForAddress } from '@/databases/sync/assets';
import { filterMyAccounts, stableSerializeAccounts } from '@/utils/account';
import { unionBy } from 'lodash';
import { BalanceEntity } from '@/databases/entities/balance';
import { useHistoryTokenDict } from './historyTokenDict';

export type KeyringAccountWithAlias = KeyringAccount & {
  aliasName?: string;
  balance?: number;
  evmBalance?: number;
};

const accountsAtom = atom<KeyringAccountWithAlias[]>([]);

accountsAtom.onMount = setAtom => {
  fetchAllAccounts().then(accounts => {
    setAtom(accounts || []);
  });
};

export const currentAccountAtom = atom<null | KeyringAccountWithAlias>(null);

const pinAddressesAtom = atom<IPinAddress[]>([]);

pinAddressesAtom.onMount = setAtom => {
  const addresses = preferenceService.getPinAddresses();
  setAtom(addresses);
};

async function fetchAllAccounts() {
  let nextAccounts: KeyringAccountWithAlias[] = [];
  try {
    nextAccounts = await keyringService
      .getAllVisibleAccountsArray()
      .then(list => {
        return list.map(account => {
          const balance = preferenceService.getAddressBalance(account.address);
          return {
            ...account,
            aliasName: '',
            evmBalance: balance?.evm_usd_value || 0,
            balance: balance?.total_usd_value || 0,
          };
        });
      });

    await Promise.allSettled(
      nextAccounts.map(async (account, idx) => {
        const aliasName = contactService.getAliasByAddress(account.address);
        nextAccounts[idx] = {
          ...account,
          aliasName: aliasName?.alias || '',
        };
      }),
    );
  } catch (err) {
    Sentry.captureException(err);
  } finally {
    return nextAccounts;
  }
}

const fetchingAccountsAtom = atom(false);
export function useAccounts(opts?: { disableAutoFetch?: boolean }) {
  const [accounts, setAccounts] = useAtom(accountsAtom);

  const { disableAutoFetch = false } = opts || {};

  const doFetchAccounts = useCallback(async () => {
    const nextAccounts = await fetchAllAccounts();
    setAccounts(nextAccounts);
  }, [setAccounts]);

  const { fetchAction: fetchAccounts } = useAtomicRequest({
    isRequestingAtom: fetchingAccountsAtom,
    doRequest: doFetchAccounts,
  });

  useEffect(() => {
    if (!disableAutoFetch) {
      fetchAccounts();
    }
  }, [disableAutoFetch, fetchAccounts]);

  const accountsJSON = useMemo(
    () => stableSerializeAccounts(accounts),
    [accounts],
  );

  const derivedAccounts = useMemo(() => {
    return JSON.parse(accountsJSON);
  }, [accountsJSON]);

  return {
    accounts: derivedAccounts,
    fetchAccounts,
  };
}

export function useMyAccounts(opts?: { disableAutoFetch?: boolean }) {
  const [allAccounts, setAccounts] = useAtom(accountsAtom);

  const { disableAutoFetch = false } = opts || {};

  const doFetchAccounts = useCallback(async () => {
    const nextAccounts = await fetchAllAccounts();
    setAccounts(nextAccounts);
  }, [setAccounts]);

  const { fetchAction: fetchAccounts } = useAtomicRequest({
    isRequestingAtom: fetchingAccountsAtom,
    doRequest: doFetchAccounts,
  });

  useEffect(() => {
    if (!disableAutoFetch) {
      fetchAccounts();
    }
  }, [disableAutoFetch, fetchAccounts]);

  return {
    accounts: useMemo(() => {
      return [...filterMyAccounts(allAccounts)];
    }, [allAccounts]),
    fetchAccounts,
  };
}

export const usePinAddresses = (opts?: { disableAutoFetch?: boolean }) => {
  const { disableAutoFetch = false } = opts || {};
  const [pinAddresses, setPinAddresses] = useAtom(pinAddressesAtom);

  /**
   * @deprecated
   */
  const getPinAddresses = useCallback(() => {
    const addresses = preferenceService.getPinAddresses();
    setPinAddresses(addresses);
  }, [setPinAddresses]);

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
    [setPinAddresses],
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

export function useRemoveAccount() {
  const { accounts, fetchAccounts } = useAccounts({ disableAutoFetch: true });
  const { updateHistoryTimeSingleAddress } = useHistoryTokenDict();
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
    [accounts, fetchAccounts, updateHistoryTimeSingleAddress],
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

const balanceMapAtom = atom<{
  [address: string]: TotalBalanceResponse;
}>({});
type MatteredChainBalances = {
  [P in Chain['serverId']]?: DisplayChainWithWhiteLogo;
};
const matteredChainBalancesAtom = atom<MatteredChainBalances>({});
const matteredChainBalancesAllAtom = atom<MatteredChainBalances>({});
const testnetMatteredChainBalancesAtom = atom<MatteredChainBalances>({});

export function useChainBalances() {
  const [matteredChainBalances, setMattredChainBalances] = useAtom(
    matteredChainBalancesAtom,
  );
  const [matteredChainBalancesAll, setMattredChainBalancesAll] = useAtom(
    matteredChainBalancesAllAtom,
  );
  const [testnetMatteredChainBalances, setTestMattredChainBalances] = useAtom(
    testnetMatteredChainBalancesAtom,
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

// interface AccountState {
//   /**
//    * @description useless now
//    */
//   // visibleAccounts: DisplayedKeyring[];
//   /**
//    * @description useless now
//    */
//   // hiddenAccounts: Account[];
//   // keyrings: DisplayedKeyring[];
//   // balanceMap: {
//   //   [address: string]: TotalBalanceResponse;
//   // };
//   // matteredChainBalances: {
//   //   [P in Chain['serverId']]?: DisplayChainWithWhiteLogo;
//   // };
//   // testnetMatteredChainBalances: {
//   //   [P in Chain['serverId']]?: DisplayChainWithWhiteLogo;
//   // };
//   /**
//    * @description maybe repeated hooks in Home
//    */
//   // tokens: {
//   //   list: AbstractPortfolioToken[];
//   //   customize: AbstractPortfolioToken[];
//   //   blocked: AbstractPortfolioToken[];
//   // };
//   // testnetTokens: {
//   //   list: AbstractPortfolioToken[];
//   //   customize: AbstractPortfolioToken[];
//   //   blocked: AbstractPortfolioToken[];
//   // };

//   /**
//    * @description useless now
//    */
//   // mnemonicAccounts: DisplayedKeyring[];
// }

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
