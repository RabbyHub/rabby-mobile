import { NFTItem } from '@rabby-wallet/rabby-api/dist/types';
import BigNumber from 'bignumber.js';
import { atom, useAtom } from 'jotai';

import { formatNetworth } from '@/utils/math';
import { AbstractPortfolioToken, DisplayNftItem } from '../types';
import { getDisplayedPortfolioUsdValue } from '../utils/converAssets';
import { DisplayedProject } from '../utils/project';
import { formatAmount } from '@/utils/number';
import { FlatList } from 'react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { preferenceService } from '@/core/services';
import { usePinTokens } from '@/screens/Search/usePinTokens';
import { tagTokenList } from '../utils/token';
import { tagProfiles } from './usePortfolio';
import { tagNfts } from './nft';
import { tokenNounceAtom, deFiNounceAtom, nftNounceAtom } from './refresh';

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
  filterTokenDesc?: string;
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
  const { handleFetchTokens } = usePinTokens();
  const [tokenNounce, setTokenNounce] = useAtom(tokenNounceAtom);
  const [defiNounce, setDefiNounce] = useAtom(deFiNounceAtom);
  const [nftNounce, setNftNounce] = useAtom(nftNounceAtom);

  const updateTokens = useCallback(
    ({
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
    },
    [],
  );

  const updatePortfolios = useCallback(
    ({
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
    },
    [],
  );
  const updateNFTs = useCallback(
    ({ address, newNFTs }: { address: string; newNFTs: NFTItem[] }) => {
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
    },
    [],
  );

  const refreshTagToken = useCallback(async () => {
    const tokenSettings =
      (await preferenceService.getUserTokenSettings()) || {};
    handleFetchTokens();
    setAssetsMap(prevAssetsMap => {
      const updatedAssetsMap: { [address: string]: IAssets } = {};
      Object.entries(prevAssetsMap).forEach(([address, assets]) => {
        updatedAssetsMap[address] = {
          ...assets,
          tokens: tagTokenList(assets.tokens || [], tokenSettings),
        };
      });

      return updatedAssetsMap;
    });
  }, [handleFetchTokens]);
  const refreshTagPortfolio = useCallback(async () => {
    const tokenSettings =
      (await preferenceService.getUserTokenSettings()) || {};

    setAssetsMap(prevAssetsMap => {
      const updatedAssetsMap: { [address: string]: IAssets } = {};
      Object.entries(prevAssetsMap).forEach(([address, assets]) => {
        if (!assets) {
          return;
        }
        updatedAssetsMap[address] = {
          ...assets,
          portfolios: tagProfiles(assets.portfolios || [], tokenSettings),
        };
      });

      return updatedAssetsMap;
    });
  }, []);
  const refreshTagNft = useCallback(async () => {
    const tokenSettings =
      (await preferenceService.getUserTokenSettings()) || {};
    setAssetsMap(prevAssetsMap => {
      const updatedAssetsMap: { [address: string]: IAssets } = {};
      Object.entries(prevAssetsMap).forEach(([address, assets]) => {
        updatedAssetsMap[address] = {
          ...assets,
          nfts: tagNfts(assets.nfts || [], tokenSettings),
        };
      });

      return updatedAssetsMap;
    });
  }, []);

  useEffect(() => {
    if (tokenNounce > 0) {
      refreshTagToken();
      setTokenNounce(0);
    }
  }, [refreshTagToken, setTokenNounce, tokenNounce]);

  useEffect(() => {
    if (defiNounce > 0) {
      refreshTagPortfolio();
      setDefiNounce(0);
    }
  }, [refreshTagPortfolio, defiNounce, setDefiNounce]);

  useEffect(() => {
    if (nftNounce > 0) {
      refreshTagNft();
      setNftNounce(0);
    }
  }, [refreshTagNft, nftNounce, setNftNounce]);

  const memoTokens = useMemo(() => {
    return combinedTokens(assetsMap);
  }, [assetsMap]);

  const memoPortfolios = useMemo(() => {
    return combinedProtocols(assetsMap);
  }, [assetsMap]);

  const memoNFTs = useMemo(() => {
    return combinedNFTs(assetsMap);
  }, [assetsMap]);

  return {
    updateTokens,
    updatePortfolios,
    updateNFTs,
    tokens: memoTokens,
    portfolios: memoPortfolios,
    nftList: memoNFTs,
    assetsMap,
    setAssetsMap,
  };
};
