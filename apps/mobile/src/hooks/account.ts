import React, { useRef, useCallback } from 'react';

import { atom, useAtom } from 'jotai';
import { KeyringAccount } from '@rabby-wallet/keyring-utils';
import { contactService, keyringService } from '@/core/services';

type KeyringAccountWithAlias = KeyringAccount & {
  aliasName?: string;
};

const accountsAtom = atom<KeyringAccountWithAlias[]>([]);

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
          return {
            ...account,
            aliasName: '',
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

  React.useEffect(() => {
    if (!disableAutoFetch) {
      fetchAccounts();
    }
  }, [disableAutoFetch, fetchAccounts]);

  return {
    accounts,
    fetchAccounts,
  };
}
