import React, { useRef, useCallback, useEffect, useMemo } from 'react';

import { atom, useAtom } from 'jotai';
import { KeyringAccount, KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import * as Sentry from '@sentry/react-native';

import {
  contactService,
  keyringService,
  preferenceService,
} from '@/core/services';
import { removeAddress } from '@/core/apis/address';
import { Account, IPinAddress } from '@/core/services/preference';
import { addressUtils } from '@rabby-wallet/base-utils';
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
import { apiBalance } from '@/core/apis';
import { useAtomicRequest } from './common/useAtomicAction';
import { appServiceEvents } from '@/core/services/_utils';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { deleteDBResourceForAddress } from '@/databases/sync/assets';

export type KeyringAccountWithAlias = KeyringAccount & {
  aliasName?: string;
  balance?: number;
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

  return {
    accounts: useMemo(() => {
      return [...accounts];
    }, [accounts]),
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
      return [
        ...allAccounts.filter(
          a =>
            a.type !== KEYRING_CLASS.WATCH && a.type !== KEYRING_CLASS.GNOSIS,
        ),
      ];
    }, [allAccounts]),
    fetchAccounts,
  };
}

const fetchingCurrentAccountAtom = atom(false);

/**
 * @description this hooks GET CURRENT account and re-PICK it from accounts, so you need to
 * ensure the accounts is fetched/updated before using this hook
 */
export function useCurrentAccount(options?: {
  disableAutoFetch?: boolean;
  isTop?: true;
}) {
  const [currentAccount, setCurrentAccount] = useAtom(currentAccountAtom);
  const [accounts] = useAtom(accountsAtom);

  const doFetchCurrentAccount = useCallback(() => {
    const account = preferenceService.getCurrentAccount();
    const index = accounts.findIndex(
      e =>
        addressUtils.isSameAddress(e.address, account?.address || '') &&
        e.brandName === account?.brandName,
    );

    setCurrentAccount(
      index >= 0
        ? (accounts[index] as any)
        : accounts.length >= 0
        ? (accounts[0] as any)
        : null,
    );
  }, [accounts, setCurrentAccount]);

  const { fetchAction: fetchCurrentAccount } = useAtomicRequest({
    isRequestingAtom: fetchingCurrentAccountAtom,
    doRequest: doFetchCurrentAccount,
  });

  const fetchCurrentAccountAsync = useCallback(async () => {
    return fetchCurrentAccount();
  }, [fetchCurrentAccount]);

  const switchAccount = useCallback(
    (account: Account) => {
      preferenceService.setCurrentAccount(account);
      setCurrentAccount(account);
    },
    [setCurrentAccount],
  );

  const { disableAutoFetch = false, isTop = false } = options || {};

  useEffect(() => {
    if (!disableAutoFetch) {
      fetchCurrentAccountAsync();
    }
  }, [disableAutoFetch, fetchCurrentAccountAsync]);

  return {
    switchAccount,
    fetchCurrentAccount,
    fetchCurrentAccountAsync,
    currentAccount,
  };
}

/**
 * @description this hooks will listen to the event of current account changed
 */
export function useCurrentAccountOnAppTop() {
  const { fetchCurrentAccountAsync } = useCurrentAccount();
  useEffect(() => {
    const listener = () => {
      fetchCurrentAccountAsync();
    };
    appServiceEvents.on('currentAccountChanged', listener);

    return () => {
      appServiceEvents.off('currentAccountChanged', listener);
    };
  }, [fetchCurrentAccountAsync]);
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
      const {
        nextPinned = !pinAddresses.some(
          highlighted =>
            isSameAddress(highlighted.address, payload.address) &&
            highlighted.brandName === payload.brandName,
        ),
      } = payload;

      const addresses = [...pinAddresses];
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
    [pinAddresses, setPinAddresses],
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
  return useCallback(
    async (account: KeyringAccount) => {
      await removeAddress(account);
      await fetchAccounts();
      if (
        accounts.filter(acc => isSameAddress(acc.address, account.address))
          .length === 1
      ) {
        await deleteDBResourceForAddress(account.address);
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

const balanceMapAtom = atom<{
  [address: string]: TotalBalanceResponse;
}>({});
type MatteredChainBalances = {
  [P in Chain['serverId']]?: DisplayChainWithWhiteLogo;
};
const matteredChainBalancesAtom = atom<MatteredChainBalances>({});
const testnetMatteredChainBalancesAtom = atom<MatteredChainBalances>({});

export function useChainBalances() {
  const [matteredChainBalances, setMattredChainBalances] = useAtom(
    matteredChainBalancesAtom,
  );
  const [testnetMatteredChainBalances, setTestMattredChainBalances] = useAtom(
    testnetMatteredChainBalancesAtom,
  );

  return {
    matteredChainBalances,
    setMattredChainBalances,

    testnetMatteredChainBalances,
    setTestMattredChainBalances,
  };
}

export function useLoadMatteredChainBalances() {
  const {
    matteredChainBalances,
    setMattredChainBalances,

    testnetMatteredChainBalances,
    setTestMattredChainBalances,
  } = useChainBalances();

  const { currentAccount } = useCurrentAccount();
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
