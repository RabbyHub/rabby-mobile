import { dappService, preferenceService } from '@/core/services';
import { DappInfo } from '@/core/services/dappService';
import React from 'react';
import { useCurrentAccount } from './account';

/**
 * auto activate and inactivate last used account in dapp
 */
export const useDappLastUsedAccount = () => {
  const { switchAccount } = useCurrentAccount();

  const doSwitchAccount = React.useCallback(() => {
    const account = preferenceService.getCurrentAccount();
    if (account) {
      switchAccount(account);
    }
  }, [switchAccount]);

  const activate = React.useCallback(
    (dapp: DappInfo) => {
      const prevAccount = preferenceService.getCurrentAccount();

      if (prevAccount) {
        preferenceService.store.tempCurrentAccount = prevAccount;
      }

      dapp.currentAccount && switchAccount(dapp.currentAccount);
    },
    [switchAccount],
  );

  const inactivate = React.useCallback(() => {
    preferenceService.inactivateLastUsedAccount();
    doSwitchAccount();
  }, [doSwitchAccount]);

  const updateAccount = React.useCallback(
    (dapp: DappInfo) => {
      dappService.updateDapp(dapp);

      if (dapp.currentAccount) {
        switchAccount(dapp.currentAccount);
      }
    },
    [switchAccount],
  );

  return {
    activate,
    inactivate,
    updateAccount,
  };
};
