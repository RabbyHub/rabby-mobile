import { apiAccount, apiBalance, apiKeyring } from '@/core/apis';
import { getAllAccountsToDisplay } from '@/core/apis/account';
import { contactService, keyringService } from '@/core/services';
import { sortAccountsByBalance } from '@/utils/account';
import { DisplayedKeyring } from '@rabby-wallet/keyring-utils';
import { TotalBalanceResponse } from '@rabby-wallet/rabby-api/dist/types';
import { zCreate } from '@/core/utils/reexports';
import { resolveValFromUpdater, UpdaterOrPartials } from '@/core/utils/store';
import { useShallow } from 'zustand/react/shallow';
import React, { useCallback } from 'react';

type IDisplayedAccount = Required<DisplayedKeyring['accounts'][number]>;
export type IDisplayedAccountWithBalance = IDisplayedAccount & {
  balance: number;
  byImport?: boolean;
  publicKey?: string;
  hdPathBasePublicKey?: string;
  hdPathType?: string;
};

type IState = {
  accountsList: IDisplayedAccountWithBalance[];
};

const accountToDisplayStateStore = zCreate<IState>(() => ({
  accountsList: [],
}));

function setAccountToDisplayState(valOrFunc: UpdaterOrPartials<IState>) {
  accountToDisplayStateStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev, valOrFunc);
    return { ...prev, ...newVal };
  });
}

export function useAccountsToDisplay() {
  const { accountsList } = accountToDisplayStateStore(useShallow(s => s));
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
  }, []);

  return {
    isLoadingAccounts: loadingAccountsRef.current,
    accountsList,
    fetchAllAccountsToDisplay,
  };
}
