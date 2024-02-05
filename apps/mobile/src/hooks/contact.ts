import { useEffect } from 'react';
import { apiContact } from '@/core/apis';
import { addressUtils } from '@rabby-wallet/base-utils';
import { ContactBookItem } from '@rabby-wallet/service-address';
import { atom, useAtom } from 'jotai';
import { useCallback } from 'react';
import { useAccountsToDisplay } from './accountToDisplay';

const contactsByAddrAtom = atom<Record<string, ContactBookItem>>({});

export function useContactAccounts({
  autoFetch = false,
}: { autoFetch?: boolean } = {}) {
  const [contactsByAddr, setContactsByAddr] = useAtom(contactsByAddrAtom);
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
  }, [setContactsByAddr]);

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
