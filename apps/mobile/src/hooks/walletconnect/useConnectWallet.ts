import { apisWalletConnect } from '@/core/apis';
import { killWalletConnectConnector } from '@/core/apis/walletconnect';
import { useValidWalletServices } from './useValidWalletServices';
import { openWallet } from './util';

export const useConnectWallet = () => {
  const { findWalletServiceByBrandName } = useValidWalletServices();

  const connectWallet = async ({
    address,
    brandName,
    chainId = 1,
  }: {
    address: string;
    brandName: string;
    chainId?: number;
  }) => {
    killWalletConnectConnector(address, brandName, true);
    const service = findWalletServiceByBrandName(brandName);
    if (service) {
      const uri = await apisWalletConnect.getUri(service?.brand, chainId, {
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
