import { AbstractPortfolioToken } from '../types';
import { atom, useAtom } from 'jotai';
import { DisplayedProject } from '../utils/project';
import { NFTItem } from '@rabby-wallet/rabby-api/dist/types';
import BigNumber from 'bignumber.js';
import { formatNetworth } from '@/utils/math';
import { getDisplayedPortfolioUsdValue } from '../utils/converAssets';

export type CombineTokensItem = AbstractPortfolioToken & {
  totalAmount: BigNumber;
  totalUsdValue?: BigNumber;
  fromAddress: Array<{
    address: string;
    amount: string;
  }>;
};

export type CombineDefiItem = DisplayedProject & {
  totalUsdValue?: BigNumber;
  fromAddress: Array<{
    address: string;
  }>;
};

export type CombineNFTItem = NFTItem & {
  totalAmount?: BigNumber;
  fromAddress: Array<{
    address: string;
  }>;
};

interface IAssets {
  portfolios?: DisplayedProject[];
  tokens?: AbstractPortfolioToken[];
  nfts?: NFTItem[];
  lastUpdateTime?: number;
}

export const assetsMapAtom = atom<{ [address: string]: IAssets }>({});
export const useAssetsMap = () => useAtom(assetsMapAtom);
const getOrInitializeAssets = (
  assets: { [address: string]: IAssets },
  address: string,
): IAssets => {
  return assets[address] || {};
};

const createSetter = <T>(
  address: string,
  field: keyof IAssets,
  updater: (prevValue?: T) => T | undefined,
  setAssetsMap: (
    updater: (prev: { [address: string]: IAssets }) => {
      [address: string]: IAssets;
    },
  ) => void,
) => {
  setAssetsMap(prev => ({
    ...prev,
    [address]: {
      ...getOrInitializeAssets(prev, address),
      [field]: updater(prev[address]?.[field as keyof IAssets] as T),
    },
  }));
};

const EmptyRes = [undefined, () => {}] as const;

export const usePortfoliosAtom = (address?: string) => {
  const [assetsMap, setAssetsMap] = useAtom(assetsMapAtom);

  if (!address) {
    return EmptyRes;
  }
  const portfolios = assetsMap[address]?.portfolios;
  const setPortfolios = (
    valueOrUpdater:
      | DisplayedProject[]
      | ((prev?: DisplayedProject[]) => DisplayedProject[]),
  ) => {
    createSetter(
      address,
      'portfolios',
      typeof valueOrUpdater === 'function'
        ? valueOrUpdater
        : () => valueOrUpdater,
      setAssetsMap,
    );
  };
  return [portfolios, setPortfolios] as const;
};

export const useTokensAtom = (address?: string) => {
  const [assetsMap, setAssetsMap] = useAtom(assetsMapAtom);
  if (!address) {
    return EmptyRes;
  }
  const tokens = assetsMap[address]?.tokens;
  const setTokens = (
    valueOrUpdater:
      | AbstractPortfolioToken[]
      | ((prev?: AbstractPortfolioToken[]) => AbstractPortfolioToken[]),
  ) => {
    createSetter(
      address,
      'tokens',
      typeof valueOrUpdater === 'function'
        ? valueOrUpdater
        : () => valueOrUpdater,
      setAssetsMap,
    );
  };
  return [tokens, setTokens] as const;
};

export const useNFTsAtom = (address?: string) => {
  const [assetsMap, setAssetsMap] = useAtom(assetsMapAtom);
  if (!address) {
    return EmptyRes;
  }
  const nfts = assetsMap[address]?.nfts;
  const setNFTs = (
    valueOrUpdater: NFTItem[] | ((prev?: NFTItem[]) => NFTItem[]),
  ) => {
    createSetter(
      address,
      'nfts',
      typeof valueOrUpdater === 'function'
        ? valueOrUpdater
        : () => valueOrUpdater,
      setAssetsMap,
    );
  };
  return [nfts, setNFTs] as const;
};

export const useLastUpdateTimeAtom = (address?: string) => {
  const [assetsMap, setAssetsMap] = useAtom(assetsMapAtom);
  if (!address) {
    return EmptyRes;
  }
  const lastUpdateTime = assetsMap[address]?.lastUpdateTime;
  const setLastUpdateTime = (
    valueOrUpdater: number | ((prev?: number) => number),
  ) => {
    createSetter(
      address,
      'lastUpdateTime',
      typeof valueOrUpdater === 'function'
        ? valueOrUpdater
        : () => valueOrUpdater,
      setAssetsMap,
    );
  };
  return [lastUpdateTime, setLastUpdateTime] as const;
};

// TODO: keyringService.getAllVisibleAccountsArray() only top10 accounts
export const combinedTokensAtom = atom<CombineTokensItem[]>(get => {
  const assetsMap = get(assetsMapAtom);
  const tokenMap: Record<string, CombineTokensItem> = {};

  Object.entries(assetsMap).forEach(([address, assets]) => {
    assets.tokens?.forEach(token => {
      const key = `${token._tokenId}-${token.chain}`;
      if (key === 'eth-eth') {
        // console.log('🔍 CUSTOM_LOGGER:=>: token)', token);
      }
      if (!tokenMap[key]) {
        tokenMap[key] = {
          ...token,
          totalAmount: new BigNumber(token.amount || 0),
          totalUsdValue: new BigNumber(token._usdValue || 0),
          fromAddress: [
            {
              address,
              amount: token._amountStr || '',
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
          amount: token._amountStr || '',
        });
      }
    });
  });

  return Object.values(tokenMap).map(i => ({
    ...i,
    _usdValue: i.totalUsdValue?.toNumber(),
    _usdValueStr: formatNetworth(i.totalUsdValue?.toNumber()),
    _amountStr: formatNetworth(i.totalAmount.toNumber()),
  }));
});

export const combinedDefiAtom = atom<CombineDefiItem[]>(get => {
  const assetsMap = get(assetsMapAtom);
  const defiMap: Record<string, CombineDefiItem> = {};

  Object.entries(assetsMap).forEach(([address, assets]) => {
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

  return Object.values(defiMap).map(i => ({
    ...i,
    _netWorth: i.totalUsdValue?.toString(),
  }));
});

export const combinedNFTAtom = atom<CombineNFTItem[]>(get => {
  const assetsMap = get(assetsMapAtom);
  const nftMap: Record<string, CombineNFTItem> = {};

  Object.entries(assetsMap).forEach(([address, assets]) => {
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

  return Object.values(nftMap).map(i => ({
    ...i,
    amount: i.totalAmount?.toNumber(),
  }));
});

export const updateTokensAtom = atom(
  null,
  (
    get,
    set,
    {
      address,
      newTokens,
    }: { address: string; newTokens: AbstractPortfolioToken[] },
  ) => {
    const currentAssets = get(assetsMapAtom);

    set(assetsMapAtom, {
      ...currentAssets,
      [address]: {
        ...currentAssets[address],
        tokens: newTokens,
      },
    });
  },
);

export const updatePortfoliosAtom = atom(
  null,
  (
    get,
    set,
    {
      address,
      newPortfolios,
    }: { address: string; newPortfolios: DisplayedProject[] },
  ) => {
    const currentAssets = get(assetsMapAtom);

    set(assetsMapAtom, {
      ...currentAssets,
      [address]: {
        ...currentAssets[address],
        portfolios: newPortfolios,
      },
    });
  },
);

export const updateNFTsAtom = atom(
  null,
  (get, set, { address, newNFTs }: { address: string; newNFTs: NFTItem[] }) => {
    const currentAssets = get(assetsMapAtom);

    set(assetsMapAtom, {
      ...currentAssets,
      [address]: {
        ...currentAssets[address],
        nfts: newNFTs,
      },
    });
  },
);

// TODO: delete outer top10 address assets
