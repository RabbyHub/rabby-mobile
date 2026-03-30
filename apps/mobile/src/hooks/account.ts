import React, {
  useCallback,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from 'react';

import { KeyringAccount, KEYRING_TYPE } from '@rabby-wallet/keyring-utils';

import { Account, IPinAddress } from '@/core/services/preference';
import { getWalletIcon } from '@/utils/walletInfo';
import { filterMyAccounts } from '@/utils/account';
import { useCreationWithShallowCompare } from './common/useMemozied';
import {
  accountEvents,
  KeyringAccountWithAlias,
} from '@/core/apis/account';
import {
  resolveValFromUpdater,
  UpdaterOrPartials,
} from '@/core/utils/store';
import balanceStore from '@/store/balance';
import accountStore, {
  NEWLY_ADDED_ACCOUNT_DURATION,
  useAccountStore,
} from '@/store/account';
import { KeyringAccountWithAlias } from '@/core/apis/account';
import { UpdaterOrPartials } from '@/core/utils/store';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { preferenceService } from '@/core/services';
import { EntityAccountBase } from '@/databases/entities/base';
import { ormEvents } from '@/databases/entities/_helpers';
import { InteractionManager } from 'react-native';
import { appServiceEvents } from '@/core/services/_utils';

export type { KeyringAccountWithAlias as /** @deprecated */ KeyringAccountWithAlias };

export function useIsNewlyAddedAccount(account: KeyringAccount) {
  const dbId = useMemo(() => {
    return EntityAccountBase.buildDBId({
      address: account.address,
      type: account.type,
      brandName: account.brandName,
    });
  }, [account.address, account.brandName, account.type]);
  const newlyAddedAccount = useAccountStore(
    s => s.newlyAddedAccounts[dbId] ?? null,
  );

  return {
    newlyAddedAccount,
    isNewlyAdded:
      !!newlyAddedAccount &&
      Date.now() - newlyAddedAccount.updated_at <= NEWLY_ADDED_ACCOUNT_DURATION,
  };
}

/**
 * Gets the current backup reminder snapshot for an account.
 * @param dbId - The account's database ID
 * @returns Whether the account needs backup reminder
 */
export function getBackupReminderSnapshot(dbId: string | undefined): boolean {
  if (!dbId) return false;
  return preferenceService.getNeedsBackupReminder(dbId);
}

/**
 * Subscribe function for backup reminder changes.
 * Subscribes to all backup reminder changes (not specific to an account).
 * @param listener - The callback to call when any backup reminder changes
 * @returns An unsubscribe function
 */
const subscribeBackupReminderStore = (listener: () => void) => {
  // Subscribe to all backup reminder changes
  const { remove } = appServiceEvents.subscribe(
    'backupReminderChanged',
    listener,
  );
  return remove;
};

/**
 * hook for checking if current account needs backup reminder.
 * Returns true only for accounts created via "Create New Wallet" that haven't been backed up yet.
 * Uses preferenceService (MMKV) for reliable persistence across app restarts.
 */
export function useBackupReminder(account: KeyringAccount | null | undefined) {
  const dbId = useMemo(() => {
    if (!account?.address) return '';
    return EntityAccountBase.buildDBId({
      address: account.address,
      type: account.type,
      brandName: account.brandName,
    });
  }, [account?.address, account?.type, account?.brandName]);

  const getSnapshot = useCallback(
    () => getBackupReminderSnapshot(dbId),
    [dbId],
  );

  const needsBackupReminder = useSyncExternalStore(
    subscribeBackupReminderStore,
    getSnapshot,
  );

  return needsBackupReminder;
}

export async function setAccountNeedsBackupReminder(
  account: KeyringAccount,
  needsReminder: boolean,
) {
  const dbId = EntityAccountBase.buildDBId({
    address: account.address,
    type: account.type,
    brandName: account.brandName,
  });
  preferenceService.setNeedsBackupReminder(dbId, needsReminder);
}

export async function clearAccountBackupReminder(account: KeyringAccount) {
  const dbId = EntityAccountBase.buildDBId({
    address: account.address,
    type: account.type,
    brandName: account.brandName,
  });
  preferenceService.clearNeedsBackupReminder(dbId);
}

export function useDevNewlyAddedAccounts() {
  const newlyAddedAccounts = useAccountStore(s => s.newlyAddedAccounts);
  return {
    newlyAddedAccounts: useMemo(
      () => Object.values(newlyAddedAccounts),
      [newlyAddedAccounts],
    ),
  };
}

export function startManageAccountStoreLifecycle() {
  accountStore.startLifecycle();
  perfEvents.subscribe('USER_MANUALLY_UNLOCK', () => {
    fetchAndSet();
  });

  keyringService.on('newAccount', (account: Account) => {
    fetchAndSet();
  });
  // removedAccount
  keyringService.on('removedAccount', async (account: Account) => {
    fetchAndSet();

    accountEvents.emit('ACCOUNT_REMOVED', {
      removedAccounts: [account],
    });

    // Clean up backup reminder from preferenceService
    const dbId = EntityAccountBase.buildDBId({
      address: account.address,
      type: account.type,
      brandName: account.brandName,
    });
    preferenceService.clearNeedsBackupReminder(dbId);

    await AccountInfoEntity.deleteByAccount(account);
    await fetchNewlyAddedAccounts();
  });

  keyringService.store.subscribe(state => {
    if (state.booted && state.vault) {
      fetchAndSet();
    }
  });

  accountEvents.on(
    'ACCOUNT_ADDED',
    async ({ accounts, scene, needsBackupReminder }) => {
      // Store backup reminder in preferenceService (MMKV) for reliable persistence
      if (needsBackupReminder) {
        for (const account of accounts) {
          const dbId = EntityAccountBase.buildDBId({
            address: account.address,
            type: account.type,
            brandName: account.brandName,
          });
          preferenceService.setNeedsBackupReminder(dbId, true);
        }
      }
      await AccountInfoEntity.recordNewAccount(accounts);
      await fetchNewlyAddedAccounts();
    },
  );

  ormEvents.on(`account_info:removed`, () => {
    fetchNewlyAddedAccounts();
  });

  fetchNewlyAddedAccounts();
  setInterval(() => {
    InteractionManager.runAfterInteractions(() => {
      fetchNewlyAddedAccounts();
    });
  }, 10 * 1e3);

  setInterval(() => {
    InteractionManager.runAfterInteractions(() => {
      AccountInfoEntity.trimExpiredAccounts(NEWLY_ADDED_ACCOUNT_DURATION);
    });
  }, 60 * 1e3);
}

// 简单打个补丁先避免 balance 和 evmBalance 变化触发 ACCOUNTS_MAYBE_CHANGED
// TODO: 彻底解决这个问题
const stripAccountsForDiff = (accounts: KeyringAccountWithAlias[]) =>
  accounts.map(account => {
    const { balance, evmBalance, ...rest } = account;
    return rest;
  });
function setAccounts(valOrFunc: UpdaterOrPartials<Store['accounts']>) {
  zAccountStore.setState(prev => {
    const { newVal, changed } = resolveValFromUpdater(
      prev.accounts,
      valOrFunc,
      {
        strict: true,
      },
    );

    if (changed) {
      return { ...prev, accounts: newVal };
    }

    return prev;
  });
}

export function setCurrentAccount(
  valOrFunc: UpdaterOrPartials<KeyringAccountWithAlias | null>,
) {
  accountStore.setCurrentAccount(valOrFunc);
}

export function useAccounts(opts?: { disableAutoFetch?: boolean }) {
  const accounts = useAccountStore(s => s.accounts);

  const { disableAutoFetch = false } = opts || {};

  useEffect(() => {
    if (!disableAutoFetch) {
      accountStore.fetchAccounts();
    }
  }, [disableAutoFetch]);

  const stableAccounts = useCreationWithShallowCompare(() => {
    return accounts;
  }, [accounts]);

  return {
    accounts: stableAccounts,
    fetchAccounts: accountStore.fetchAccounts,
  };
}

export const storeApiAccounts = {
  getAccounts() {
    return accountStore.getState().accounts;
  },
  getPinAddresses() {
    return accountStore.getState().pinnedAddresses;
  },
  fetchAccounts: accountStore.fetchAccounts,
  removeAccount: accountStore.removeAccount,
};

export function useMyAccounts(opts?: { disableAutoFetch?: boolean }) {
  const allAccounts = useAccountStore(s => s.accounts);

  const { disableAutoFetch = false } = opts || {};

  useEffect(() => {
    if (!disableAutoFetch) {
      accountStore.fetchAccounts();
    }
  }, [disableAutoFetch]);

  const accounts = useCreationWithShallowCompare(() => {
    return filterMyAccounts(allAccounts);
  }, [allAccounts]);

  return {
    accounts,
    fetchAccounts: accountStore.fetchAccounts,
  };
}

export const usePinAddresses = (opts?: { disableAutoFetch?: boolean }) => {
  const { disableAutoFetch = false } = opts || {};
  const pinAddresses = useAccountStore(s => s.pinnedAddresses);

  const getPinAddresses = useCallback(() => {
    const addresses = preferenceService.getPinAddresses();
    accountStore.setPinnedAddresses(addresses);
  }, []);

  const getPinAddressesAsync = useCallback(async () => {
    return getPinAddresses();
  }, [getPinAddresses]);

  useEffect(() => {
    if (!disableAutoFetch) {
      getPinAddressesAsync();
    }
  }, [disableAutoFetch, getPinAddressesAsync]);

  return {
    pinAddresses,
    getPinAddressesAsync,
    togglePinAddressAsync: accountStore.togglePinAddressAsync,
  };
};

export const usePinnedAccountList = () => {
  const pinAddresses = useAccountStore(s => s.pinnedAddresses);
  const accounts = useAccountStore(s => s.accounts);
  const balanceMap = balanceStore(s => s.balanceMap);

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
        const balance = balanceMap[item.address.toLowerCase()];
        res.push({
          ...item,
          balance: balance?.totalBalance || item.balance || 0,
          evmBalance: balance?.evmBalance || item.evmBalance || 0,
        });
      }
    });
    return res;
  }, [accounts, balanceMap, pinAddresses]);

  return pinnedAccountList;
};

/**
 * @deprecated use `storeApiAccounts.removeAccount` directly
 */
export function useRemoveAccount() {
  return useCallback(async (account: KeyringAccount) => {
    await accountStore.removeAccount(account as KeyringAccountWithAlias);
  }, []);
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

export { NEWLY_ADDED_ACCOUNT_DURATION };
export type { Account, IPinAddress };
