import { apisWalletConnect } from '@/core/apis';
import { killWalletConnectConnector } from '@/core/apis/walletconnect';
import { CHAINS_LIST } from '@debank/common';
import { useValidWalletServices } from './useValidWalletServices';
import { openWallet } from './util';

const chainIds = CHAINS_LIST.map(chain => !chain.isTestnet && chain.id).filter(
  Boolean,
) as number[];

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
      console.log('chainIds', chainIds);
      const uri = await apisWalletConnect.getUri(service?.brand, chainIds, {
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
