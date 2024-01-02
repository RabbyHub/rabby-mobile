import { getCommonWalletConnectInfo } from '@/core/apis/walletconnect';
import { WALLET_INFO } from '@/utils/walletInfo';
import { KEYRING_TYPE, WALLET_NAME } from '@rabby-wallet/keyring-utils';
import React from 'react';

export const WALLET_BRAND_NAME_KEY: Record<string, string> = {};

Object.keys(WALLET_INFO).forEach(key => {
  WALLET_BRAND_NAME_KEY[WALLET_INFO[key as WALLET_NAME].name] = key;
});

export const useDisplayBrandName = (
  brandName: string = KEYRING_TYPE.WalletConnectKeyring,
  address?: string,
) => {
  const [realBrandName, setRealBrandName] = React.useState(brandName);
  const displayBrandName: string =
    WALLET_INFO[realBrandName as WALLET_NAME]?.name ||
    WALLET_INFO[WALLET_BRAND_NAME_KEY[realBrandName] as WALLET_NAME]?.name ||
    realBrandName;

  React.useEffect(() => {
    if (brandName !== KEYRING_TYPE.WalletConnectKeyring) {
      setRealBrandName(brandName);
      return;
    }
    if (address) {
      getCommonWalletConnectInfo(address).then(result => {
        if (!result) return;
        setRealBrandName(result.realBrandName || result.brandName);
      });
    }
  }, [address, brandName]);

  return [displayBrandName, realBrandName];
};
