import { preferenceService } from '@/core/services';
import React from 'react';
import { useCurrentAccount } from './account';

/**
 *
 * @description auto activate and inactivate last used account in screen
 *
 * @warning make sure only this hook can be ONLY called ONCE in nested components,
 * or it will cause infinite loop. It's recommend to put it within the component
 * holding <AccountSwitcherModal /> in it
 */
export const useLastUsedAccountInScreen = (options?: {
  disableAutoEffect?: boolean;
}) => {
  const { disableAutoEffect = false } = options || {};
  const { currentAccount, switchAccount } = useCurrentAccount();

  const doSwitchAccount = React.useCallback(() => {
    const account = preferenceService.getCurrentAccount();
    if (account) {
      switchAccount(account);
    }
  }, [switchAccount]);

  const activate = React.useCallback(async () => {
    preferenceService.activateLastUsedAccount().then(doSwitchAccount);
  }, [doSwitchAccount]);

  const inactivate = React.useCallback(() => {
    preferenceService.inactivateLastUsedAccount();
    doSwitchAccount();
  }, [doSwitchAccount]);

  React.useEffect(() => {
    if (disableAutoEffect) return;

    activate();
    return inactivate;
  }, [disableAutoEffect, activate, inactivate]);

  return {
    currentAccount,
    activate,
    inactivate,
  };
};
