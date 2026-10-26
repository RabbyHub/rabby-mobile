import {
  contactServiceApi,
  getContactAliasSnapshot,
} from '@/core/serviceApi/contact';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { atom, useAtom } from 'jotai';
import React from 'react';

type AccountWithAliasName = {
  address: string;
  alias?: string;
};

const accountsAtom = atom<AccountWithAliasName[]>([]);

export const useApprovalAlias = () => {
  const [accounts, setAccounts] = useAtom(accountsAtom);

  const accountMap = React.useMemo(() => {
    return accounts.reduce((acc, account) => {
      acc[account.address.toLowerCase()] = account;
      return acc;
    }, {} as Record<string, AccountWithAliasName>);
  }, [accounts]);

  const add = React.useCallback(
    async (address: string) => {
      const normalizedAddress = address.toLowerCase();
      if (accounts.some(account => isSameAddress(account.address, address))) {
        return accounts;
      }
      const alias = getContactAliasSnapshot(normalizedAddress)?.alias;
      setAccounts([...accounts, { address: normalizedAddress, alias }]);
    },
    [accounts, setAccounts],
  );

  const update = React.useCallback(
    (address: string, alias: string) => {
      const normalizedAddress = address.toLowerCase();
      setAccounts(accounts => {
        return accounts.map(account => {
          if (isSameAddress(account.address, address)) {
            contactServiceApi
              .updateAlias({ address: normalizedAddress, name: alias })
              .catch(error => {
                console.error('[useApprovalAlias] update alias failed', error);
              });
            return { ...account, alias };
          }
          return account;
        });
      });
    },
    [setAccounts],
  );

  return { accountMap, add, update };
};
