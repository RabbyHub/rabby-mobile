import BigNumber from 'bignumber.js';
import { atom, useAtom } from 'jotai';

import { formatNetworth } from '@/utils/math';
import {
  AbstractPortfolioToken,
  AbstractProject,
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
// import { tokenNonceAtom, deFiNonceAtom, nftNonceAtom } from './refresh';
import { useAccountInfo } from '@/screens/Address/components/MultiAssets/hooks';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { useAtomCallback } from 'jotai/utils';
import { zCreate } from '@/core/utils/reexports';
import { resolveValFromUpdater, UpdaterOrPartials } from '@/core/utils/store';
import { eventBus, EventBusListeners } from '@/utils/events';
import { TokenItemEntity } from '@/databases/entities/tokenitem';
import { ITokenSetting } from '@/core/services/preference';
import { OPSQLiteEvents } from '@/core/databases/op-sqlite/events';

let top20TokensCache: CombineTokensItem[] = [];
let top10PortfoliosCache: CombineDefiItem[] = [];
let top10NftsCache: CombineNFTItem[] = [];

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

export function combineToken(
  token: AbstractPortfolioToken,
  owner_addr: string,
  options: {
    hasExpandSwitch: boolean;
    threshold: number;
    unfoldTokens?: ITokenSetting['unfoldTokens'];
  },
): CombineTokensItem {
  const totalUsdValue = new BigNumber(token._usdValue || 0);
  const totalAmount = new BigNumber(token.amount || 0);

  const { hasExpandSwitch, threshold, unfoldTokens = [] } = options;

  const base = {
    ...token,
    totalAmount: totalAmount.toNumber(),
    totalUsdValue: totalUsdValue.toNumber(),
    address: owner_addr,
    _usdValue: totalUsdValue.toNumber(),
    _usdValueStr: formatNetworth(totalUsdValue.toNumber()),
    _amountStr: formatAmount(totalAmount.toNumber()),
  };

  if (
    !hasExpandSwitch ||
    !token.is_core ||
    token._isManualFold ||
    unfoldTokens.some(
      x => x.chainId === token.chain && x.tokenId === token._tokenId,
    )
  )
    return base;

  return {
    ...base,
    ...{
      _isFold: (totalUsdValue.toNumber() || 0) < threshold,
      _isMiniFold: (totalUsdValue.toNumber() || 0) < threshold,
    },
  };
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

export const combinedNfts = (
  nftsMap: { [address: string]: DisplayNftItem[] },
  top10Addresses: string[],
): CombineNFTItem[] => {
  const nfts: OriginalCombineNFTItem[] = [];
  const lowerAddresses = new Set(
    Object.keys(nftsMap).map(i => i.toLowerCase()) || [],
  );
  Object.entries(nftsMap).forEach(([address, nftList]) => {
    if (
      !lowerAddresses.has(address.toLowerCase()) ||
      !top10Addresses.some(i => isSameAddress(i, address))
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

// export const tokensAtom = atom<{ [address: string]: AbstractPortfolioToken[] }>(
//   {},
// );
// export const portfoliosAtom = atom<{ [address: string]: DisplayedProject[] }>(
//   {},
// );
// export const nftsAtom = atom<{ [address: string]: DisplayNftItem[] }>({});
type AssetsMapState = {
  tokensMap: { [address: string]: AbstractPortfolioToken[] };
  /**
   * @description only ref tokens by db_id, but the token item maybe not in list
   */
  tokensByDbId: { [dbId: string]: AbstractPortfolioToken };
  portfoliosMap: { [address: string]: DisplayedProject[] };
  nftsMap: { [address: string]: DisplayNftItem[] };
};
export const assetsMapStore = zCreate<AssetsMapState>(() => ({
  tokensMap: {},
  tokensByDbId: {},
  portfoliosMap: {},
  nftsMap: {},
}));

function setTokensMap(
  valOrFunc: UpdaterOrPartials<AssetsMapState['tokensMap']>,
  addr?: string,
) {
  assetsMapStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev.tokensMap, valOrFunc, {
      strict: false,
    });

    const newDict = { ...prev.tokensByDbId };
    const addrsList = addr ? [addr] : Object.keys(newVal);
    addrsList.forEach(addr => {
      let db_id = '';
      newVal[addr].forEach(token => {
        db_id = TokenItemEntity.encodeDbId({
          chain: token.chain,
          id: token._tokenId,
          owner_addr: addr,
        });
        newDict[db_id] = token;
      });
    });
    prev.tokensByDbId = newDict;

    return { ...prev, tokensMap: newVal };
  });
}

function setTokensByDbId(
  valOrFunc: UpdaterOrPartials<AssetsMapState['tokensByDbId']>,
) {
  assetsMapStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev.tokensByDbId, valOrFunc, {
      strict: false,
    });

    return { ...prev, tokensByDbId: newVal };
  });
}

function setPortfoliosMap(
  valOrFunc: UpdaterOrPartials<AssetsMapState['portfoliosMap']>,
) {
  assetsMapStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev.portfoliosMap, valOrFunc, {
      strict: false,
    });

    return { ...prev, portfoliosMap: newVal };
  });
}

function setNftsMap(valOrFunc: UpdaterOrPartials<AssetsMapState['nftsMap']>) {
  assetsMapStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev.nftsMap, valOrFunc, {
      strict: false,
    });

    return { ...prev, nftsMap: newVal };
  });
}

type GetAssetsFunc = <
  T extends 'tokensByDbId' | 'tokens' | 'portfolios' | 'nfts',
>(
  type: T,
) => T extends 'tokens'
  ? { [address: string]: AbstractPortfolioToken[] }
  : T extends 'tokensByDbId'
  ? { [dbId: string]: AbstractPortfolioToken }
  : T extends 'portfolios'
  ? { [address: string]: DisplayedProject[] }
  : { [address: string]: DisplayNftItem[] };
export const getAssetsMapDirectly = (type => {
  const store = assetsMapStore.getState();
  switch (type) {
    case 'tokens': {
      return store.tokensMap;
    }
    case 'tokensByDbId': {
      return store.tokensByDbId;
    }
    case 'portfolios': {
      return store.portfoliosMap;
    }
    case 'nfts': {
      return store.nftsMap;
    }
    default: {
      console.warn('Invalid asset type requested');
      return {};
    }
  }
}) as GetAssetsFunc;

export function updateAssetListByAddress(
  address: string,
  payload:
    | {
        type: 'tokens';
        data: AbstractPortfolioToken[];
      }
    | {
        type: 'portfolios';
        data: DisplayedProject[];
      }
    | {
        type: 'nfts';
        data: DisplayNftItem[];
      },
) {
  switch (payload.type) {
    default: {
      console.warn('Invalid asset type for updateAssetListByAddress');
      return;
    }
    case 'tokens': {
      const lowerAddress = address.toLowerCase();
      setTokensMap(pre => ({
        ...pre,
        [lowerAddress]: payload.data,
      }));
      break;
    }
    case 'portfolios': {
      const lowerAddress = address.toLowerCase();
      setPortfoliosMap(pre => ({
        ...pre,
        [lowerAddress]: payload.data,
      }));
      break;
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
  const tokensByDbId = assetsMapStore(s => s.tokensByDbId);
  const portfoliosMap = assetsMapStore(s => s.portfoliosMap);
  const nftsMap = assetsMapStore(s => s.nftsMap);

  const { top10Addresses } = useAccountInfo();

  const getTokenCombined = useCallback(
    (tokenId: string, chain: string) => {
      return combinedTokens(getAssetsMapDirectly('tokens'), top10Addresses, {
        tokenId,
        chain,
      });
    },
    [top10Addresses],
  );

  // const getAssetsMapDirectly = useAtomCallback(
  //   useCallback((getAtom, _, type) => {
  //     switch (type) {
  //       case 'tokens': {
  //         const tokensMap = getAtom(tokensAtom);
  //         return tokensMap;
  //       }
  //       case 'portfolios': {
  //         const portfoliosMap = getAtom(portfoliosAtom);
  //         return portfoliosMap;
  //       }
  //       case 'nfts': {
  //         const nftsMap = getAtom(nftsAtom);
  //         return nftsMap;
  //       }
  //       default: {
  //         console.warn('Invalid asset type requested');
  //         return {};
  //       }
  //     }
  //   }, []),
  // ) as GetAssetsFunc;

  return {
    top10Addresses,
    getTokenCombined,
    // Export individual maps and setters for direct access in useAssets
    tokensMap,
    tokensByDbId,
    // setTokensMap,
    portfoliosMap,
    // setPortfoliosMap,
    nftsMap,
    // setNftsMap,
    getAssetsMapDirectly,
  };
};

export function useOnTokenRefresh() {
  const { handleFetchTokens } = usePinTokens();

  const refreshTagToken = useCallback(async () => {
    const tokenSettings =
      (await preferenceService.getUserTokenSettings()) || {};

    // for turbo version
    OPSQLiteEvents.emit('TRIGGER_TOKEN_STATICS_REFRESH');

    handleFetchTokens();
    setTokensMap(prevTokensMap => {
      const updatedTokensMap: { [address: string]: AbstractPortfolioToken[] } =
        {};
      Object.entries(prevTokensMap).forEach(([address, tokens]) => {
        updatedTokensMap[address] = tagTokenList(tokens || [], tokenSettings);
      });

      return updatedTokensMap;
    });
  }, [handleFetchTokens]);

  useEffect(() => {
    const onRequestRefreshAssets: EventBusListeners['EVENT_REFRESH_ASSET'] =
      type => {
        if (type !== 'tokenNonce') return;
        refreshTagToken();
      };
    eventBus.on('EVENT_REFRESH_ASSET', onRequestRefreshAssets);

    return () => {
      eventBus.off('EVENT_REFRESH_ASSET', onRequestRefreshAssets);
    };
  }, [refreshTagToken]);
}

export function useOnDeFiRefresh() {
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
  }, []);
  useEffect(() => {
    const onRequestRefreshAssets: EventBusListeners['EVENT_REFRESH_ASSET'] =
      type => {
        if (type !== 'deFiNonce') return;
        refreshTagPortfolio();
      };
    eventBus.on('EVENT_REFRESH_ASSET', onRequestRefreshAssets);

    return () => {
      eventBus.off('EVENT_REFRESH_ASSET', onRequestRefreshAssets);
    };
  }, [refreshTagPortfolio]);
}

export function useOnNftRefresh() {
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
  }, []);
  useEffect(() => {
    const onRequestRefreshAssets: EventBusListeners['EVENT_REFRESH_ASSET'] =
      type => {
        if (type !== 'nftNonce') return;
        refreshTagNft();
      };
    eventBus.on('EVENT_REFRESH_ASSET', onRequestRefreshAssets);

    return () => {
      eventBus.off('EVENT_REFRESH_ASSET', onRequestRefreshAssets);
    };
  }, [refreshTagNft]);
}

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
  // const [globalTokensMap] = useAtom(tokensAtom);
  const globalTokensMap = assetsMapStore(s => s.tokensMap);
  // const [globalPortfoliosMap] = useAtom(portfoliosAtom);
  const globalPortfoliosMap = assetsMapStore(s => s.portfoliosMap);
  // const [globalNftsMap] = useAtom(nftsAtom);
  const globalNftsMap = assetsMapStore(s => s.nftsMap);

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

  const memoNfts = useMemo(() => {
    if (hideCombined) {
      return top10NftsCache;
    }
    const nfts = combinedNfts(nftsMap, top10Addresses);
    top10NftsCache = nfts?.filter(item => !item._isFold).slice(0, 20) || [];
    return nfts;
  }, [nftsMap, hideCombined, top10Addresses]);

  return {
    tokens: memoTokens,
    portfolios: memoPortfolios,
    nfts: memoNfts,
  };
};

export const useMainnetTokens = (address?: string) => {
  // const [tokensMap, setTokensMap] = useAtom(tokensAtom);
  const tokensMap = assetsMapStore(s => s.tokensMap);
  const updateTokens = useCallback(
    (newTokens: AbstractPortfolioToken[]) => {
      if (!address) {
        return;
      }
      const lowerAddress = address.toLowerCase();
      setTokensMap(
        pre => ({
          ...pre,
          [lowerAddress]: newTokens,
        }),
        lowerAddress,
      );
    },
    [address],
  );
  if (!address) {
    return [[] as AbstractPortfolioToken[], updateTokens] as const;
  }
  return [tokensMap[address.toLowerCase()] || [], updateTokens] as const;
};

export const useMainnetPortfolios = (address?: string) => {
  // const [portfoliosMap, setPortfoliosMap] = useAtom(portfoliosAtom);
  const portfoliosMap = assetsMapStore(s => s.portfoliosMap);
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
    [address],
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
  // const [nftsMap, setNftsMap] = useAtom(nftsAtom);
  const nftsMap = assetsMapStore(s => s.nftsMap);
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
    [address],
  );
  if (!address) {
    return [[] as DisplayNftItem[], updateNFTs] as const;
  }
  return [nftsMap[address.toLowerCase()] || [], updateNFTs] as const;
};
