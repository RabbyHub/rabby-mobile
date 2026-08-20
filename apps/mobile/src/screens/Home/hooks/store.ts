import BigNumber from 'bignumber.js';
import { AbstractPortfolioToken, DisplayNftItem } from '../types';
import nftListStore, { combinedNfts, getAssetsMapDirectly } from '@/store/nfts';

export type CombineNFTItem = DisplayNftItem & {
  address?: string;
};
type OriginalCombineTokensItem = AbstractPortfolioToken & {
  totalAmount: BigNumber;
  totalUsdValue: BigNumber;
  address: string;
};
export type CombineTokensItem = Omit<
  OriginalCombineTokensItem,
  'totalAmount' | 'totalUsdValue'
> & {
  totalAmount: number;
  totalUsdValue: number;
};

export type AssetsMapState = {
  nftsMap: { [address: string]: DisplayNftItem[] };
};

export const assetsMapStore = nftListStore;

export function updateAssetListByAddress(
  address: string,
  payload: {
    type: 'nfts';
    data: DisplayNftItem[];
  },
) {
  switch (payload.type) {
    default: {
      console.warn('Invalid asset type for updateAssetListByAddress');
      return;
    }
    case 'nfts': {
      nftListStore.getState().updateNFTListByAddress(address, payload.data);
      break;
    }
  }
}

export const useAssetsMap = () => {
  const nftsMap = nftListStore(s => s.nftsMap);

  return {
    nftsMap,
    getAssetsMapDirectly,
  };
};

export const computeAssetsApis = {
  memoNfts: (caredAddresses: string[], nftsMap?: AssetsMapState['nftsMap']) => {
    const globalNftsMap = nftsMap || nftListStore.getState().nftsMap;
    const nfts = combinedNfts(globalNftsMap, caredAddresses);

    return nfts;
  },
};
