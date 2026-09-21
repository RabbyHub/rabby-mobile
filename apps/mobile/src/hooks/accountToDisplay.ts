import { getAllAccountsToDisplay } from '@/core/apis/account';
import { sortAccountsByBalance } from '@/utils/account';
import { atom, useAtom } from 'jotai';
import { useCallback } from 'react';
import type { IDisplayedAccountWithBalance } from '@/types/account';
import { isEqual } from 'lodash';

export type { IDisplayedAccountWithBalance } from '@/types/account';

type IState = {
  accountsList: IDisplayedAccountWithBalance[];
};

const accountToDisplayStateAtom = atom<IState>({
  accountsList: [],
});

let accountsToDisplayRequest: Promise<
  IDisplayedAccountWithBalance[] | null
> | null = null;

export function useAccountsToDisplay() {
  const [{ accountsList }, setAccountToDisplayState] = useAtom(
    accountToDisplayStateAtom,
  );

  const fetchAllAccountsToDisplay = useCallback(async () => {
    if (accountsToDisplayRequest) {
      return accountsToDisplayRequest;
    }

    accountsToDisplayRequest = getAllAccountsToDisplay()
      .then(result => {
        const withBalanceList = sortAccountsByBalance(result);
        setAccountToDisplayState(prev => {
          if (isEqual(prev.accountsList, withBalanceList)) {
            return prev;
          }
          return {
            ...prev,
            accountsList: withBalanceList,
          };
        });
        return withBalanceList;
      })
      .catch(() => null)
      .finally(() => {
        accountsToDisplayRequest = null;
      });

    return accountsToDisplayRequest;
  }, [setAccountToDisplayState]);

  return {
    isLoadingAccounts: !!accountsToDisplayRequest,
    accountsList,
    fetchAllAccountsToDisplay,
  };
}
