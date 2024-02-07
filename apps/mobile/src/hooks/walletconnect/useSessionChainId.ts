import { getWalletConnectSessionAccount } from '@/core/apis/walletconnect';
import { EVENTS, eventBus } from '@/utils/events';
import { addressUtils } from '@rabby-wallet/base-utils';
import React from 'react';

const { isSameAddress } = addressUtils;

/**
 * @param account
 */
export const useSessionChainId = (
  account?: { address: string; brandName: string },
  pendingConnect?: boolean,
) => {
  const [chainId, setChainId] = React.useState<number>();

  const handleSessionChange = React.useCallback(
    (data: { chainId?: number; address: string; brandName: string }) => {
      if (
        isSameAddress(data.address, account?.address ?? '') &&
        data.brandName === account?.brandName
      ) {
        setChainId(data.chainId);
      }
    },
    [account],
  );

  React.useEffect(() => {
    eventBus.addListener(
      EVENTS.WALLETCONNECT.SESSION_ACCOUNT_CHANGED,
      handleSessionChange,
    );

    return () => {
      eventBus.removeListener(
        EVENTS.WALLETCONNECT.SESSION_ACCOUNT_CHANGED,
        handleSessionChange,
      );
    };
  }, [handleSessionChange, pendingConnect]);

  React.useEffect(() => {
    if (account) {
      getWalletConnectSessionAccount(account.address, account.brandName).then(
        result => result && setChainId(result.chainId),
      );
    }
  }, [account]);

  return chainId;
};
