import { contactService } from '@/core/services';
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
      acc[account.address] = account;
      return acc;
    }, {} as Record<string, AccountWithAliasName>);
  }, [accounts]);

  const add = React.useCallback(
    async (address: string) => {
      if (accounts.some(account => account.address === address)) {
        return accounts;
      }
      const alias = await contactService.getAliasByAddress(address)?.alias;
      setAccounts([...accounts, { address, alias }]);
    },
    [accounts, setAccounts],
  );

  const update = React.useCallback(
    (address: string, alias: string) => {
      setAccounts(accounts => {
        return accounts.map(account => {
          if (account.address === address) {
            contactService.updateAlias({ address, name: alias });
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
