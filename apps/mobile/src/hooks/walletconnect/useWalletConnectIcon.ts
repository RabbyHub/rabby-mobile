import { apisWalletConnect } from '@/core/apis';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import React from 'react';

export const useWalletConnectIcon = (
  account:
    | {
        address: string;
        brandName: string;
        type: string;
      }
    | undefined
    | null,
) => {
  const [url, setUrl] = React.useState<string>();

  React.useEffect(() => {
    if (!account) {
      return;
    }
    if (account.type !== KEYRING_CLASS.WALLETCONNECT) {
      return;
    }

    apisWalletConnect
      .getCommonWalletConnectInfo(account.address)
      .then(result => {
        if (!result) {
          return;
        }

        setUrl(result.realBrandUrl);
      });
  }, [account]);

  return url;
};
