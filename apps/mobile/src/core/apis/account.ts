import {
  DisplayKeyring,
  DisplayedKeyring,
  KEYRING_CLASS,
  KeyringAccount,
  KeyringIntf,
} from '@rabby-wallet/keyring-utils';
import { TotalBalanceResponse } from '@rabby-wallet/rabby-api/dist/types';
import * as Sentry from '@sentry/react-native';
import { addressUtils } from '@rabby-wallet/base-utils';

import { IDisplayedAccountWithBalance } from '@/hooks/accountToDisplay';
import { contactService, keyringService, preferenceService } from '../services';

import { getAddressCacheBalance } from './balance';
import { requestKeyring } from './keyring';
import { isEqual } from 'lodash';
import { type IPinAddress, type Account } from '../services/preference';
import { makeAvoidParallelAsyncFunc } from '../utils/concurrency';

import BigNumber from 'bignumber.js';

function ensureDisplayKeyring(keyring: KeyringIntf | DisplayKeyring) {
  if (keyring instanceof DisplayKeyring) {
    return keyring;
  }

  return new DisplayKeyring(keyring);
}

export async function hasVisibleAccounts() {
  const restAccountsCount = await keyringService.getCountOfAccountsInKeyring();
  return restAccountsCount > 0;
}

async function getAllVisibleAccounts(): Promise<DisplayedKeyring[]> {
  const typedAccounts = await keyringService.getAllTypedVisibleAccounts();

  return typedAccounts.map(account => ({
    ...account,
    keyring: ensureDisplayKeyring(account.keyring),
  }));
}

export async function getAllAccountsToDisplay() {
  const [displayedKeyrings, allAliasNames] = await Promise.all([
    getAllVisibleAccounts(),
    contactService.getAliasByMap(),
  ]);

  const result = await Promise.all<IDisplayedAccountWithBalance>(
    displayedKeyrings
      .map(item => {
        return item.accounts.map(account => {
          return {
            ...account,
            address: account.address.toLowerCase(),
            type: item.type,
            byImport: item.byImport,
            aliasName: allAliasNames[account?.address?.toLowerCase()]?.alias,
            keyring: item.keyring,
            publicKey: item?.publicKey,
          };
        });
      })
      .flat(1)
      .map(async item => {
        let balance: TotalBalanceResponse | null = null;

        let accountInfo = {} as {
          hdPathBasePublicKey?: string;
          hdPathType?: string;
        };

        await Promise.allSettled([
          getAddressCacheBalance(item?.address),
          requestKeyring(item.type, 'getAccountInfo', null, item.address),
        ]).then(([res1, res2]) => {
          if (res1.status === 'fulfilled') {
            balance = res1.value;
          }
          if (res2.status === 'fulfilled') {
            accountInfo = res2.value;
          }
        });

        if (!balance) {
          balance = {
            total_usd_value: 0,
            chain_list: [],
          };
        }
        return {
          ...item,
          balance: balance?.total_usd_value || 0,
          hdPathBasePublicKey: accountInfo?.hdPathBasePublicKey,
          hdPathType: accountInfo?.hdPathType,
        };
      }),
  );

  return result;
}

export type KeyringAccountWithAlias = KeyringAccount & {
  aliasName?: string;
  balance?: number;
  evmBalance?: number;
};

/**
 * @description if new fetched accounts are same from the existing ones, return the existing ones
 * to keep same ref to avoid later re-renders on React Hooks
 */
const existedAccountsRef = { current: [] as KeyringAccountWithAlias[] };
export async function fetchAllAccounts() {
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
    if (!isEqual(existedAccountsRef.current, nextAccounts)) {
      existedAccountsRef.current = nextAccounts;
    }

    return existedAccountsRef.current;
  }
}

export const sortAccountsByBalance = <
  T extends { address: string; balance?: number }[],
>(
  accounts: T,
) => {
  return accounts.sort((a, b) => {
    return new BigNumber(b?.balance || 0)
      .minus(new BigNumber(a?.balance || 0))
      .toNumber();
  });
};

export const filterMyAccounts = <
  T extends KeyringAccount | KeyringAccountWithAlias,
>(
  accounts: T[],
) => {
  return accounts.filter(
    a => a.type !== KEYRING_CLASS.WATCH && a.type !== KEYRING_CLASS.GNOSIS,
  );
};

export function sortAccountList(
  accounts: Account[],
  {
    highlightedAddresses = [],
  }: {
    highlightedAddresses: IPinAddress[];
  },
) {
  const restAccounts = [...accounts];
  let highlightedAccounts: typeof accounts = [];

  highlightedAddresses.forEach(highlighted => {
    const idx = restAccounts.findIndex(
      account =>
        addressUtils.isSameAddress(account.address, highlighted.address) &&
        account.brandName === highlighted.brandName,
    );
    if (idx > -1) {
      highlightedAccounts.push(restAccounts[idx]);
      restAccounts.splice(idx, 1);
    }
  });
  highlightedAccounts = sortAccountsByBalance(highlightedAccounts);

  const normalAccounts = highlightedAccounts
    .concat(sortAccountsByBalance(restAccounts))
    .filter(e => !!e);

  return normalAccounts;
}

const fetchAllAccountsAvoidParallel =
  makeAvoidParallelAsyncFunc(fetchAllAccounts);

export async function getSortedAddressList(options?: {
  includeOthers?: boolean;
}) {
  const { includeOthers = false } = options || {};
  const allAccounts = await fetchAllAccountsAvoidParallel();
  const allMyAccounts = filterMyAccounts(allAccounts);
  const pinAddresses = preferenceService.getPinAddresses();

  return {
    allAccounts,
    allMyAccounts,
    sortedAccounts: includeOthers
      ? sortAccountList(allAccounts, { highlightedAddresses: pinAddresses })
      : sortAccountList(allMyAccounts, { highlightedAddresses: pinAddresses }),
  };
}

export const getTop10MyAddresses = makeAvoidParallelAsyncFunc(async () => {
  const { allMyAccounts } = await getSortedAddressList();

  return filterOutTop10Accounts(allMyAccounts).top10Addresses;
});

export function filterOutTop10Accounts<
  T extends { address: string; balance?: number },
>(sortedAccounts: T[], { gatherSameAddress = false } = {}) {
  const ret = {
    top10Addresses: [] as string[],
    /**
     * @description notice, top10 accounts may contains more than 10 items, because of same address with different brandName
     */
    top10Accounts: [] as T[],
    restAccounts: [] as T[],
  };

  let top10Records = new Set<string>();
  if (gatherSameAddress) {
    for (const item of sortedAccounts) {
      const lowerAddress = item.address.toLowerCase();
      if (top10Records.size >= 10) break;

      top10Records.add(lowerAddress);
    }

    sortedAccounts.forEach(x => {
      const lx = x.address.toLowerCase();
      if (top10Records.has(lx)) {
        ret.top10Accounts.push(x);
        // ret.top10Addresses.push(lx);
      } else {
        ret.restAccounts.push(x);
      }
    });

    ret.top10Addresses = Array.from([...top10Records]);
  } else {
    ret.top10Accounts = sortedAccounts.slice(0, 10);
    ret.restAccounts = sortedAccounts.slice(10);
    ret.top10Addresses = ret.top10Accounts.map(item => {
      const addr = item.address.toLowerCase();
      top10Records.add(addr);
      return addr;
    });
  }

  return { ...ret, top10Records };
}
