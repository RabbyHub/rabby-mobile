import { preferenceService } from '@/core/services';
import React from 'react';
import { useCurrentAccount } from './account';

/**
 * auto activate and inactivate last used account in screen
 */
export const useLastUsedAccountInScreen = () => {
  const { switchAccount } = useCurrentAccount();

  const doSwitchAccount = React.useCallback(() => {
    const account = preferenceService.getCurrentAccount();
    if (account) {
      switchAccount(account);
    }
  }, [switchAccount]);

  const activate = React.useCallback(() => {
    preferenceService.activateLastUsedAccount().then(doSwitchAccount);
  }, [doSwitchAccount]);

  const inactivate = React.useCallback(() => {
    preferenceService.inactivateLastUsedAccount();
    doSwitchAccount();
  }, [doSwitchAccount]);

  React.useEffect(() => {
    activate();
    return inactivate;
  }, [activate, inactivate]);

  return {
    activate,
    inactivate,
  };
};
