import {
  DisplayKeyring,
  DisplayedKeyring,
  KEYRING_CLASS,
  KEYRING_TYPE,
  KeyringAccount,
  KeyringIntf,
} from '@rabby-wallet/keyring-utils';
import { TotalBalanceResponse } from '@rabby-wallet/rabby-api/dist/types';
import { Platform } from 'react-native';
import * as Sentry from '@sentry/react-native';
import { addressUtils } from '@rabby-wallet/base-utils';
import { KeyringEventAccount } from '@rabby-wallet/service-keyring';

import { contactService, keyringService, preferenceService } from '../services';
import addressBalanceStore from '@/store/balance';

import { getAddressCacheBalance } from './balance';
import { requestKeyring } from './keyring';
import { isEqual } from 'lodash';
import type {
  Account,
  IDisplayedAccountWithBalance,
  IPinAddress,
  KeyringAccountWithAlias,
} from '@/types/account';
import { makeAvoidParallelAsyncFunc } from '../utils/concurrency';

import BigNumber from 'bignumber.js';
import { makeJsEEClass } from '@/core/services/_utils';
import { logger } from '@/utils/logger';

const isAndroid = Platform.OS === 'android';

function traceAndroidUnlockAccountPerf(
  event: string,
  data: Record<string, unknown> = {},
) {
  if (!isAndroid) {
    return;
  }

  logger.info(`[RabbyUnlockPerf:account] ${event}`, data);
}

function getTraceErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function ensureDisplayKeyring(keyring: KeyringIntf | DisplayKeyring) {
  if (keyring instanceof DisplayKeyring) {
    return keyring;
  }

  return new DisplayKeyring(keyring);
}

export async function hasVisibleAccounts() {
  const startedAt = Date.now();

  traceAndroidUnlockAccountPerf('has_visible_accounts_start');

  try {
    const restAccountsCount =
      await keyringService.getCountOfAccountsInKeyring();

    traceAndroidUnlockAccountPerf('has_visible_accounts_end', {
      elapsedMs: Date.now() - startedAt,
      count: restAccountsCount,
    });

    return restAccountsCount > 0;
  } catch (error) {
    traceAndroidUnlockAccountPerf('has_visible_accounts_error', {
      elapsedMs: Date.now() - startedAt,
      error: getTraceErrorMessage(error),
    });
    throw error;
  }
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

  const result = await Promise.all(
    displayedKeyrings
      .map(item => {
        return item.accounts.map(account => {
          return {
            ...account,
            address: account.address.toLowerCase(),
            type: item.type,
            byImport: item.byImport,
            aliasName:
              allAliasNames[account?.address?.toLowerCase()]?.alias || '',
            keyring: item.keyring,
            publicKey: item?.publicKey,
          } as IDisplayedAccountWithBalance;
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

export type { KeyringAccountWithAlias } from '@/types/account';

/**
 * @description if new fetched accounts are same from the existing ones, return the existing ones
 * to keep same ref to avoid later re-renders on React Hooks
 */
const existedAccountsRef = { current: [] as KeyringAccountWithAlias[] };
const FETCH_ALL_ACCOUNTS_CACHE_TTL_MS = 2000;
const fetchAllAccountsCacheRef = {
  current: null as null | {
    updatedAt: number;
    accounts: KeyringAccountWithAlias[];
  },
};

type FetchAllAccountsOptions = {
  force?: boolean;
};

export function invalidateFetchAllAccountsCache() {
  fetchAllAccountsCacheRef.current = null;
}

async function fetchAllAccountsProcess() {
  let nextAccounts: KeyringAccountWithAlias[] = [];
  const startedAt = Date.now();

  traceAndroidUnlockAccountPerf('get_all_visible_accounts_start');

  try {
    const visibleAccounts = await keyringService.getAllVisibleAccountsArray();
    await addressBalanceStore.hydrateCachedBalancesForAccounts(visibleAccounts);
    const balanceMap = addressBalanceStore.getAddressValueMap();
    nextAccounts = visibleAccounts.map(account => {
      const balance = balanceMap[account.address.toLowerCase()];
      return {
        ...account,
        aliasName: '',
        evmBalance: balance?.evmBalance || 0,
        balance: balance?.totalBalance || 0,
      };
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
    traceAndroidUnlockAccountPerf('get_all_visible_accounts_error', {
      elapsedMs: Date.now() - startedAt,
      error: getTraceErrorMessage(err),
    });
    Sentry.captureException(err);
  } finally {
    traceAndroidUnlockAccountPerf('get_all_visible_accounts_end', {
      elapsedMs: Date.now() - startedAt,
      count: nextAccounts.length,
    });

    if (!isEqual(existedAccountsRef.current, nextAccounts)) {
      existedAccountsRef.current = nextAccounts;
    }

    return existedAccountsRef.current;
  }
}

async function fetchAllAccountsCached(options?: FetchAllAccountsOptions) {
  const now = Date.now();
  const cache = fetchAllAccountsCacheRef.current;
  if (
    !options?.force &&
    cache &&
    now - cache.updatedAt <= FETCH_ALL_ACCOUNTS_CACHE_TTL_MS
  ) {
    traceAndroidUnlockAccountPerf('get_all_visible_accounts_cache_hit', {
      elapsedMs: Date.now() - now,
      ageMs: now - cache.updatedAt,
      count: cache.accounts.length,
    });
    return cache.accounts;
  }

  const accounts = await fetchAllAccountsProcess();
  fetchAllAccountsCacheRef.current = {
    updatedAt: Date.now(),
    accounts,
  };
  return accounts;
}

export const sortAccountsByBalance = <
  T extends { address: string; balance?: number }[],
>(
  accounts: T,
) => {
  return [...accounts].sort((a, b) => {
    const balanceDiff = new BigNumber(b?.balance || 0)
      .minus(new BigNumber(a?.balance || 0))
      .toNumber();

    if (balanceDiff !== 0) {
      return balanceDiff;
    }

    const aAddress = a.address.toLowerCase();
    const bAddress = b.address.toLowerCase();
    if (aAddress !== bAddress) {
      return aAddress.localeCompare(bAddress);
    }

    const aType =
      typeof (a as KeyringAccountWithAlias).type === 'string'
        ? (a as KeyringAccountWithAlias).type
        : '';
    const bType =
      typeof (b as KeyringAccountWithAlias).type === 'string'
        ? (b as KeyringAccountWithAlias).type
        : '';
    if (aType !== bType) {
      return aType.localeCompare(bType);
    }

    const aBrandName =
      typeof (a as Account).brandName === 'string'
        ? (a as Account).brandName
        : '';
    const bBrandName =
      typeof (b as Account).brandName === 'string'
        ? (b as Account).brandName
        : '';

    return aBrandName.localeCompare(bBrandName);
  }) as T;
};

export function isMyAccount<T extends KeyringAccount | KeyringAccountWithAlias>(
  account: T,
) {
  return (
    account.type !== KEYRING_CLASS.WATCH &&
    account.type !== KEYRING_CLASS.GNOSIS &&
    account.type !== KEYRING_CLASS.WALLETCONNECT
  );
}

export const filterMyAccounts = <
  T extends KeyringAccount | KeyringAccountWithAlias,
>(
  accounts: T[],
) => {
  return accounts.filter(isMyAccount);
};

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
    if (idx > -1 && restAccounts[idx]) {
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

export const fetchAllAccounts = makeAvoidParallelAsyncFunc(
  fetchAllAccountsCached,
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

export function filterOutTopAccounts<
  T extends { address: string; balance?: number },
>(sortedAccounts: T[], { topCount = 10, gatherSameAddress = false } = {}) {
  const ret = {
    topAddresses: [] as string[],
    /**
     * @description notice, top accounts may contains more than 10 items, because of same address with different brandName
     */
    topAccounts: [] as T[],
    restAccounts: [] as T[],
  };

  let topRecords = new Set<string>();
  if (gatherSameAddress) {
    for (const item of sortedAccounts) {
      const lowerAddress = item.address.toLowerCase();
      if (topRecords.size >= topCount) break;

      topRecords.add(lowerAddress);
    }

    sortedAccounts.forEach(x => {
      const lx = x.address.toLowerCase();
      if (topRecords.has(lx)) {
        ret.topAccounts.push(x);
        // ret.topAddresses.push(lx);
      } else {
        ret.restAccounts.push(x);
      }
    });

    ret.topAddresses = Array.from([...topRecords]);
  } else {
    ret.topAccounts = sortedAccounts.slice(0, topCount);
    ret.restAccounts = sortedAccounts.slice(topCount);
    ret.topAccounts.forEach(item => {
      const addr = item.address.toLowerCase();
      if (!topRecords.has(addr)) ret.topAddresses.push(addr);
      topRecords.add(addr);
      return addr;
    });
  }

  return { ...ret, topRecords };
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
