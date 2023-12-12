import { useEffect, useState } from 'react';
import { canOpenWallet, sortedSupportWallets, WalletService } from './util';
import { useMobileRegistry } from './useMobileRegistry';
import { WALLET_INFO } from '@/utils/walletInfo';

const walletInfoValues = Object.values(WALLET_INFO);
function findWalletInfoById(id: string) {
  const walletInfo = walletInfoValues.find(x => x._wcId === id);
  if (!walletInfo) {
    console.error('walletInfo not found', id);
    return {
      ...WALLET_INFO.UnknownWallet,
      _wcId: id,
    };
  }
  return walletInfo;
}

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

          wallets.forEach(wallet => {
            wallet.walletInfo = findWalletInfoById(wallet.id);
          });

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
