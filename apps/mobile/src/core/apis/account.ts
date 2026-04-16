import {
  KEYRING_CLASS,
  KEYRING_TYPE,
  KeyringAccount,
} from '@rabby-wallet/keyring-utils';
import * as Sentry from '@sentry/react-native';
import type { KeyringEventAccount } from '@rabby-wallet/service-keyring';

import {
  filterOutTopAccounts,
  filterMyAccounts,
  isMyAccount,
  sortAccountList,
  sortAccountsByBalance,
  type KeyringAccountWithAlias,
} from '@/core/account/utils';
import {
  getContactService,
  getKeyringService,
  getPreferenceService,
} from '@/core/account/accountServices';
import { getAccountBalanceValueMap } from '@/core/account/balanceSnapshot';
import { isEqual } from 'lodash';
import { makeAvoidParallelAsyncFunc } from '../utils/concurrency';
import { makeJsEEClass } from '@/core/services/_utils';

export async function hasVisibleAccounts() {
  const keyringService = await getKeyringService();
  const restAccountsCount = await keyringService.getCountOfAccountsInKeyring();
  return restAccountsCount > 0;
}

/**
 * @description if new fetched accounts are same from the existing ones, return the existing ones
 * to keep same ref to avoid later re-renders on React Hooks
 */
const existedAccountsRef = { current: [] as KeyringAccountWithAlias[] };
async function fetchAllAccountsProcess() {
  let nextAccounts: KeyringAccountWithAlias[] = [];
  try {
    const [contactService, keyringService] = await Promise.all([
      getContactService(),
      getKeyringService(),
    ]);
    const balanceMap = getAccountBalanceValueMap();
    nextAccounts = await keyringService
      .getAllVisibleAccountsArray()
      .then(list => {
        return list.map(account => {
          const balance = balanceMap[account.address.toLowerCase()];
          return {
            ...account,
            aliasName: '',
            evmBalance: balance?.evmBalance || 0,
            balance: balance?.totalBalance || 0,
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

export function isDirectlySignableAccount(
  account: KeyringAccount | KeyringAccountWithAlias,
) {
  return (
    account.type == KEYRING_TYPE.SimpleKeyring ||
    account.type == KEYRING_TYPE.HdKeyring
  );
}

export function isHardwareAccount(
  account: KeyringAccount | KeyringAccountWithAlias,
) {
  return (
    account.type === KEYRING_CLASS.HARDWARE.LEDGER ||
    account.type === KEYRING_CLASS.HARDWARE.TREZOR ||
    account.type === KEYRING_CLASS.HARDWARE.KEYSTONE ||
    account.type === KEYRING_CLASS.HARDWARE.ONEKEY
  );
}

export function filterDirectlySignableAccounts<
  T extends KeyringAccount | KeyringAccountWithAlias,
>(accounts: T[]) {
  return accounts.filter(
    account =>
      account.type == KEYRING_TYPE.SimpleKeyring ||
      account.type == KEYRING_TYPE.HdKeyring,
  );
}

export const fetchAllAccounts = makeAvoidParallelAsyncFunc(
  fetchAllAccountsProcess,
);

export async function getAccountList(options?: {
  filter?: 'onlyMine' | 'onlyOthers' | 'all';
  sortBy?: 'highlight'[];
}) {
  const {
    filter = 'all',
    sortBy = filter === 'onlyOthers' ? [] : ['highlight'],
  } = options || {};

  const allAccounts = await fetchAllAccounts();
  const accounts =
    filter === 'all'
      ? allAccounts
      : filter === 'onlyMine'
      ? filterMyAccounts(allAccounts)
      : filter === 'onlyOthers'
      ? allAccounts.filter(a => !isMyAccount(a))
      : allAccounts;

  let sortedAccounts = accounts;

  if (sortBy.includes('highlight')) {
    const preferenceService = await getPreferenceService();
    const pinAddresses = preferenceService.getPinAddresses();
    sortedAccounts = sortAccountList(accounts, {
      highlightedAddresses: pinAddresses,
    });
  } else {
    sortedAccounts = sortAccountsByBalance(accounts);
  }

  return {
    accounts,
    sortedAccounts,
  };
}

type TopAccountsOptions = {
  topCount?: number;
  gatherSameAddress?: boolean;
  sortBy?: 'highlight'[];
};

function normalizeTopAccountsOptions(
  options?: boolean | TopAccountsOptions,
): Required<TopAccountsOptions> {
  if (typeof options === 'boolean') {
    return {
      topCount: 10,
      gatherSameAddress: options,
      sortBy: ['highlight'],
    };
  }

  return {
    topCount: options?.topCount ?? 10,
    gatherSameAddress: options?.gatherSameAddress ?? false,
    sortBy: options?.sortBy ?? ['highlight'],
  };
}

export const getTopMyAccounts = makeAvoidParallelAsyncFunc(
  async (options?: boolean | TopAccountsOptions) => {
    const { topCount, gatherSameAddress, sortBy } =
      normalizeTopAccountsOptions(options);
    const { sortedAccounts } = await getAccountList({
      filter: 'onlyMine',
      sortBy,
    });

    return filterOutTopAccounts(sortedAccounts, {
      topCount,
      gatherSameAddress,
    });
  },
);

export function filterOutTop10Accounts<
  T extends { address: string; balance?: number },
>(sortedAccounts: T[], { gatherSameAddress = false } = {}) {
  const result = filterOutTopAccounts(sortedAccounts, {
    topCount: 10,
    gatherSameAddress,
  });

  return {
    top10Accounts: result.topAccounts,
    top10Addresses: result.topAddresses,
    top10Records: result.topRecords,
    restAccounts: result.restAccounts,
  };
}

export const getTop10MyAccounts = makeAvoidParallelAsyncFunc(
  async (options?: boolean | { gatherSameAddress?: boolean }) => {
    const result = await getTopMyAccounts({
      ...normalizeTopAccountsOptions(options),
      topCount: 10,
    });

    return {
      top10Accounts: result.topAccounts,
      top10Addresses: result.topAddresses,
      top10Records: result.topRecords,
      restAccounts: result.restAccounts,
    };
  },
);

export const getTop50PrivateKeyAccounts = makeAvoidParallelAsyncFunc(
  async () => {
    const { sortedAccounts } = await getAccountList({
      filter: 'onlyMine',
    });
    const privateKeyAccounts = filterDirectlySignableAccounts(sortedAccounts);

    return privateKeyAccounts.slice(0, 50);
  },
);

export type PerfAccountEventBusListeners = {
  ACCOUNT_ADDED: (ctx: {
    accounts: KeyringEventAccount[];
    scene?: 'privateKey' | 'memonics' | 'hardware' | 'syncExtension';
    needsBackupReminder?: boolean;
  }) => void;
  ACCOUNT_REMOVED: (ctx: { removedAccounts: KeyringEventAccount[] }) => void;
};
const { EventEmitter: AccountEE } =
  makeJsEEClass<PerfAccountEventBusListeners>();
export const accountEvents = new AccountEE();
