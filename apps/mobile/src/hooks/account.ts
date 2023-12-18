import { useRef, useCallback, useEffect } from 'react';

import { atom, useAtom } from 'jotai';
import { KeyringAccount } from '@rabby-wallet/keyring-utils';
import {
  contactService,
  keyringService,
  preferenceService,
} from '@/core/services';
import { removeAddress } from '@/core/apis/address';
import { Account, IPinAddress } from '@/core/services/preference';

export type KeyringAccountWithAlias = KeyringAccount & {
  aliasName?: string;
  balance?: number;
};

const getAliasName = (address: string) => {
  const contact = contactService.getContactByAddress(address);
  return contact?.name;
};

const accountsAtom = atom<KeyringAccountWithAlias[]>([]);

const currentAccountAtom = atom<null | Account>(null);

const pinAddressesAtom = atom<IPinAddress[]>([]);

export function useAccounts(opts?: { disableAutoFetch?: boolean }) {
  const [accounts, setAccounts] = useAtom(accountsAtom);

  const { disableAutoFetch = false } = opts || {};

  const isFetchingRef = useRef(false);
  const fetchAccounts = useCallback(async () => {
    if (isFetchingRef.current) {
      return;
    }

    isFetchingRef.current = true;

    let nextAccounts: KeyringAccountWithAlias[] = [];
    try {
      nextAccounts = await keyringService.getAllVisibleAccounts().then(list => {
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
      // Sentry.captureException(err);
    } finally {
      setAccounts(nextAccounts);
      isFetchingRef.current = false;
    }
  }, [setAccounts]);

  useEffect(() => {
    if (!disableAutoFetch) {
      fetchAccounts();
    }
  }, [disableAutoFetch, fetchAccounts]);

  return {
    accounts,
    fetchAccounts,
  };
}

export function useCurrentAccount() {
  const [currentAccount, setCurrentAccount] = useAtom(currentAccountAtom);
  const [accounts] = useAtom(accountsAtom);
  const fetchCurrentAccount = useCallback(async () => {
    const account = preferenceService.getCurrentAccount();
    let aliasName = '';
    if (account?.address) {
      aliasName = getAliasName(account.address) || '';
    }
    setCurrentAccount(pre => {
      return {
        ...pre,
        ...account,
        aliasName,
      };
    });
  }, [setCurrentAccount]);

  const switchAccount = useCallback(
    async (account: Account) => {
      await preferenceService.setCurrentAccount(account);
      await fetchCurrentAccount();
    },
    [fetchCurrentAccount],
  );

  useEffect(() => {
    if (
      accounts?.find(
        e =>
          e.address === currentAccount?.address &&
          e.brandName === currentAccount.brandName,
      )
    ) {
      setCurrentAccount(null);
    }
  }, [accounts, currentAccount, setCurrentAccount]);

  useEffect(() => {
    fetchCurrentAccount();
  }, [fetchCurrentAccount]);

  return {
    switchAccount,
    fetchCurrentAccount,
    currentAccount,
  };
}

export const usePinAddresses = () => {
  const [pinAddresses, setPinAddresses] = useAtom(pinAddressesAtom);

  const getPinAddressesAsync = useCallback(async () => {
    const addresses = await preferenceService.getPinAddresses();
    setPinAddresses(addresses);
  }, [setPinAddresses]);

  const togglePinAddressAsync = useCallback(
    async (payload: {
      brandName: Account['brandName'];
      address: Account['address'];
      nextPinned?: boolean;
    }) => {
      const {
        nextPinned = !pinAddresses.some(
          highlighted =>
            highlighted.address === payload.address &&
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
        await preferenceService.updatePinAddresses(addresses);
      } else {
        const toggleIdx = addresses.findIndex(
          addr =>
            addr.brandName === payload.brandName &&
            addr.address === payload.address,
        );
        if (toggleIdx > -1) {
          addresses.splice(toggleIdx, 1);
        }
        await preferenceService.updatePinAddresses(addresses);
      }

      setPinAddresses(addresses);
      getPinAddressesAsync();
    },
    [getPinAddressesAsync, pinAddresses, setPinAddresses],
  );

  useEffect(() => {
    getPinAddressesAsync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    pinAddresses,
    getPinAddressesAsync,
    togglePinAddressAsync,
  };
};

export function useRemoveAccount() {
  const { fetchAccounts } = useAccounts({ disableAutoFetch: true });
  return useCallback(
    async (account: KeyringAccount) => {
      await removeAddress(account);
      await fetchAccounts();
    },
    [fetchAccounts],
  );
}
