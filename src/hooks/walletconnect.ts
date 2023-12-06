import { useEffect, useState } from 'react';
import {
  canOpenWallet,
  sortedSupportWallets,
  WalletService,
} from '../utils/walletconnect';
import { useMobileRegistry } from './query';

export const useValidWalletServices = () => {
  const { error: walletServicesError, data: walletServices } =
    useMobileRegistry();
  const [validServices, setValidServices] = useState<Array<WalletService>>([]);
  const [isLoading, setLoading] = useState(true);

  useEffect(() => {
    if (walletServices?.length) {
      // console.log('walletServices', walletServices);
      Promise.all(walletServices.map(canOpenWallet))
        .then(canOpened => {
          // console.log('canOpened', canOpened);
          const wallets = walletServices.filter((x, i) => canOpened[i]);
          wallets.sort(
            (m, n) =>
              sortedSupportWallets[m.id].sort - sortedSupportWallets[n.id].sort,
          );

          setValidServices(wallets);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [walletServices, setLoading]);

  return {
    isLoading,
    validServices,
    walletServicesError,
  };
};
