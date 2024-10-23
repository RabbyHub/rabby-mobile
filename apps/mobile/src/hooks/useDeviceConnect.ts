import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import React from 'react';
import { useCurrentAccount } from './account';
import { useCommonPopupView } from './useCommonPopupView';
import { useSessionStatus } from './useSessionStatus';

/**
 * some devices require a connection to the device to sign transactions
 *  walletConnect
 */
export const useDeviceConnect = () => {
  const { currentAccount } = useCurrentAccount();
  const walletConnectStatus = useSessionStatus(currentAccount!);
  const { activePopup, setAccount } = useCommonPopupView();

  /**
   * @returns {boolean} true if connected, false if not connected and popup is shown
   */
  const connect = React.useCallback(
    (type: string) => {
      if (type === KEYRING_CLASS.WALLETCONNECT) {
        if (
          !walletConnectStatus.status ||
          walletConnectStatus.status === 'DISCONNECTED'
        ) {
          if (currentAccount) {
            setAccount(currentAccount);
          }
          activePopup('WALLET_CONNECT');
          return false;
        }
      }

      return true;
    },
    [walletConnectStatus.status, currentAccount, activePopup, setAccount],
  );

  return connect;
};
