import { NFTItem } from '@rabby-wallet/rabby-api/dist/types';
import BigNumber from 'bignumber.js';
import { atom } from 'jotai';

import { formatNetworth } from '@/utils/math';
import { AbstractPortfolioToken, DisplayNftItem } from '../types';
import { getDisplayedPortfolioUsdValue } from '../utils/converAssets';
import { DisplayedProject } from '../utils/project';
import { formatAmount } from '@/utils/number';
import { FlatList } from 'react-native';
import { useState } from 'react';

export type CombineTokensItem = AbstractPortfolioToken & {
  totalAmount: BigNumber;
  totalUsdValue: BigNumber;
  fromAddress: Array<{
    address: string;
    amount: number;
  }>;
};

type DisplayedProjectWithoutMethods = Omit<
  DisplayedProject,
  'setPortfolios' | 'patchHistory' | 'afterHistoryPatched' | 'patchPrice'
>;

export type CombineDefiItem = DisplayedProjectWithoutMethods & {
  totalUsdValue: BigNumber;
  fromAddress: Array<{
    address: string;
  }>;
};

export type CombineNFTItem = NFTItem & {
  totalAmount: BigNumber;
  fromAddress: Array<{
    address: string;
  }>;
};

export interface IAssets {
  portfolios?: DisplayedProject[];
  tokens?: AbstractPortfolioToken[];
  nfts?: DisplayNftItem[];
  lastUpdateTime?: number;
}

export const flatListRefAtom = atom<React.RefObject<FlatList> | null>(null);

export const combinedTokens = (assetsMap: {
  [address: string]: IAssets;
}): CombineTokensItem[] => {
  const tokenMap: Record<string, CombineTokensItem> = {};
  const lowerAddresses = new Set(
    Object.keys(assetsMap).map(i => i.toLowerCase()),
  );

  Object.entries(assetsMap).forEach(([address, assets]) => {
    if (!lowerAddresses.has(address.toLowerCase())) {
      return;
    }
    lowerAddresses.delete(address.toLowerCase());
    assets.tokens?.forEach(token => {
      const key = `${token._tokenId}-${token.chain}`;
      if (!tokenMap[key]) {
        tokenMap[key] = {
          ...token,
          totalAmount: new BigNumber(token.amount || 0),
          totalUsdValue: new BigNumber(token._usdValue || 0),
          fromAddress: [
            {
              address,
              amount: token.amount,
            },
          ],
        };
      } else {
        const existingToken = tokenMap[key];
        existingToken.totalAmount = existingToken.totalAmount.plus(
          token.amount || 0,
        );
        existingToken.totalUsdValue = existingToken.totalUsdValue?.plus(
          token._usdValue || 0,
        );
        existingToken.fromAddress.push({
          address,
          amount: token.amount,
        });
      }
    });
  });

  return Object.values(tokenMap)
    .sort((a, b) =>
      a.totalUsdValue.gt(b.totalUsdValue)
        ? -1
        : a.totalUsdValue.lt(b.totalUsdValue)
        ? 1
        : 0,
    )
    .map(i => ({
      ...i,
      totalAmount: i.totalAmount.toNumber(),
      totalUsdValue: i.totalUsdValue?.toNumber(),
      _usdValue: i.totalUsdValue?.toNumber(),
      _usdValueStr: formatNetworth(i.totalUsdValue?.toNumber()),
      _amountStr: formatAmount(i.totalAmount.toNumber()),
    }));
};

export const combinedProtocols = (assetsMap: {
  [address: string]: IAssets;
}): CombineDefiItem[] => {
  const defiMap: Record<string, CombineDefiItem> = {};
  const lowerAddresses = new Set(
    Object.keys(assetsMap).map(i => i.toLowerCase()) || [],
  );
  Object.entries(assetsMap).forEach(([address, assets]) => {
    if (!lowerAddresses.has(address.toLowerCase())) {
      return;
    }
    lowerAddresses.delete(address.toLowerCase());
    assets.portfolios?.forEach(defi => {
      const key = defi.id;
      if (!key) {
        return;
      }

      if (!defiMap[key]) {
        defiMap[key] = {
          ...defi,
          totalUsdValue: getDisplayedPortfolioUsdValue(defi._portfolios),
          fromAddress: [
            {
              address,
            },
          ],
        };
      } else {
        const existingDefi = defiMap[key];
        existingDefi.totalUsdValue = existingDefi.totalUsdValue?.plus(
          getDisplayedPortfolioUsdValue(defi._portfolios),
        );
        existingDefi.fromAddress.push({
          address,
        });
      }
    });
  });

  return Object.values(defiMap)
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
    }));
};

export const combinedNFTs = (assetsMap: {
  [address: string]: IAssets;
}): CombineNFTItem[] => {
  const nftMap: Record<string, CombineNFTItem> = {};
  const lowerAddresses = new Set(
    Object.keys(assetsMap).map(i => i.toLowerCase()) || [],
  );
  Object.entries(assetsMap).forEach(([address, assets]) => {
    if (!lowerAddresses.has(address.toLowerCase())) {
      return;
    }
    lowerAddresses.delete(address.toLowerCase());
    assets.nfts?.forEach(nft => {
      const key = `${nft.chain}-${nft.id}-${nft.name || ''}`;
      if (!key) {
        return;
      }

      if (!nftMap[key]) {
        nftMap[key] = {
          ...nft,
          totalAmount: new BigNumber(nft.amount || 0),
          fromAddress: [
            {
              address,
            },
          ],
        };
      } else {
        const existingNFT = nftMap[key];
        existingNFT.totalAmount = existingNFT.totalAmount?.plus(
          nft.amount || 0,
        );
        existingNFT.fromAddress.push({
          address,
        });
      }
    });
  });

  return Object.values(nftMap)
    .sort((a, b) =>
      a.totalAmount.gt(b.totalAmount)
        ? -1
        : a.totalAmount.lt(b.totalAmount)
        ? 1
        : 0,
    )
    .map(nft => ({
      ...nft,
      totalAmount: nft.totalAmount.toNumber(),
      amount: nft.totalAmount?.toNumber() || 0,
    }));
};

export const useAssetsMap = () => {
  const [assetsMap, setAssetsMap] = useState<{ [address: string]: IAssets }>(
    {},
  );
  const updateTokens = ({
    address,
    newTokens,
  }: {
    address: string;
    newTokens: AbstractPortfolioToken[];
  }) => {
    const lowerAddress = address.toLowerCase();
    setAssetsMap(pre => {
      const currentAssets = pre[lowerAddress] || {};
      return {
        ...pre,
        [address]: {
          ...currentAssets,
          tokens: newTokens,
        },
      };
    });
  };

  const updatePortfolios = ({
    address,
    newPortfolios,
  }: {
    address: string;
    newPortfolios: DisplayedProject[];
  }) => {
    const lowerAddress = address.toLowerCase();
    setAssetsMap(pre => {
      const currentAssets = pre[lowerAddress] || {};
      return {
        ...pre,
        [address]: {
          ...currentAssets,
          portfolios: newPortfolios,
        },
      };
    });
  };
  const updateNFTs = ({
    address,
    newNFTs,
  }: {
    address: string;
    newNFTs: NFTItem[];
  }) => {
    const lowerAddress = address.toLowerCase();
    setAssetsMap(pre => {
      const currentAssets = pre[lowerAddress] || {};
      return {
        ...pre,
        [address]: {
          ...currentAssets,
          nfts: newNFTs,
        },
      };
    });
  };

  return {
    updateTokens,
    updatePortfolios,
    updateNFTs,
    tokens: combinedTokens(assetsMap),
    portfolios: combinedProtocols(assetsMap),
    nftList: combinedNFTs(assetsMap),
    assetsMap,
    setAssetsMap,
  };
};
