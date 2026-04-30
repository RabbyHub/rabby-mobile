import { getAllAccountsToDisplay } from '@/core/apis/account';
import { sortAccountsByBalance } from '@/utils/account';
import { atom, useAtom } from 'jotai';
import React, { useCallback } from 'react';
import type { IDisplayedAccountWithBalance } from '@/types/account';

export type { IDisplayedAccountWithBalance } from '@/types/account';

type IState = {
  accountsList: IDisplayedAccountWithBalance[];
};

const accountToDisplayStateAtom = atom<IState>({
  accountsList: [],
});

export function useAccountsToDisplay() {
  const [{ accountsList }, setAccountToDisplayState] = useAtom(
    accountToDisplayStateAtom,
  );
  const loadingAccountsRef = React.useRef(false);

  const fetchAllAccountsToDisplay = useCallback(async () => {
    if (loadingAccountsRef.current) return null;
    loadingAccountsRef.current = true;

    try {
      const result = await getAllAccountsToDisplay();
      setAccountToDisplayState(prev => {
        let withBalanceList: IDisplayedAccountWithBalance[] = result;
        if (result) {
          withBalanceList = sortAccountsByBalance(result);
        }
        return {
          ...prev,
          accountsList: withBalanceList,
        };
      });
    } catch (err) {
    } finally {
      loadingAccountsRef.current = false;
      setAccountToDisplayState(prev => ({
        ...prev,
      }));
    }
  }, [setAccountToDisplayState]);

  return {
    isLoadingAccounts: loadingAccountsRef.current,
    accountsList,
    fetchAllAccountsToDisplay,
  };
}
