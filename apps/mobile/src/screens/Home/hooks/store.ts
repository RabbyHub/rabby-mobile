import BigNumber from 'bignumber.js';

import { formatNetworth } from '@/utils/math';
import {
  AbstractPortfolioToken,
  AbstractProject,
  DisplayNftItem,
} from '../types';
import { DisplayedProject } from '../utils/project';
import { useCallback, useEffect, useMemo } from 'react';
import { tagNfts } from './nft';
// import { tokenNonceAtom, deFiNonceAtom, nftNonceAtom } from './refresh';
import { useAccountInfo } from '@/screens/Address/components/MultiAssets/hooks';
import { zCreate } from '@/core/utils/reexports';
import { resolveValFromUpdater, UpdaterOrPartials } from '@/core/utils/store';
import { eventBus, EventBusListeners } from '@/utils/events';

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
  filterTokenDesc?: string;
  address: string;
};
export type CombineDefiItem = Omit<OriginalCombineDefiItem, 'totalUsdValue'>;

type OriginalCombineNFTItem = DisplayNftItem & {
  address?: string;
};
export type CombineNFTItem = OriginalCombineNFTItem;

export interface IAssets {
  portfolios?: DisplayedProject[];
  tokens?: AbstractPortfolioToken[];
  nfts?: DisplayNftItem[];
}

// function encodePortfolioKey(chain: string, id: string) {
//   return `${chain.toLowerCase()}-${id.toLowerCase()}`;
// }

export const combinedProtocols = (
  portfoliosMap: { [address: string]: DisplayedProject[] },
  caredAddresses: string[],
): CombineDefiItem[] => {
  const portfolios: OriginalCombineDefiItem[] = [];
  const lowerAddresses = new Set(
    Object.keys(portfoliosMap).map(i => i.toLowerCase()) || [],
  );
  const caredAddressesSet = new Set(caredAddresses.map(i => i.toLowerCase()));
  Object.entries(portfoliosMap).forEach(([address, portfolioList]) => {
    if (
      !lowerAddresses.has(address.toLowerCase()) ||
      !caredAddressesSet.has(address.toLowerCase())
    ) {
      return;
    }
    lowerAddresses.delete(address.toLowerCase());
    portfolioList?.forEach(defi => {
      const key = defi.id;
      if (!key) {
        return;
      }
      portfolios.push({
        ...defi,
        address,
        totalUsdValue: new BigNumber(defi.netWorth),
      });
    });
  });

  const listLength = portfolios.length || 0;
  const totalValue = portfolios.reduce((acc, curr) => {
    return acc + (curr.totalUsdValue.toNumber() || 0);
  }, 0);
  const threshold = Math.min((totalValue || 0) / 100, 1000);
  const thresholdIndex = portfolios
    ? portfolios.findIndex(m => (m.totalUsdValue.toNumber() || 0) < threshold)
    : -1;

  const hasExpandSwitch =
    listLength >= 15 && thresholdIndex > -1 && thresholdIndex <= listLength - 4;

  return portfolios
    .sort((a, b) =>
      a.totalUsdValue.gt(b.totalUsdValue)
        ? -1
        : a.totalUsdValue.lt(b.totalUsdValue)
        ? 1
        : 0,
    )
    .map(p => ({
      ...p,
      totalUsdValue: p.totalUsdValue.toNumber(),
      _netWorth: formatNetworth(p.totalUsdValue?.toNumber()),
      _isFold: hasExpandSwitch ? p.totalUsdValue.toNumber() < threshold : false,
      _isMiniFold: hasExpandSwitch
        ? p.totalUsdValue.toNumber() < threshold
        : false,
    }));
};

// function encodeNftKey(chain: string, id: string) {
//   return `${chain.toLowerCase()}-${id.toLowerCase()}`;
// }

export const combinedNfts = (
  nftsMap: { [address: string]: DisplayNftItem[] },
  caredAddresses: string[],
): CombineNFTItem[] => {
  const nfts: OriginalCombineNFTItem[] = [];
  const lowerAddresses = new Set(
    Object.keys(nftsMap).map(i => i.toLowerCase()) || [],
  );
  const caredAddressesSet = new Set(caredAddresses.map(i => i.toLowerCase()));
  Object.entries(nftsMap).forEach(([address, nftList]) => {
    if (
      !lowerAddresses.has(address.toLowerCase()) ||
      !caredAddressesSet.has(address.toLowerCase())
    ) {
      return;
    }
    lowerAddresses.delete(address.toLowerCase());
    nftList?.forEach(nft => {
      const key = nft.id;
      if (!key) {
        return;
      }
      nfts.push({
        ...nft,
        address,
      });
    });
  });

  return nfts;
};

export type AssetsMapState = {
  tokensMap: { [address: string]: AbstractPortfolioToken[] };
  portfoliosMap: { [address: string]: DisplayedProject[] };
  nftsMap: { [address: string]: DisplayNftItem[] };
};
export const assetsMapStore = zCreate<AssetsMapState>(() => ({
  tokensMap: {},
  portfoliosMap: {},
  nftsMap: {},
}));

function setNftsMap(valOrFunc: UpdaterOrPartials<AssetsMapState['nftsMap']>) {
  assetsMapStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev.nftsMap, valOrFunc, {
      strict: false,
    });

    return { ...prev, nftsMap: newVal };
  });
}

type GetAssetsFunc = <T extends 'tokens' | 'portfolios' | 'nfts'>(
  type: T,
) => T extends 'tokens'
  ? { [address: string]: AbstractPortfolioToken[] }
  : T extends 'portfolios'
  ? { [address: string]: DisplayedProject[] }
  : { [address: string]: DisplayNftItem[] };
export const getAssetsMapDirectly = (type => {
  switch (type) {
    case 'tokens': {
      const tokensMap = assetsMapStore.getState().tokensMap;
      return tokensMap;
    }
    case 'portfolios': {
      const portfoliosMap = assetsMapStore.getState().portfoliosMap;
      return portfoliosMap;
    }
    case 'nfts': {
      const nftsMap = assetsMapStore.getState().nftsMap;
      return nftsMap;
    }
    default: {
      console.warn('Invalid asset type requested');
      return {};
    }
  }
}) as GetAssetsFunc;

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
      const lowerAddress = address.toLowerCase();
      setNftsMap(pre => ({
        ...pre,
        [lowerAddress]: payload.data,
      }));
      break;
    }
  }
}

export const useAssetsMap = () => {
  const tokensMap = assetsMapStore(s => s.tokensMap);
  const portfoliosMap = assetsMapStore(s => s.portfoliosMap);
  const nftsMap = assetsMapStore(s => s.nftsMap);

  return {
    tokensMap,
    portfoliosMap,
    nftsMap,
    getAssetsMapDirectly,
  };
};

export function useOnNftRefresh() {
  const refreshTagNft = useCallback(async () => {
    setNftsMap(prevNftsMap => {
      const updatedNftsMap: { [address: string]: DisplayNftItem[] } = {};
      Object.entries(prevNftsMap).forEach(([address, nfts]) => {
        updatedNftsMap[address] = tagNfts(nfts || []);
      });

      return updatedNftsMap;
    });
  }, []);
  useEffect(() => {
    const onRequestRefreshAssets: EventBusListeners['EVENT_REFRESH_ASSET'] =
      type => {
        if (type !== 'nftNonce') {
          return;
        }
        refreshTagNft();
      };
    eventBus.on('EVENT_REFRESH_ASSET', onRequestRefreshAssets);

    return () => {
      eventBus.off('EVENT_REFRESH_ASSET', onRequestRefreshAssets);
    };
  }, [refreshTagNft]);
}

export const computeAssetsApis = {
  memoPortfolios: (
    caredAddresses: string[],
    portfoliosMap?: AssetsMapState['portfoliosMap'],
  ) => {
    const globalPortfoliosMap =
      portfoliosMap || assetsMapStore.getState().portfoliosMap;
    const portfolios = combinedProtocols(globalPortfoliosMap, caredAddresses);

    return portfolios;
  },
  memoNfts: (caredAddresses: string[], nftsMap?: AssetsMapState['nftsMap']) => {
    const globalNftsMap = nftsMap || assetsMapStore.getState().nftsMap;
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
  const globalNftsMap = assetsMapStore(s => s.nftsMap);

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
