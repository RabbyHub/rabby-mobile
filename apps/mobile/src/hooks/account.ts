import { useRef, useCallback, useEffect, useMemo } from 'react';

import { atom, useAtom } from 'jotai';
import { KeyringAccount } from '@rabby-wallet/keyring-utils';
import {
  contactService,
  keyringService,
  preferenceService,
} from '@/core/services';
import { removeAddress } from '@/core/apis/address';
import { Account, IPinAddress } from '@/core/services/preference';
import { addressUtils } from '@rabby-wallet/base-utils';
import { WALLET_INFO } from '@/utils/walletInfo';
import { RcIconWatchAddress } from '@/assets/icons/address';

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

const currentAccountAtom = atom<null | KeyringAccountWithAlias>(null);

const pinAddressesAtom = atom<IPinAddress[]>([]);

async function fetchAllAccounts() {
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
    return nextAccounts;
  }
}

export function useAccounts(opts?: { disableAutoFetch?: boolean }) {
  const [accounts, setAccounts] = useAtom(accountsAtom);

  const { disableAutoFetch = false } = opts || {};

  const isFetchingRef = useRef(false);
  const fetchAccounts = useCallback(async () => {
    if (isFetchingRef.current) {
      return;
    }

    isFetchingRef.current = true;

    const nextAccounts = await fetchAllAccounts();
    setAccounts(nextAccounts);
    isFetchingRef.current = false;
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
    const account = await preferenceService.getCurrentAccount();
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

  const switchAccount = useCallback(
    async (account: Account) => {
      await preferenceService.setCurrentAccount(account);
      await fetchCurrentAccount();
    },
    [fetchCurrentAccount],
  );

  useEffect(() => {
    fetchCurrentAccount();
  }, [fetchCurrentAccount]);

  return {
    switchAccount,
    fetchCurrentAccount,
    currentAccount,
  };
}

export const usePinAddresses = (opts?: { disableAutoFetch?: boolean }) => {
  const { disableAutoFetch = false } = opts || {};
  const [pinAddresses, setPinAddresses] = useAtom(pinAddressesAtom);

  const getPinAddressesAsync = useCallback(() => {
    const addresses = preferenceService.getPinAddresses();
    setPinAddresses(addresses);
  }, [setPinAddresses]);

  const togglePinAddressAsync = useCallback(
    (payload: {
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
        preferenceService.updatePinAddresses(addresses);
      } else {
        const toggleIdx = addresses.findIndex(
          addr =>
            addr.brandName === payload.brandName &&
            addr.address === payload.address,
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
  const { fetchAccounts } = useAccounts({ disableAutoFetch: true });
  return useCallback(
    async (account: KeyringAccount) => {
      await removeAddress(account);
      await fetchAccounts();
    },
    [fetchAccounts],
  );
}

export function useWalletBrandLogo(brandName?: string) {
  const RcWalletIcon = useMemo(() => {
    if (!brandName) return null;

    if (brandName === 'Watch Address') {
      return RcIconWatchAddress;
    }
    return (
      WALLET_INFO?.[brandName as keyof typeof WALLET_INFO]?.icon ||
      WALLET_INFO.UnknownWallet
    );
  }, [brandName]);

  return {
    RcWalletIcon,
  };
}
