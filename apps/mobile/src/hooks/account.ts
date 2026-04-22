import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';

import { KeyringAccount, KEYRING_TYPE } from '@rabby-wallet/keyring-utils';

import { Account, IPinAddress } from '@/core/services/preference';
import { getWalletIcon } from '@/utils/walletInfo';
import { filterMyAccounts } from '@/utils/account';
import { useCreationWithShallowCompare } from './common/useMemozied';
import { accountEvents, KeyringAccountWithAlias } from '@/core/apis/account';
import { resolveValFromUpdater, UpdaterOrPartials } from '@/core/utils/store';
import accountStore, {
  type AccountRemovingVisualStage,
  accountResourceStore,
  NEWLY_ADDED_ACCOUNT_DURATION,
  useAccountStore,
} from '@/store/account';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { keyringService, preferenceService } from '@/core/services';
import { EntityAccountBase } from '@/databases/entities/base';
import { ormEvents } from '@/databases/entities/_helpers';
import { InteractionManager } from 'react-native';
import { appServiceEvents } from '@/core/services/_utils';
import { Store } from '@/core/services/hdKeyringService';
import { perfEvents } from '@/core/utils/perf';
import { AccountInfoEntity } from '@/databases/entities/accountInfo';
import { useSVFromMutable, useValueFromSharedValue } from './reanimated';

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

import { apiMnemonic } from '@/core/apis';

/**
 * Gets the base public key for an HD keyring account (seed phrase identifier).
 * All addresses from the same seed phrase share the same basePublicKey.
 * Returns null for non-HD accounts.
 */
async function getBasePublicKeyForAccount(
  account: KeyringAccount | null | undefined,
): Promise<string | null> {
  if (!account?.address) return null;
  // Only HD keyring accounts have seed phrases that need backup
  if (account.type !== KEYRING_TYPE.HdKeyring) return null;

  try {
    const info = await apiMnemonic.getMnemonicAddressInfo(account.address);
    return info?.basePublicKey ?? null;
  } catch {
    return null;
  }
}

/**
 * Gets the current backup reminder snapshot for a seed phrase.
 * @param basePublicKey - The keyring's base public key (unique per seed phrase)
 * @returns Whether the seed phrase needs backup reminder
 */
function getBackupReminderSnapshot(basePublicKey: string | null): boolean {
  if (!basePublicKey) return false;
  return preferenceService.getNeedsBackupReminder(basePublicKey);
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
 * Hook for checking if current account needs backup reminder.
 * Returns true only for accounts from a seed phrase that hasn't been backed up yet.
 * Uses basePublicKey to track backup at the seed phrase level, not address level.
 * This means if one address from a seed phrase is backed up, all addresses from
 * that same seed phrase are considered backed up.
 */
export function useBackupReminder(account: KeyringAccount | null | undefined) {
  const [basePublicKey, setBasePublicKey] = useState<string | null>(null);

  const address = account?.address;
  const type = account?.type;
  const brandName = account?.brandName;

  useEffect(() => {
    if (!address || !type) {
      setBasePublicKey(null);
      return;
    }
    getBasePublicKeyForAccount({
      address,
      type,
      brandName: brandName ?? '',
    }).then(setBasePublicKey);
  }, [address, type, brandName]);

  const getSnapshot = useCallback(
    () => getBackupReminderSnapshot(basePublicKey),
    [basePublicKey],
  );

  const needsBackupReminder = useSyncExternalStore(
    subscribeBackupReminderStore,
    getSnapshot,
  );

  return needsBackupReminder;
}

/**
 * Sets backup reminder for an account's seed phrase.
 * The reminder is tracked by basePublicKey, so all addresses from the same
 * seed phrase will share the same backup reminder state.
 */
export async function setAccountNeedsBackupReminder(
  account: KeyringAccount,
  needsReminder: boolean,
) {
  const basePublicKey = await getBasePublicKeyForAccount(account);
  if (!basePublicKey) return;
  preferenceService.setNeedsBackupReminder(basePublicKey, needsReminder);
}

/**
 * Clears backup reminder for an account's seed phrase.
 * This clears the reminder for all addresses from the same seed phrase.
 */
export async function clearAccountBackupReminder(account: KeyringAccount) {
  const basePublicKey = await getBasePublicKeyForAccount(account);
  if (!basePublicKey) return;
  preferenceService.clearNeedsBackupReminder(basePublicKey);
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
}

export function setCurrentAccount(
  valOrFunc: UpdaterOrPartials<KeyringAccountWithAlias | null>,
) {
  accountStore.setCurrentAccount(valOrFunc);
}

export function useAccounts(opts?: {
  disableAutoFetch?: boolean;
  includeRemoving?: boolean;
  includeFinishingVisual?: boolean;
}) {
  const {
    disableAutoFetch = false,
    includeRemoving = true,
    includeFinishingVisual = false,
  } = opts || {};
  const accounts = accountResourceStore.useAccounts({
    includeRemoving,
    includeFinishingVisual,
  });

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

export function useAccountByAddress(
  address?: string,
  opts?: {
    disableAutoFetch?: boolean;
    includeRemoving?: boolean;
    includeFinishingVisual?: boolean;
  },
) {
  const {
    disableAutoFetch = false,
    includeRemoving = true,
    includeFinishingVisual = false,
  } = opts || {};
  const account = accountResourceStore.useAccountByAddress(address, {
    includeRemoving,
    includeFinishingVisual,
  });

  useEffect(() => {
    if (!disableAutoFetch) {
      accountStore.fetchAccounts();
    }
  }, [disableAutoFetch]);

  return {
    account,
    fetchAccounts: accountStore.fetchAccounts,
  };
}

export const storeApiAccounts = {
  getAccounts(opts?: {
    includeRemoving?: boolean;
    includeFinishingVisual?: boolean;
  }) {
    return accountResourceStore.getAccounts(opts);
  },
  getAccountByAddress(
    address?: string,
    opts?: { includeRemoving?: boolean; includeFinishingVisual?: boolean },
  ) {
    return accountResourceStore.getAccountByAddress(address, opts);
  },
  getPinAddresses() {
    return accountStore.getState().pinnedAddresses;
  },
  getRemovingVisualStageSV(account?: KeyringAccountWithAlias | null) {
    return accountResourceStore.getRemovingVisualStageSV(account);
  },
  getRemovingToastBridge(account?: KeyringAccountWithAlias | null) {
    return accountResourceStore.getRemovingToastBridge(account);
  },
  fetchAccounts: accountStore.fetchAccounts,
  clearRemovingToastBridge(account?: KeyringAccountWithAlias | null) {
    return accountResourceStore.clearRemovingToastBridge(account);
  },
  markRemovingToastTransitioned(account?: KeyringAccountWithAlias | null) {
    return accountResourceStore.markRemovingToastTransitioned(account);
  },
  removeAccount: accountStore.removeAccount,
  registerRemovingToastBridge(
    account: KeyringAccountWithAlias,
    bridge: {
      successMessage: string;
      toastId: number;
    },
  ) {
    return accountResourceStore.registerRemovingToastBridge(account, bridge);
  },
  finishRemovingAccountVisual: accountStore.finishRemovingAccountVisual,
};

export function useMyAccounts(opts?: { disableAutoFetch?: boolean }) {
  const allAccounts = accountResourceStore.useAccounts();

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

export function useIsRemovingAccount(account?: KeyringAccountWithAlias | null) {
  return accountResourceStore.useIsRemovingAccount(account);
}

export function useAccountRemovingVisualStage(
  account?: KeyringAccountWithAlias | null,
) {
  return useValueFromSharedValue(
    accountResourceStore.getRemovingVisualStageSV(account),
  );
}

export function useAccountRemovingVisualStageSV(
  account?: KeyringAccountWithAlias | null,
) {
  return useSVFromMutable(
    accountResourceStore.getRemovingVisualStageSV(account),
  );
}

export function useAccountRemovingToastBridge(
  account?: KeyringAccountWithAlias | null,
) {
  return accountResourceStore.useRemovingToastBridge(account);
}

export const usePinnedAccountList = () => {
  const pinAddresses = useAccountStore(s => s.pinnedAddresses);
  const accounts = accountResourceStore.useAccounts();
  return useMemo(() => {
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
        res.push(item);
      }
    });

    return res;
  }, [accounts, pinAddresses]);
};

/**
 * @deprecated use `storeApiAccounts.removeAccount` directly
 */
export function useRemoveAccount() {
  return useCallback(
    async (
      account: KeyringAccount,
      opts?: {
        beforeCommit?: () => void | Promise<void>;
        afterCommit?: () => void | Promise<void>;
      },
    ) => {
      await accountStore.removeAccount(
        account as KeyringAccountWithAlias,
        opts,
      );
    },
    [],
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

export { NEWLY_ADDED_ACCOUNT_DURATION };
export type { Account, IPinAddress };
export type { AccountRemovingVisualStage };
