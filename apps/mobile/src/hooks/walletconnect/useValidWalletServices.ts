import { useCallback, useEffect, useState } from 'react';
import { canOpenWallet, openWallet } from './util';
import { WalletInfo, WALLET_INFO } from '@/utils/walletInfo';
import { apisWalletConnect } from '@/core/apis';

const walletInfoValues = Object.values(WALLET_INFO);

export const useValidWalletServices = () => {
  const [validServices, setValidServices] = useState<Array<WalletInfo>>([]);
  const [isLoading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all(walletInfoValues.map(canOpenWallet))
      .then(canOpened => {
        const wallets = walletInfoValues.filter((x, i) => canOpened[i]);

        setValidServices(wallets);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [setLoading]);

  const findWalletServiceByBrandName = useCallback(
    (brandName: string) => {
      const service = validServices.find(s => s.brand === brandName);

      return service;
    },
    [validServices],
  );

  const openWalletByBrandName = useCallback(
    (brandName: string, deepLink?: string) => {
      const service = findWalletServiceByBrandName(brandName);
      if (service) {
        openWallet(service, deepLink);
      }
    },
    [findWalletServiceByBrandName],
  );

  const openWalletByAccount = useCallback(
    (account: { address: string; brandName: string }) => {
      apisWalletConnect
        .getDeepLink({
          address: account?.address,
          brandName: account?.brandName,
        })
        .then(uri => {
          if (uri) {
            openWalletByBrandName(account.brandName, uri);
          }
        });
    },
    [openWalletByBrandName],
  );

  return {
    isLoading,
    validServices,
    findWalletServiceByBrandName,
    openWalletByBrandName,
    openWalletByAccount,
  };
};
