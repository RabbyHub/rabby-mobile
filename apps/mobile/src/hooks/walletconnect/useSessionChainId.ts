import { getWalletConnectSessionAccount } from '@/core/apis/walletconnect';
import { EVENTS, eventBus } from '@/utils/events';
import { addressUtils } from '@rabby-wallet/base-utils';
import React from 'react';

const { isSameAddress } = addressUtils;

const listeners = new Map<string, (data: any) => void>();

const handleGlobalSessionChange = (data: {
  chainId?: number;
  address: string;
  brandName: string;
}) => {
  listeners.forEach(listener => {
    listener(data);
  });
};

eventBus.addListener(
  EVENTS.WALLETCONNECT.SESSION_ACCOUNT_CHANGED,
  handleGlobalSessionChange,
);

/**
 * @param account
 */
export const useSessionChainId = (
  account?: { address: string; brandName: string },
  pendingConnect?: boolean,
) => {
  const [chainId, setChainId] = React.useState<number>();

  React.useEffect(() => {
    const handleSessionChange = (data: {
      chainId?: number;
      address: string;
      brandName: string;
    }) => {
      if (
        isSameAddress(data.address, account?.address ?? '') &&
        data.brandName === account?.brandName
      ) {
        setChainId(data.chainId);
      }
    };

    listeners.set(
      `${account?.address}|${account?.brandName}`,
      handleSessionChange,
    );

    return () => {
      listeners.delete(`${account?.address}|${account?.brandName}`);
    };
  }, [account, pendingConnect]);

  React.useEffect(() => {
    if (account) {
      getWalletConnectSessionAccount(account.address, account.brandName).then(
        result => result && setChainId(result.chainId),
      );
    }
  }, [account]);

  return chainId;
};
