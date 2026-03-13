import { getTop10MyAccounts } from '@/core/apis/account';
import { zCreate } from '@/core/utils/reexports';
import { syncNFTs } from '@/databases/hooks/assets';
import { NFTItemEntity } from '@/databases/entities/nftItem';
import { DisplayNftItem } from '@/screens/Home/types';
import { eventBus, EventBusListeners } from '@/utils/events';
import { useCallback, useEffect } from 'react';

const normalizeAddresses = (addresses: string[]) =>
  Array.from(new Set(addresses.map(address => address.toLowerCase())));

type CombinedNFTItem = DisplayNftItem & { address?: string };

const tagNfts = (nfts: DisplayNftItem[]) => {
  return nfts.map(i => {
    const isFold = !i.is_core;

    return Object.assign(i, {
      _isFold: isFold,
      _isManualFold: false,
    });
  });
};

export const combinedNfts = (
  nftsMap: Record<string, DisplayNftItem[]>,
  caredAddresses: string[],
): CombinedNFTItem[] => {
  const nfts: CombinedNFTItem[] = [];
  const lowerAddresses = new Set(
    Object.keys(nftsMap).map(i => i.toLowerCase()) || [],
  );
  const caredAddressesSet = new Set(caredAddresses.map(i => i.toLowerCase()));

  Object.entries(nftsMap).forEach(([address, nftList]) => {
    const lowerAddr = address.toLowerCase();
    if (!lowerAddresses.has(lowerAddr) || !caredAddressesSet.has(lowerAddr)) {
      return;
    }

    lowerAddresses.delete(lowerAddr);
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

export interface NFTListState {
  nftsMap: Record<string, DisplayNftItem[]>;
  isLoading: boolean;
  isFirstFetch: boolean;
  shortCache: boolean;
  initStore(): Promise<void>;
  refreshTagNft(): void;
  updateNFTListByAddress(address: string, nfts: DisplayNftItem[]): void;
  clearUnusedNFTs(addresses: string[]): void;
  batchLoadCacheNFT(
    addresses: string[],
    options?: {
      core?: boolean;
      maxLength?: number;
    },
  ): Promise<void>;
  getNFTList(
    address: string,
    force?: boolean,
    updateReturn?: boolean,
  ): Promise<void>;
  batchGetNFTList(
    force?: boolean,
    options?: {
      realTimeAddresses?: string[];
      ignoreLoading?: boolean;
      updateReturn?: boolean;
    },
  ): Promise<void>;
  getCacheTop10NFTs(options?: {
    realTimeAddresses?: string[];
    core?: boolean;
    maxNFTLength?: number;
  }): Promise<void>;
}

const nftListStore = zCreate<NFTListState>((set, get) => ({
  nftsMap: {},
  isLoading: true,
  isFirstFetch: true,
  shortCache: true,

  async initStore() {
    const { top10Addresses } = await getTop10MyAccounts(true);
    await get().batchLoadCacheNFT(top10Addresses, {
      core: true,
      maxLength: 20,
    });
  },

  refreshTagNft() {
    set(state => {
      const updatedNftsMap: Record<string, DisplayNftItem[]> = {};
      Object.entries(state.nftsMap).forEach(([address, nfts]) => {
        updatedNftsMap[address] = tagNfts([...(nfts || [])]);
      });

      return {
        ...state,
        nftsMap: updatedNftsMap,
      };
    });
  },

  updateNFTListByAddress(address, nfts) {
    const lowerAddress = address.toLowerCase();
    set(state => ({
      ...state,
      nftsMap: {
        ...state.nftsMap,
        [lowerAddress]: nfts,
      },
    }));
  },

  clearUnusedNFTs(addresses) {
    const cared = new Set(normalizeAddresses(addresses));
    const prevMap = get().nftsMap;
    let hasChanged = false;
    const nextMap = { ...prevMap };

    Object.keys(prevMap).forEach(address => {
      if (!cared.has(address.toLowerCase())) {
        delete nextMap[address];
        hasChanged = true;
      }
    });

    if (hasChanged) {
      set(state => ({
        ...state,
        nftsMap: nextMap,
      }));
    }
  },

  async batchLoadCacheNFT(addresses, options) {
    const lowerAddresses = normalizeAddresses(addresses);
    if (!lowerAddresses.length) {
      return;
    }

    const cacheNfts = await NFTItemEntity.batchMultAddressNFTs(
      lowerAddresses,
      options?.core,
      options?.maxLength,
    );

    const groupedMap = cacheNfts.reduce<Record<string, DisplayNftItem[]>>(
      (acc, item) => {
        const key = item.owner_addr.toLowerCase();
        const list = acc[key] || [];
        list.push(item as DisplayNftItem);
        acc[key] = list;
        return acc;
      },
      {},
    );

    set(state => {
      const merged = { ...state.nftsMap };

      lowerAddresses.forEach(address => {
        merged[address] = tagNfts(groupedMap[address] || []);
      });

      return {
        ...state,
        nftsMap: merged,
      };
    });
  },

  async getNFTList(address, force, updateReturn) {
    if (!address) {
      return;
    }

    try {
      const nfts = await syncNFTs(
        address,
        force,
        updateReturn ? false : !force,
      );
      if (!nfts.length) {
        return;
      }

      get().updateNFTListByAddress(address, tagNfts(nfts as DisplayNftItem[]));
    } catch (e) {
      console.error('ServiceErrorType.NFT', e);
    }
  },

  async batchGetNFTList(force, options) {
    const addresses =
      options?.realTimeAddresses || (await getTop10MyAccounts()).top10Addresses;

    get().clearUnusedNFTs(addresses);
    if (!options?.ignoreLoading) {
      set(state => ({ ...state, isLoading: true }));
    }

    try {
      for (const address of addresses) {
        await get().getNFTList(address, force, options?.updateReturn);
      }
      await new Promise(resolve => setTimeout(resolve, 0));
    } finally {
      set(state => ({
        ...state,
        isLoading: false,
        isFirstFetch: false,
      }));
    }
  },

  async getCacheTop10NFTs(options) {
    const addresses =
      options?.realTimeAddresses || (await getTop10MyAccounts()).top10Addresses;

    get().clearUnusedNFTs(addresses);

    const isCurrentShortCacheFetch = !!options?.maxNFTLength;
    const hasNftsCache = Object.keys(get().nftsMap).length > 0;

    if (hasNftsCache && !get().shortCache) {
      return;
    }
    if (get().shortCache && isCurrentShortCacheFetch && hasNftsCache) {
      return;
    }

    set(state => ({
      ...state,
      shortCache: !!options?.maxNFTLength,
    }));

    setTimeout(() => {
      get().batchLoadCacheNFT(addresses, {
        core: options?.core,
        maxLength: options?.maxNFTLength,
      });
    }, 0);
  },
}));

export function getAssetsMapDirectly(type: 'nfts') {
  if (type !== 'nfts') {
    console.warn('Invalid asset type requested');
    return {};
  }

  return nftListStore.getState().nftsMap;
}

export function useOnNftRefresh() {
  const refreshTagNft = useCallback(async () => {
    nftListStore.getState().refreshTagNft();
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

export default nftListStore;
