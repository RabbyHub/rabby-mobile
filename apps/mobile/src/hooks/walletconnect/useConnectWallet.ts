import { apisWalletConnect } from '@/core/apis';
import { killWalletConnectConnector } from '@/core/apis/walletconnect';
import { useValidWalletServices } from './useValidWalletServices';
import { openWallet } from './util';

export const useConnectWallet = () => {
  const { findWalletServiceByBrandName } = useValidWalletServices();

  const connectWallet = async ({
    address,
    brandName,
  }: {
    address: string;
    brandName: string;
  }) => {
    killWalletConnectConnector(address, brandName, true);
    const service = findWalletServiceByBrandName(brandName);
    if (service) {
      const uri = await apisWalletConnect.getUri(service?.brand, {
        address,
        brandName,
      });
      if (uri) {
        openWallet(service, uri);
      }
    }
  };

  return connectWallet;
};
