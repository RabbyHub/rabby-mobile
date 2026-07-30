import { useEffect } from 'react';
import { apiContact } from '@/core/apis';
import { ContactBookItem } from '@rabby-wallet/service-address';
import { atom, useAtom } from 'jotai';
import { useCallback } from 'react';
import {
  getPublicAccountSnapshotAccounts,
  keyringServiceApi,
} from '@/core/serviceApi/keyring';

const contactsByAddrAtom = atom<Record<string, ContactBookItem>>({});
const visibleAccountAddressesAtom = atom<ReadonlySet<string>>(
  new Set<string>(),
);

let visibleAccountsRequest: Promise<string[]> | null = null;

function normalizeAccountAddresses(accounts: Array<{ address: string }>) {
  return Array.from(
    new Set(accounts.map(account => account.address.toLowerCase())),
  ).sort();
}

function areAddressSetsEqual(
  left: ReadonlySet<string>,
  right: ReadonlySet<string>,
) {
  if (left.size !== right.size) {
    return false;
  }
  return Array.from(left).every(address => right.has(address));
}

export function useContactAccounts({
  autoFetch = false,
}: { autoFetch?: boolean } = {}) {
  const [contactsByAddr, setContactsByAddr] = useAtom(contactsByAddrAtom);
  const [visibleAccountAddresses, setVisibleAccountAddresses] = useAtom(
    visibleAccountAddressesAtom,
  );

  const commitVisibleAccountAddresses = useCallback(
    (addresses: string[]) => {
      const nextAddresses = new Set(addresses);
      setVisibleAccountAddresses(prev =>
        areAddressSetsEqual(prev, nextAddresses) ? prev : nextAddresses,
      );
    },
    [setVisibleAccountAddresses],
  );

  const isAddrOnContactBook = useCallback(
    (address?: string) => {
      if (!address) return false;
      return visibleAccountAddresses.has(address.toLowerCase());
    },
    [visibleAccountAddresses],
  );

  const getAddressNote = useCallback(
    (addr: string) => {
      return contactsByAddr[addr.toLowerCase()]?.name || '';
    },
    [contactsByAddr],
  );

  const fetchContactsByAddress = useCallback(() => {
    setContactsByAddr(apiContact.getContactsByAddress());
  }, [setContactsByAddr]);

  const fetchContactAccounts = useCallback(() => {
    fetchContactsByAddress();

    const snapshotAddresses = normalizeAccountAddresses(
      getPublicAccountSnapshotAccounts(),
    );
    if (snapshotAddresses.length) {
      commitVisibleAccountAddresses(snapshotAddresses);
    }

    if (!visibleAccountsRequest) {
      visibleAccountsRequest = keyringServiceApi
        .getAllVisibleAccountsArray()
        .then(normalizeAccountAddresses)
        .finally(() => {
          visibleAccountsRequest = null;
        });
    }

    void visibleAccountsRequest
      .then(commitVisibleAccountAddresses)
      .catch(() => undefined);
  }, [commitVisibleAccountAddresses, fetchContactsByAddress]);

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
