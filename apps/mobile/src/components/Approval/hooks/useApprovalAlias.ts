import { contactService } from '@/core/services';
import { zCreate } from '@/core/utils/reexports';
import { resolveValFromUpdater, UpdaterOrPartials } from '@/core/utils/store';
import { useShallow } from 'zustand/react/shallow';
import { useCallback, useMemo } from 'react';

type AccountWithAliasName = {
  address: string;
  alias?: string;
};

type AccountsState = {
  accounts: AccountWithAliasName[];
};

const accountsStore = zCreate<AccountsState>(() => ({
  accounts: [],
}));

function setAccounts(valOrFunc: UpdaterOrPartials<AccountWithAliasName[]>) {
  accountsStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev.accounts, valOrFunc);
    return { ...prev, accounts: newVal };
  });
}

export const useApprovalAlias = () => {
  const accounts = accountsStore(useShallow(s => s.accounts));

  const accountMap = useMemo(() => {
    return accounts.reduce((acc, account) => {
      acc[account.address] = account;
      return acc;
    }, {} as Record<string, AccountWithAliasName>);
  }, [accounts]);

  const add = useCallback(
    async (address: string) => {
      if (accounts.some(account => account.address === address)) {
        return accounts;
      }
      const alias = await contactService.getAliasByAddress(address)?.alias;
      setAccounts([...accounts, { address, alias }]);
    },
    [accounts],
  );

  const update = useCallback((address: string, alias: string) => {
    setAccounts(accounts => {
      return accounts.map(account => {
        if (account.address === address) {
          contactService.updateAlias({ address, name: alias });
          return { ...account, alias };
        }
        return account;
      });
    });
  }, []);

  return { accountMap, add, update };
};
