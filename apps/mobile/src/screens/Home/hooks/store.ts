import BigNumber from 'bignumber.js';
import {
  AbstractPortfolioToken,
  AbstractProject,
  DisplayNftItem,
} from '../types';
import { useMemo } from 'react';
import { useAccountInfo } from '@/screens/Address/components/MultiAssets/hooks';
import nftListStore, {
  combinedNfts,
  getAssetsMapDirectly,
  useOnNftRefresh,
} from '@/store/nfts';

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

type OriginalCombineDefiItem = AbstractProject & {
  totalUsdValue: BigNumber;
  address: string;
};
export type CombineDefiItem = Omit<OriginalCombineDefiItem, 'totalUsdValue'>;

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

export { useOnNftRefresh };

export const computeAssetsApis = {
  memoNfts: (caredAddresses: string[], nftsMap?: AssetsMapState['nftsMap']) => {
    const globalNftsMap = nftsMap || nftListStore.getState().nftsMap;
    const nfts = combinedNfts(globalNftsMap, caredAddresses);

    return nfts;
  },
};

let top10NftsCache: CombineNFTItem[] = [];
export function useAssetsNFTs({
  hideCombined = false,
}: {
  hideCombined?: boolean;
}) {
  const globalNftsMap = nftListStore(s => s.nftsMap);

  const { myTop10Addresses } = useAccountInfo();

  const memoNfts = useMemo(() => {
    if (hideCombined) {
      return top10NftsCache;
    }
    const nfts = combinedNfts(globalNftsMap, myTop10Addresses);
    top10NftsCache = nfts?.filter(item => !item._isFold).slice(0, 20) || [];
    return nfts;
  }, [hideCombined, globalNftsMap, myTop10Addresses]);

  return {
    nfts: memoNfts,
  };
}
