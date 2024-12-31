import { AbstractPortfolioToken } from '../types';
import { atom, useAtom } from 'jotai';
import { DisplayedProject } from '../utils/project';
import { NFTItem } from '@rabby-wallet/rabby-api/dist/types';
import BigNumber from 'bignumber.js';
import { formatNetworth } from '@/utils/math';

export type CombineTokensItem = AbstractPortfolioToken & {
  totalAmount: BigNumber;
  totalUsdValue?: BigNumber;
  fromAddress: Array<{
    address: string;
    addressType: string;
    amount: string;
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
              addressType: 'wallet',
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
          addressType: 'wallet',
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
