import React, { useCallback, useEffect, useMemo } from 'react';

import { KeyringAccount, KEYRING_TYPE } from '@rabby-wallet/keyring-utils';

import { Account, IPinAddress } from '@/core/services/preference';
import { getWalletIcon } from '@/utils/walletInfo';
import { filterMyAccounts } from '@/utils/account';
import { useCreationWithShallowCompare } from './common/useMemozied';
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
