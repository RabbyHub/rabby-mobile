import { getTop10MyAccounts } from '@/core/apis/account';
import { zCreate } from '@/core/utils/reexports';
import { syncNFTs } from '@/databases/hooks/assets';
import { NFTItemEntity } from '@/databases/entities/nftItem';
import type { DisplayNftItem } from '@/types/assets';
import { eventBus, EventBusListeners } from '@/utils/events';
import { useCallback, useEffect } from 'react';
import { CollectionList } from '@rabby-wallet/rabby-api/dist/types';
import { getSelectedBalanceAddressesSnapshot } from './balance';
import { ResourceBaseStore } from './_resourceBase';
import type { ObservableResourceValueSource } from './_resourceFlow';
import {
  buildNftAssetsIndexProjection,
  buildNftEntityId,
  type NftAssetsIndexResult,
  type NftCollectionId,
  type NftCollectionResourceValue,
  type NftEntityId,
} from './nftAssetsIndex';

export {
  EMPTY_NFT_ASSETS_INDEX_RESULT,
  buildNftEntityId,
  getNftAssetsIndexRowKey,
  type NftAssetsIndexResult,
  type NftAssetsIndexRow,
  type NftCollectionId,
  type NftCollectionResourceValue,
  type NftEntityId,
} from './nftAssetsIndex';

const normalizeAddresses = (addresses: string[]) =>
  Array.from(new Set(addresses.map(address => address.toLowerCase())));

type CombinedNFTItem = DisplayNftItem & { address?: string };

type NftListComputedState = {
  singleNftsIndexCache: Record<string, NftAssetsIndexResult>;
  registerSingleNfts(address: string, chainServerId?: string): string;
};

const NFT_COMPUTED_CACHE_LIMIT = 10;
const NFT_ENTITY_RESOURCE_FAMILY = 'nft.entity';
const NFT_COLLECTION_RESOURCE_FAMILY = 'nft.collection';

export const getSingleNftsCacheKey = (
  address: string,
  chainServerId?: string,
) => `${address.toLowerCase()}::${chainServerId ?? ''}`;

const getNftEntityIdAddress = (nftId: string) => nftId.split(':', 1)[0];

const getChangedNftKeys = (
  previousNft: DisplayNftItem | undefined,
  nextNft: DisplayNftItem,
) => {
  if (!previousNft) {
    return null;
  }

  const keys = new Set([
    ...Object.keys(previousNft),
    ...Object.keys(nextNft),
  ] as Array<keyof DisplayNftItem>);
  const changedKeys: Array<keyof DisplayNftItem> = [];

  keys.forEach(key => {
    if (!Object.is(previousNft[key], nextNft[key])) {
      changedKeys.push(key);
    }
  });

  return changedKeys;
};

class NftEntityResourceStore extends ResourceBaseStore<DisplayNftItem> {
  constructor() {
    super(NFT_ENTITY_RESOURCE_FAMILY, { mutative: true });
  }

  syncAddressesFromNftsMap = (
    nftsMap: Record<string, DisplayNftItem[]>,
    addresses: string[],
    source: ObservableResourceValueSource = 'remote',
  ) => {
    const addressSet = new Set(normalizeAddresses(addresses));
    if (!addressSet.size) {
      return;
    }

    const entries = new Map<NftEntityId, DisplayNftItem>();
    addressSet.forEach(address => {
      (nftsMap[address] || []).forEach(nft => {
        entries.set(buildNftEntityId(nft), nft);
      });
    });

    const now = Date.now();
    const previous = this.getState();
    const changedNfts: Array<{
      nftId: NftEntityId;
      nft: DisplayNftItem;
      changedKeys: Array<keyof DisplayNftItem> | null;
      meta: (typeof previous.metaMap)[string];
    }> = [];

    entries.forEach((nft, nftId) => {
      const previousNft = previous.valueMap[nftId];
      const previousMeta = previous.metaMap[nftId];
      const changedKeys = getChangedNftKeys(previousNft, nft);

      if (!previousMeta || !previousNft || changedKeys?.length) {
        changedNfts.push({
          nftId,
          nft,
          changedKeys,
          meta: {
            family: NFT_ENTITY_RESOURCE_FAMILY,
            resourceKey: nftId,
            hasValue: true,
            version: Math.max(previousMeta?.version || 0, 0) + 1,
            sourceOfCurrentValue: source,
            isHydrating: false,
            isFetchingRemote: false,
            persistStatus: previousMeta?.persistStatus || 'idle',
            localTargets: previousMeta?.localTargets || [],
            activeRemoteRequestId: undefined,
            lastHydratedAt:
              source === 'hydrate' ? now : previousMeta?.lastHydratedAt,
            lastRemoteAt:
              source === 'remote' ? now : previousMeta?.lastRemoteAt,
            lastPersistAt: previousMeta?.lastPersistAt,
            lastError: previousMeta?.lastError,
          },
        });
      }
    });

    const removedNftIds = Array.from(
      new Set([
        ...Object.keys(previous.valueMap),
        ...Object.keys(previous.metaMap),
      ]),
    ).filter(
      nftId =>
        addressSet.has(getNftEntityIdAddress(nftId)) &&
        !entries.has(nftId as NftEntityId),
    );

    if (!changedNfts.length && !removedNftIds.length) {
      return;
    }

    this.mutateState(draft => {
      changedNfts.forEach(({ nftId, nft, changedKeys, meta }) => {
        const previousNft = draft.valueMap[nftId];
        if (!previousNft || !changedKeys) {
          draft.valueMap[nftId] = nft;
        } else {
          changedKeys.forEach(key => {
            if (Object.prototype.hasOwnProperty.call(nft, key)) {
              previousNft[key] = nft[key] as never;
            } else {
              delete previousNft[key];
            }
          });
        }
        draft.metaMap[nftId] = meta;
      });

      removedNftIds.forEach(nftId => {
        delete draft.valueMap[nftId];
        delete draft.metaMap[nftId];
      });
    });
  };
}

const areShallowRecordsEqual = (
  previous: Record<string, unknown>,
  next: Record<string, unknown>,
  ignoredKey?: string,
) => {
  const keys = new Set([...Object.keys(previous), ...Object.keys(next)]);
  for (const key of keys) {
    if (key !== ignoredKey && !Object.is(previous[key], next[key])) {
      return false;
    }
  }
  return true;
};

const areNftCollectionsEqual = (
  previous: NftCollectionResourceValue | undefined,
  next: NftCollectionResourceValue,
) => {
  if (!previous) {
    return false;
  }
  if (
    !areShallowRecordsEqual(
      previous as unknown as Record<string, unknown>,
      next as unknown as Record<string, unknown>,
      'nft_list',
    ) ||
    previous.nft_list.length !== next.nft_list.length
  ) {
    return false;
  }

  return next.nft_list.every((nft, index) =>
    areShallowRecordsEqual(
      previous.nft_list[index] as unknown as Record<string, unknown>,
      nft as unknown as Record<string, unknown>,
    ),
  );
};

class NftCollectionResourceStore extends ResourceBaseStore<NftCollectionResourceValue> {
  constructor() {
    super(NFT_COLLECTION_RESOURCE_FAMILY, { mutative: true });
  }

  upsertCollections = (
    collections: Array<{
      collectionId: NftCollectionId;
      value: NftCollectionResourceValue;
    }>,
    source: ObservableResourceValueSource = 'remote',
  ) => {
    if (!collections.length) {
      return;
    }

    const previous = this.getState();
    const changedCollections = collections.filter(
      ({ collectionId, value }) =>
        !areNftCollectionsEqual(previous.valueMap[collectionId], value),
    );
    if (!changedCollections.length) {
      return;
    }

    const now = Date.now();
    this.mutateState(draft => {
      changedCollections.forEach(({ collectionId, value }) => {
        const previousMeta = previous.metaMap[collectionId];
        draft.valueMap[collectionId] = value;
        draft.metaMap[collectionId] = {
          family: NFT_COLLECTION_RESOURCE_FAMILY,
          resourceKey: collectionId,
          hasValue: true,
          version: Math.max(previousMeta?.version || 0, 0) + 1,
          sourceOfCurrentValue: source,
          isHydrating: false,
          isFetchingRemote: false,
          persistStatus: previousMeta?.persistStatus || 'idle',
          localTargets: previousMeta?.localTargets || [],
          activeRemoteRequestId: undefined,
          lastHydratedAt:
            source === 'hydrate' ? now : previousMeta?.lastHydratedAt,
          lastRemoteAt: source === 'remote' ? now : previousMeta?.lastRemoteAt,
          lastPersistAt: previousMeta?.lastPersistAt,
          lastError: previousMeta?.lastError,
        };
      });
    });
  };

  removeCollections = (collectionIds: Iterable<NftCollectionId>) => {
    const ids = Array.from(collectionIds);
    if (!ids.length) {
      return;
    }
    this.mutateState(draft => {
      ids.forEach(collectionId => {
        delete draft.valueMap[collectionId];
        delete draft.metaMap[collectionId];
      });
    });
  };
}

export const nftEntityResourceStore = new NftEntityResourceStore();
export const nftCollectionResourceStore = new NftCollectionResourceStore();

const singleNftsCacheParams = new Map<
  string,
  { address: string; chainServerId?: string }
>();
const singleNftsCacheOrder: string[] = [];
const singleNftCollectionIds = new Map<string, Set<NftCollectionId>>();

const getSingleNftList = (
  nftsMap: Record<string, DisplayNftItem[]>,
  address: string,
  chainServerId?: string,
) => {
  const list = nftsMap[address.toLowerCase()] || [];
  return chainServerId
    ? list.filter(nft => !nft.chain || nft.chain === chainServerId)
    : list;
};

const removeSingleNftsCacheKey = (key: string) => {
  singleNftsCacheParams.delete(key);
  const collectionIds = singleNftCollectionIds.get(key);
  if (collectionIds) {
    nftCollectionResourceStore.removeCollections(collectionIds);
    singleNftCollectionIds.delete(key);
  }
};

const touchSingleNftsCache = (
  key: string,
  params: { address: string; chainServerId?: string },
) => {
  singleNftsCacheParams.set(key, params);
  const previousIndex = singleNftsCacheOrder.indexOf(key);
  if (previousIndex > -1) {
    singleNftsCacheOrder.splice(previousIndex, 1);
  }
  singleNftsCacheOrder.push(key);

  if (singleNftsCacheOrder.length <= NFT_COMPUTED_CACHE_LIMIT) {
    return undefined;
  }
  const removedKey = singleNftsCacheOrder.shift();
  if (removedKey) {
    removeSingleNftsCacheKey(removedKey);
  }
  return removedKey;
};

const computeSingleNftsIndex = (
  nftsMap: Record<string, DisplayNftItem[]>,
  key: string,
  params: { address: string; chainServerId?: string },
  previousResult?: NftAssetsIndexResult,
) =>
  buildNftAssetsIndexProjection(
    getSingleNftList(nftsMap, params.address, params.chainServerId),
    key,
    previousResult,
  );

const updateSingleNftsIndex = (
  key: string,
  nftsMap: Record<string, DisplayNftItem[]>,
) => {
  const params = singleNftsCacheParams.get(key);
  if (!params) {
    return;
  }

  const previousResult =
    useNftListComputedStore.getState().singleNftsIndexCache[key];
  const projection = computeSingleNftsIndex(
    nftsMap,
    key,
    params,
    previousResult,
  );
  const previousCollectionIds = singleNftCollectionIds.get(key) || new Set();
  const nextCollectionIds = new Set(
    projection.collections.map(item => item.collectionId),
  );
  const removedCollectionIds = Array.from(previousCollectionIds).filter(
    collectionId => !nextCollectionIds.has(collectionId),
  );

  nftCollectionResourceStore.upsertCollections(projection.collections);
  nftCollectionResourceStore.removeCollections(removedCollectionIds);
  singleNftCollectionIds.set(key, nextCollectionIds);

  if (previousResult !== projection.result) {
    useNftListComputedStore.setState(state => ({
      singleNftsIndexCache: {
        ...state.singleNftsIndexCache,
        [key]: projection.result,
      },
    }));
  }
};

export const useNftListComputedStore = zCreate<NftListComputedState>(set => ({
  singleNftsIndexCache: {},
  registerSingleNfts(address, chainServerId) {
    const normalizedAddress = address.toLowerCase();
    const key = getSingleNftsCacheKey(normalizedAddress, chainServerId);
    const removedKey = touchSingleNftsCache(key, {
      address: normalizedAddress,
      chainServerId,
    });
    const nftsMap = nftListStore.getState().nftsMap;
    nftEntityResourceStore.syncAddressesFromNftsMap(nftsMap, [
      normalizedAddress,
    ]);
    updateSingleNftsIndex(key, nftsMap);

    if (removedKey) {
      set(state => {
        const nextCache = { ...state.singleNftsIndexCache };
        delete nextCache[removedKey];
        return { singleNftsIndexCache: nextCache };
      });
    }
    return key;
  },
}));

const tagNfts = (nfts: DisplayNftItem[]) => {
  return nfts.map(i => {
    const collection = i.collection as CollectionList | null | undefined;
    const isFold = !i.collection?.is_core || collection?.is_hidden;
    return {
      ...i,
      _isFold: isFold,
      _isManualFold: false,
    };
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
  singleLoadStatusByAddress: Record<string, 'loading' | 'ready'>;
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
  getNFTListWithCache(
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

const singleNftLoadRequests = new Map<string, Promise<void>>();

const nftListStore = zCreate<NFTListState>((set, get) => ({
  nftsMap: {},
  isLoading: true,
  isFirstFetch: true,
  shortCache: true,
  singleLoadStatusByAddress: {},

  async initStore() {
    const top10Addresses = getSelectedBalanceAddressesSnapshot();
    if (!top10Addresses.length) {
      set(state => ({
        ...state,
        nftsMap: {},
        isLoading: false,
        isFirstFetch: false,
      }));
      return;
    }

    await get().batchLoadCacheNFT(top10Addresses);
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

  getNFTListWithCache(address, force, updateReturn) {
    if (!address) {
      return Promise.resolve();
    }

    const normalizedAddress = address.toLowerCase();
    const activeRequest = singleNftLoadRequests.get(normalizedAddress);
    if (activeRequest) {
      return activeRequest;
    }

    set(state => ({
      singleLoadStatusByAddress: {
        ...state.singleLoadStatusByAddress,
        [normalizedAddress]: 'loading',
      },
    }));

    const request = (async () => {
      try {
        await get().batchLoadCacheNFT([normalizedAddress]);
        await get().getNFTList(normalizedAddress, force, updateReturn);
      } finally {
        singleNftLoadRequests.delete(normalizedAddress);
        set(state => ({
          singleLoadStatusByAddress: {
            ...state.singleLoadStatusByAddress,
            [normalizedAddress]: 'ready',
          },
        }));
      }
    })();
    singleNftLoadRequests.set(normalizedAddress, request);
    return request;
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

const getNftsMapChangedAddresses = (
  previousNftsMap: NFTListState['nftsMap'],
  nextNftsMap: NFTListState['nftsMap'],
) => {
  const changedAddresses = new Set<string>();
  const addresses = new Set([
    ...Object.keys(previousNftsMap).map(address => address.toLowerCase()),
    ...Object.keys(nextNftsMap).map(address => address.toLowerCase()),
  ]);

  addresses.forEach(address => {
    if (previousNftsMap[address] !== nextNftsMap[address]) {
      changedAddresses.add(address);
    }
  });
  return changedAddresses;
};

let latestNftsMap = nftListStore.getState().nftsMap;
nftListStore.subscribe(state => {
  if (state.nftsMap === latestNftsMap) {
    return;
  }

  const changedAddresses = getNftsMapChangedAddresses(
    latestNftsMap,
    state.nftsMap,
  );
  latestNftsMap = state.nftsMap;
  if (!changedAddresses.size) {
    return;
  }

  const registeredChangedAddresses = Array.from(changedAddresses).filter(
    address =>
      Array.from(singleNftsCacheParams.values()).some(
        params => params.address === address,
      ),
  );
  if (!registeredChangedAddresses.length) {
    return;
  }

  nftEntityResourceStore.syncAddressesFromNftsMap(
    state.nftsMap,
    registeredChangedAddresses,
  );
  singleNftsCacheParams.forEach((params, key) => {
    if (changedAddresses.has(params.address)) {
      updateSingleNftsIndex(key, state.nftsMap);
    }
  });
});

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
