import { NFTItem } from '@rabby-wallet/rabby-api/dist/types';
import BigNumber from 'bignumber.js';
import { atom, useAtom } from 'jotai';

import { formatNetworth } from '@/utils/math';
import {
  AbstractPortfolioToken,
  ActionHeaderItem,
  DisplayNftItem,
} from '../types';
import { getDisplayedPortfolioUsdValue } from '../utils/converAssets';
import { DisplayedProject } from '../utils/project';
import { formatAmount } from '@/utils/number';
import { useCallback, useEffect, useMemo } from 'react';
import { preferenceService } from '@/core/services';
import { usePinTokens } from '@/screens/Search/usePinTokens';
import { tagTokenList } from '../utils/token';
import { tagProfiles } from './usePortfolio';
import { tagNfts } from './nft';
import { tokenNonceAtom, deFiNonceAtom, nftNonceAtom } from './refresh';

let top20TokensCache: CombineTokensItem[] = [];
let top10PortfoliosCache: CombineDefiItem[] = [];

type DisplayedProjectWithoutMethods = Omit<
  DisplayedProject,
  'setPortfolios' | 'patchHistory' | 'afterHistoryPatched' | 'patchPrice'
>;

type OriginalCombineTokensItem = AbstractPortfolioToken & {
  totalAmount: BigNumber;
  totalUsdValue: BigNumber;
  fromAddress: Array<{
    address: string;
    amount: number;
  }>;
};
export type CombineTokensItem = Omit<
  OriginalCombineTokensItem,
  'totalAmount' | 'totalUsdValue'
> & {
  totalAmount: number;
  totalUsdValue: number;
};

type OriginalCombineDefiItem = DisplayedProjectWithoutMethods & {
  totalUsdValue: BigNumber;
  filterTokenDesc?: string;
  address: string;
};
export type CombineDefiItem = Omit<OriginalCombineDefiItem, 'totalUsdValue'> & {
  totalUsdValue: number;
};

type OriginalCombineNFTItem = NFTItem & {
  totalAmount: BigNumber;
  fromAddress: Array<{
    address: string;
  }>;
};
export type CombineNFTItem = Omit<OriginalCombineNFTItem, 'totalAmount'> & {
  totalAmount: number;
};

type ICombineItem = {
  type: string;
  data?:
    | ActionHeaderItem
    | OriginalCombineTokensItem
    | OriginalCombineDefiItem
    | AbstractPortfolioToken
    | OriginalCombineNFTItem;
};

export interface IAssets {
  portfolios?: DisplayedProject[];
  tokens?: AbstractPortfolioToken[];
  nfts?: DisplayNftItem[];
}

export const combinedTokens = (
  assetsMap: {
    [address: string]: IAssets;
  },
  filter?: {
    chain?: string;
    tokenId?: string;
  },
): CombineTokensItem[] => {
  const { unfoldTokens = [] } =
    preferenceService.getUserTokenSettingsSync() || {};
  const tokenMap: Record<string, OriginalCombineTokensItem> = {};
  const lowerAddresses = new Set(
    Object.keys(assetsMap).map(i => i.toLowerCase()),
  );

  Object.entries(assetsMap).forEach(([address, assets]) => {
    if (!lowerAddresses.has(address.toLowerCase())) {
      return;
    }
    lowerAddresses.delete(address.toLowerCase());
    assets.tokens?.forEach(token => {
      if (filter) {
        if (filter.chain && filter.tokenId) {
          if (
            filter.chain.toLowerCase() !== token.chain.toLowerCase() ||
            filter.tokenId.toLowerCase() !== token._tokenId.toLowerCase()
          ) {
            return;
          }
        }
      }
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

  const coreTokens = Object.values(tokenMap).filter(i => i.is_core);
  const listLength = coreTokens.length || 0;
  const totalValue = coreTokens.reduce(
    (acc, curr) => acc + (curr.totalUsdValue.toNumber() || 0),
    0,
  );
  const threshold = Math.min((totalValue || 0) / 1000, 1000);
  const thresholdIndex = coreTokens
    ? coreTokens.findIndex(m => (m.totalUsdValue.toNumber() || 0) < threshold)
    : -1;

  const hasExpandSwitch =
    listLength >= 15 && thresholdIndex > -1 && thresholdIndex <= listLength - 4;
  return Object.values(tokenMap)
    .sort((a, b) =>
      a.totalUsdValue.gt(b.totalUsdValue)
        ? -1
        : a.totalUsdValue.lt(b.totalUsdValue)
        ? 1
        : 0,
    )
    .map(i => {
      if (
        !hasExpandSwitch ||
        i._isPined ||
        !i.is_core ||
        i._isManualFold ||
        unfoldTokens.some(
          x => x.chainId === i.chain && x.tokenId === i._tokenId,
        )
      ) {
        return {
          ...i,
          totalAmount: i.totalAmount.toNumber(),
          totalUsdValue: i.totalUsdValue?.toNumber(),
          _usdValue: i.totalUsdValue?.toNumber(),
          _usdValueStr: formatNetworth(i.totalUsdValue?.toNumber()),
          _amountStr: formatAmount(i.totalAmount.toNumber()),
        };
      } else {
        return {
          ...i,
          totalAmount: i.totalAmount.toNumber(),
          totalUsdValue: i.totalUsdValue?.toNumber(),
          _usdValue: i.totalUsdValue?.toNumber(),
          _usdValueStr: formatNetworth(i.totalUsdValue?.toNumber()),
          _amountStr: formatAmount(i.totalAmount.toNumber()),
          _isFold: (i.totalUsdValue?.toNumber() || 0) < threshold,
          _isMiniFold: (i.totalUsdValue?.toNumber() || 0) < threshold,
        };
      }
    });
};

export const combinedProtocols = (assetsMap: {
  [address: string]: IAssets;
}): CombineDefiItem[] => {
  const portfolios: OriginalCombineDefiItem[] = [];
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
      portfolios.push({
        ...defi,
        address,
        totalUsdValue: getDisplayedPortfolioUsdValue(defi._portfolios),
      });
    });
  });

  const listLength = portfolios.length || 0;
  const totalValue = portfolios.reduce((acc, curr) => {
    return acc + (curr.totalUsdValue.toNumber() || 0);
  }, 0);
  const threshold = Math.min((totalValue || 0) / 1000, 1000);
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

export const assetAtom = atom<{ [address: string]: IAssets }>({});

export const useAssetsMap = ({
  hideCombined = false,
}: {
  hideCombined?: boolean;
}) => {
  const [assetsMap, setAssetsMap] = useAtom(assetAtom);
  const { handleFetchTokens } = usePinTokens();
  const [tokenNonce, setTokenNonce] = useAtom(tokenNonceAtom);
  const [defiNonce, setDefiNonce] = useAtom(deFiNonceAtom);
  const [nftNonce, setNftNonce] = useAtom(nftNonceAtom);

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
          [lowerAddress]: {
            ...currentAssets,
            tokens: newTokens,
          },
        };
      });
    },
    [setAssetsMap],
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
          [lowerAddress]: {
            ...currentAssets,
            portfolios: newPortfolios,
          },
        };
      });
    },
    [setAssetsMap],
  );
  const updateNFTs = useCallback(
    ({ address, newNFTs }: { address: string; newNFTs: NFTItem[] }) => {
      const lowerAddress = address.toLowerCase();
      setAssetsMap(pre => {
        const currentAssets = pre[lowerAddress] || {};
        return {
          ...pre,
          [lowerAddress]: {
            ...currentAssets,
            nfts: newNFTs,
          },
        };
      });
    },
    [setAssetsMap],
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
  }, [handleFetchTokens, setAssetsMap]);
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
  }, [setAssetsMap]);
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
  }, [setAssetsMap]);

  useEffect(() => {
    if (tokenNonce > 0) {
      refreshTagToken();
      setTokenNonce(0);
    }
  }, [refreshTagToken, setTokenNonce, tokenNonce]);

  useEffect(() => {
    if (defiNonce > 0) {
      refreshTagPortfolio();
      setDefiNonce(0);
    }
  }, [refreshTagPortfolio, defiNonce, setDefiNonce]);

  useEffect(() => {
    if (nftNonce > 0) {
      refreshTagNft();
      setNftNonce(0);
    }
  }, [refreshTagNft, nftNonce, setNftNonce]);

  const getTokenCombined = useCallback(
    (tokenId: string, chain: string) => {
      return combinedTokens(assetsMap, { tokenId, chain });
    },
    [assetsMap],
  );

  const memoTokens = useMemo(() => {
    if (hideCombined) {
      return top20TokensCache;
    }

    const tokens = combinedTokens(assetsMap);
    top20TokensCache = tokens.filter(item => !item._isFold).slice(0, 20);
    return tokens;
  }, [assetsMap, hideCombined]);

  const memoPortfolios = useMemo(() => {
    if (hideCombined) {
      return top10PortfoliosCache;
    }

    const portfolios = combinedProtocols(assetsMap);
    top10PortfoliosCache = portfolios.slice(0, 10);
    return portfolios;
  }, [assetsMap, hideCombined]);

  return {
    updateTokens,
    updatePortfolios,
    updateNFTs,
    tokens: memoTokens,
    portfolios: memoPortfolios,
    assetsMap,
    getTokenCombined,
    setAssetsMap,
  };
};

export const useMainnetTokens = (address?: string) => {
  const [assetsMap, setAssetsMap] = useAtom(assetAtom);
  const updateTokens = useCallback(
    (newTokens: AbstractPortfolioToken[]) => {
      if (!address) {
        return;
      }
      const lowerAddress = address.toLowerCase();
      setAssetsMap(pre => {
        const currentAssets = pre[lowerAddress] || {};
        return {
          ...pre,
          [lowerAddress]: {
            ...currentAssets,
            tokens: newTokens,
          },
        };
      });
    },
    [address, setAssetsMap],
  );
  if (!address) {
    return [[] as AbstractPortfolioToken[], updateTokens] as const;
  }
  return [
    assetsMap[address.toLowerCase()]?.tokens || [],
    updateTokens,
  ] as const;
};

export const useMainnetPortfolios = (address?: string) => {
  const [assetsMap, setAssetsMap] = useAtom(assetAtom);
  const updatePortfolios = useCallback(
    (newPortfolios: DisplayedProject[]) => {
      if (!address) {
        return;
      }
      const lowerAddress = address.toLowerCase();
      setAssetsMap(pre => {
        const currentAssets = pre[lowerAddress] || {};
        return {
          ...pre,
          [lowerAddress]: {
            ...currentAssets,
            portfolios: newPortfolios,
          },
        };
      });
    },
    [address, setAssetsMap],
  );
  if (!address) {
    return [[] as DisplayedProject[], updatePortfolios] as const;
  }
  return [
    assetsMap[address.toLowerCase()]?.portfolios || [],
    updatePortfolios,
  ] as const;
};

export const useMainnetNFTs = (address?: string) => {
  const [assetsMap, setAssetsMap] = useAtom(assetAtom);
  const updateNFTs = useCallback(
    (newNFTs: DisplayNftItem[]) => {
      if (!address) {
        return;
      }
      const lowerAddress = address.toLowerCase();
      setAssetsMap(pre => {
        const currentAssets = pre[lowerAddress] || {};
        return {
          ...pre,
          [lowerAddress]: {
            ...currentAssets,
            nfts: newNFTs,
          },
        };
      });
    },
    [address, setAssetsMap],
  );
  if (!address) {
    return [[] as DisplayNftItem[], updateNFTs] as const;
  }
  return [assetsMap[address.toLowerCase()]?.nfts || [], updateNFTs] as const;
};
