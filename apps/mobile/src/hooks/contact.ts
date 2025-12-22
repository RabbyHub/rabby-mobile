import { useEffect } from 'react';
import { apiContact } from '@/core/apis';
import { addressUtils } from '@rabby-wallet/base-utils';
import { ContactBookItem } from '@rabby-wallet/service-address';
import { useCallback } from 'react';
import { useAccountsToDisplay } from './accountToDisplay';
import { zCreate } from '@/core/utils/reexports';
import { resolveValFromUpdater, UpdaterOrPartials } from '@/core/utils/store';
import { useShallow } from 'zustand/react/shallow';

type ContactsState = {
  contactsByAddr: Record<string, ContactBookItem>;
};

const contactsByAddrStore = zCreate<ContactsState>(() => ({
  contactsByAddr: {},
}));

function setContactsByAddr(
  valOrFunc: UpdaterOrPartials<Record<string, ContactBookItem>>,
) {
  contactsByAddrStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev.contactsByAddr, valOrFunc);
    return { ...prev, contactsByAddr: newVal };
  });
}

export function useContactAccounts({
  autoFetch = false,
}: { autoFetch?: boolean } = {}) {
  const { contactsByAddr } = contactsByAddrStore(useShallow(s => s));
  const { accountsList, fetchAllAccountsToDisplay } = useAccountsToDisplay();

  const isAddrOnContactBook = useCallback(
    (address?: string) => {
      if (!address) return false;
      const laddr = address.toLowerCase();

      return !!accountsList.find(account =>
        addressUtils.isSameAddress(account.address, laddr),
      );
    },
    [accountsList],
  );

  const getAddressNote = useCallback(
    (addr: string) => {
      return contactsByAddr[addr.toLowerCase()]?.name || '';
    },
    [contactsByAddr],
  );

  const fetchContactsByAddress = useCallback(async () => {
    setContactsByAddr(apiContact.getContactsByAddress());
  }, []);

  const fetchContactAccounts = useCallback(() => {
    fetchContactsByAddress();
    fetchAllAccountsToDisplay();
  }, [fetchContactsByAddress, fetchAllAccountsToDisplay]);

  useEffect(() => {
    if (autoFetch) {
      fetchContactAccounts();
    }
  }, [autoFetch, fetchContactAccounts]);

  return {
    getAddressNote,
    isAddrOnContactBook,
    fetchContactAccounts,
  };
}
