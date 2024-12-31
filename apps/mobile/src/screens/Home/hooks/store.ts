import { AbstractPortfolioToken } from '../types';
import { atom, useAtom } from 'jotai';
import { DisplayedProject } from '../utils/project';
import { NFTItem } from '@rabby-wallet/rabby-api/dist/types';

export type CombineTokensItem = AbstractPortfolioToken & {
  totalAmount: string;
  totalUsdValue?: number;
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
