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
import { useAccountInfo } from '@/screens/Address/components/MultiAssets/hooks';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { useAtomCallback } from 'jotai/utils';

let top20TokensCache: CombineTokensItem[] = [];
let top10PortfoliosCache: CombineDefiItem[] = [];

type DisplayedProjectWithoutMethods = Omit<
  DisplayedProject,
  'setPortfolios' | 'patchHistory' | 'afterHistoryPatched' | 'patchPrice'
>;

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
  tokensMap: { [address: string]: AbstractPortfolioToken[] },
  top10Addresses: string[],
  filter?: {
    chain?: string;
    tokenId?: string;
  },
): CombineTokensItem[] => {
  const { unfoldTokens = [] } =
    preferenceService.getUserTokenSettingsSync() || {};
  const tokens: OriginalCombineTokensItem[] = [];
  const lowerAddresses = new Set(
    Object.keys(tokensMap).map(i => i.toLowerCase()),
  );

  Object.entries(tokensMap).forEach(([address, tokenList]) => {
    if (
      !lowerAddresses.has(address.toLowerCase()) ||
      !top10Addresses.some(i => isSameAddress(i, address))
    ) {
      return;
    }
    lowerAddresses.delete(address.toLowerCase());
    tokenList?.forEach(token => {
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
      tokens.push({
        ...token,
        totalAmount: new BigNumber(token.amount || 0),
        totalUsdValue: new BigNumber(token._usdValue || 0),
        address,
      });
    });
  });

  const coreTokens = tokens.filter(i => i.is_core);
  const listLength = coreTokens.length || 0;
  const totalValue = coreTokens.reduce(
    (acc, curr) => acc + (curr.totalUsdValue.toNumber() || 0),
    0,
  );
  const threshold = Math.min((totalValue || 0) / 100, 1000);
  const thresholdIndex = coreTokens
    ? coreTokens.findIndex(m => (m.totalUsdValue.toNumber() || 0) < threshold)
    : -1;

  const hasExpandSwitch =
    listLength >= 15 && thresholdIndex > -1 && thresholdIndex <= listLength - 4;

  return tokens
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

export const combinedProtocols = (
  portfoliosMap: { [address: string]: DisplayedProject[] },
  top10Addresses: string[],
): CombineDefiItem[] => {
  const portfolios: OriginalCombineDefiItem[] = [];
  const lowerAddresses = new Set(
    Object.keys(portfoliosMap).map(i => i.toLowerCase()) || [],
  );
  Object.entries(portfoliosMap).forEach(([address, portfolioList]) => {
    if (
      !lowerAddresses.has(address.toLowerCase()) ||
      !top10Addresses.some(i => isSameAddress(i, address))
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
        totalUsdValue: getDisplayedPortfolioUsdValue(defi._portfolios),
      });
    });
  });

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
      _isFold: false,
      _isMiniFold: false,
    }));
};

export const tokensAtom = atom<{ [address: string]: AbstractPortfolioToken[] }>(
  {},
);
export const portfoliosAtom = atom<{ [address: string]: DisplayedProject[] }>(
  {},
);
export const nftsAtom = atom<{ [address: string]: DisplayNftItem[] }>({});

export const useAssetsMap = ({
  hideCombined = false,
}: {
  hideCombined?: boolean;
}) => {
  const [tokensMap, setTokensMap] = useAtom(tokensAtom);
  const [portfoliosMap, setPortfoliosMap] = useAtom(portfoliosAtom);
  const [nftsMap, setNftsMap] = useAtom(nftsAtom);
  const { handleFetchTokens } = usePinTokens();
  const [tokenNonce, setTokenNonce] = useAtom(tokenNonceAtom);
  const [defiNonce, setDefiNonce] = useAtom(deFiNonceAtom);
  const [nftNonce, setNftNonce] = useAtom(nftNonceAtom);
  const { top10Addresses } = useAccountInfo();

  const updateTokens = useCallback(
    ({
      address,
      newTokens,
    }: {
      address: string;
      newTokens: AbstractPortfolioToken[];
    }) => {
      const lowerAddress = address.toLowerCase();
      setTokensMap(pre => ({
        ...pre,
        [lowerAddress]: newTokens,
      }));
    },
    [setTokensMap],
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
      setPortfoliosMap(pre => ({
        ...pre,
        [lowerAddress]: newPortfolios,
      }));
    },
    [setPortfoliosMap],
  );

  const updateNFTs = useCallback(
    ({ address, newNFTs }: { address: string; newNFTs: NFTItem[] }) => {
      const lowerAddress = address.toLowerCase();
      setNftsMap(pre => ({
        ...pre,
        [lowerAddress]: newNFTs,
      }));
    },
    [setNftsMap],
  );

  const refreshTagToken = useCallback(async () => {
    const tokenSettings =
      (await preferenceService.getUserTokenSettings()) || {};
    handleFetchTokens();
    setTokensMap(prevTokensMap => {
      const updatedTokensMap: { [address: string]: AbstractPortfolioToken[] } =
        {};
      Object.entries(prevTokensMap).forEach(([address, tokens]) => {
        updatedTokensMap[address] = tagTokenList(tokens || [], tokenSettings);
      });

      return updatedTokensMap;
    });
  }, [handleFetchTokens, setTokensMap]);
  const refreshTagPortfolio = useCallback(async () => {
    const tokenSettings =
      (await preferenceService.getUserTokenSettings()) || {};

    setPortfoliosMap(prevPortfoliosMap => {
      const updatedPortfoliosMap: { [address: string]: DisplayedProject[] } =
        {};
      Object.entries(prevPortfoliosMap).forEach(([address, portfolios]) => {
        if (!portfolios) {
          return;
        }
        updatedPortfoliosMap[address] = tagProfiles(
          portfolios || [],
          tokenSettings,
        );
      });

      return updatedPortfoliosMap;
    });
  }, [setPortfoliosMap]);
  const refreshTagNft = useCallback(async () => {
    const tokenSettings =
      (await preferenceService.getUserTokenSettings()) || {};
    setNftsMap(prevNftsMap => {
      const updatedNftsMap: { [address: string]: DisplayNftItem[] } = {};
      Object.entries(prevNftsMap).forEach(([address, nfts]) => {
        updatedNftsMap[address] = tagNfts(nfts || [], tokenSettings);
      });

      return updatedNftsMap;
    });
  }, [setNftsMap]);

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
      return combinedTokens(tokensMap, top10Addresses, { tokenId, chain });
    },
    [tokensMap, top10Addresses],
  );

  type GetAssetsFunc = <T extends 'tokens' | 'portfolios' | 'nfts'>(
    type: T,
  ) => T extends 'tokens'
    ? { [address: string]: AbstractPortfolioToken[] }
    : T extends 'portfolios'
    ? { [address: string]: DisplayedProject[] }
    : { [address: string]: DisplayNftItem[] };
  const getAssetsMapDirectly = useAtomCallback(
    useCallback((getAtom, _, type) => {
      switch (type) {
        case 'tokens': {
          const tokensMap = getAtom(tokensAtom);
          return tokensMap;
        }
        case 'portfolios': {
          const portfoliosMap = getAtom(portfoliosAtom);
          return portfoliosMap;
        }
        case 'nfts': {
          const nftsMap = getAtom(nftsAtom);
          return nftsMap;
        }
        default: {
          console.warn('Invalid asset type requested');
          return {};
        }
      }
    }, []),
  ) as GetAssetsFunc;

  return {
    top10Addresses,
    updateTokens,
    updatePortfolios,
    updateNFTs,
    getTokenCombined,
    // Export individual maps and setters for direct access in useAssets
    tokensMap,
    // setTokensMap,
    portfoliosMap,
    // setPortfoliosMap,
    nftsMap,
    // setNftsMap,
    getAssetsMapDirectly,
  };
};

export const useAssetsComputation = ({
  tokensMap: tokensMapParam,
  portfoliosMap: portfoliosMapParam,
  nftsMap: nftsMapParam,
  top10Addresses,
  hideCombined = false,
}: {
  tokensMap?: { [address: string]: AbstractPortfolioToken[] };
  portfoliosMap?: { [address: string]: DisplayedProject[] };
  nftsMap?: { [address: string]: DisplayNftItem[] };
  top10Addresses: string[];
  hideCombined?: boolean;
}) => {
  // Use global state values when parameters are undefined
  const [globalTokensMap] = useAtom(tokensAtom);
  const [globalPortfoliosMap] = useAtom(portfoliosAtom);
  const [globalNftsMap] = useAtom(nftsAtom);

  const tokensMap =
    tokensMapParam !== undefined ? tokensMapParam : globalTokensMap;
  const portfoliosMap =
    portfoliosMapParam !== undefined ? portfoliosMapParam : globalPortfoliosMap;
  const nftsMap = nftsMapParam !== undefined ? nftsMapParam : globalNftsMap;

  const memoTokens = useMemo(() => {
    if (hideCombined) {
      return top20TokensCache;
    }

    const tokens = combinedTokens(tokensMap, top10Addresses);
    top20TokensCache = tokens.filter(item => !item._isFold).slice(0, 20);
    return tokens;
  }, [tokensMap, hideCombined, top10Addresses]);

  const memoPortfolios = useMemo(() => {
    if (hideCombined) {
      return top10PortfoliosCache;
    }

    const portfolios = combinedProtocols(portfoliosMap, top10Addresses);
    top10PortfoliosCache = portfolios.slice(0, 4);
    return portfolios;
  }, [portfoliosMap, hideCombined, top10Addresses]);

  // const memoNfts = useMemo(() => {
  //   if (hideCombined) {
  //     return top10NftsCache;
  //   }
  //   const nfts = combinedNfts(nftsMap, top10Addresses);
  //   top10NftsCache = nfts?.filter(item => !item._isFold).slice(0, 20) || [];
  //   return nfts;
  // }, [nftsMap, hideCombined, top10Addresses]);

  return {
    tokens: memoTokens,
    portfolios: memoPortfolios,
    // nfts: memoNfts,
  };
};

export const useMainnetTokens = (address?: string) => {
  const [tokensMap, setTokensMap] = useAtom(tokensAtom);
  const updateTokens = useCallback(
    (newTokens: AbstractPortfolioToken[]) => {
      if (!address) {
        return;
      }
      const lowerAddress = address.toLowerCase();
      setTokensMap(pre => ({
        ...pre,
        [lowerAddress]: newTokens,
      }));
    },
    [address, setTokensMap],
  );
  if (!address) {
    return [[] as AbstractPortfolioToken[], updateTokens] as const;
  }
  return [tokensMap[address.toLowerCase()] || [], updateTokens] as const;
};

export const useMainnetPortfolios = (address?: string) => {
  const [portfoliosMap, setPortfoliosMap] = useAtom(portfoliosAtom);
  const updatePortfolios = useCallback(
    (newPortfolios: DisplayedProject[]) => {
      if (!address) {
        return;
      }
      const lowerAddress = address.toLowerCase();
      setPortfoliosMap(pre => ({
        ...pre,
        [lowerAddress]: newPortfolios,
      }));
    },
    [address, setPortfoliosMap],
  );
  if (!address) {
    return [[] as DisplayedProject[], updatePortfolios] as const;
  }
  return [
    portfoliosMap[address.toLowerCase()] || [],
    updatePortfolios,
  ] as const;
};

export const useMainnetNFTs = (address?: string) => {
  const [nftsMap, setNftsMap] = useAtom(nftsAtom);
  const updateNFTs = useCallback(
    (newNFTs: DisplayNftItem[]) => {
      if (!address) {
        return;
      }
      const lowerAddress = address.toLowerCase();
      setNftsMap(pre => ({
        ...pre,
        [lowerAddress]: newNFTs,
      }));
    },
    [address, setNftsMap],
  );
  if (!address) {
    return [[] as DisplayNftItem[], updateNFTs] as const;
  }
  return [nftsMap[address.toLowerCase()] || [], updateNFTs] as const;
};
