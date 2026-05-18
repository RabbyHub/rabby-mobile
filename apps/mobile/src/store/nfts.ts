import { getTop10MyAccounts } from '@/core/apis/account';
import { mCreate, zCreate } from '@/core/utils/reexports';
import { syncNFTs } from '@/databases/hooks/assets';
import { NFTItemEntity } from '@/databases/entities/nftItem';
import type { DisplayNftItem } from '@/types/assets';
import { eventBus, EventBusListeners } from '@/utils/events';
import { useCallback, useEffect } from 'react';
import { CollectionList } from '@rabby-wallet/rabby-api/dist/types';
import { ResourceBaseStore } from './_resourceBase';
import type { ObservableResourceValueSource } from './_resourceFlow';

const normalizeAddresses = (addresses: string[]) =>
  Array.from(new Set(addresses.map(address => address.toLowerCase())));

export type CombinedNFTItem = DisplayNftItem & { address?: string };

export type NftEntityId = string & {
  readonly __nftEntityId: unique symbol;
};

export type NftCollectionId = string & {
  readonly __nftCollectionId: unique symbol;
};

export type NftAssetsIndexRow =
  | {
      type: 'nft';
      nftId: NftEntityId;
    }
  | {
      type: 'collection';
      collectionId: NftCollectionId;
    };

export type NftCollectionResourceValue = CollectionList & {
  address?: string;
};

export type NftAssetsIndexResult = {
  unFoldRows: NftAssetsIndexRow[];
  foldRows: NftAssetsIndexRow[];
};

type NFTListMap = Record<string, DisplayNftItem[]>;

type NFTListComputedState = {
  multiNftsIndexCache: Record<string, NftAssetsIndexResult>;
  singleNftsIndexCache: Record<string, NftAssetsIndexResult>;
  registerMultiNfts: (addresses: string[], chainServerId?: string) => string;
  registerSingleNfts: (address: string, chainServerId?: string) => string;
};

const COMPUTED_CACHE_LIMIT = 10;
const NFT_ENTITY_RESOURCE_FAMILY = 'nft.entity';
const NFT_COLLECTION_RESOURCE_FAMILY = 'nft.collection';

const createEmptyNftAssetsIndexResult = (): NftAssetsIndexResult => ({
  unFoldRows: [],
  foldRows: [],
});

const getAddressesKey = (addresses: string[]) =>
  normalizeAddresses(addresses).slice().sort().join('|');

export const getMultiNftsCacheKey = (
  addresses: string[],
  chainServerId?: string,
) => `${getAddressesKey(addresses)}::${chainServerId ?? ''}`;

export const getSingleNftsCacheKey = (
  address: string,
  chainServerId?: string,
) => `${address.toLowerCase()}::${chainServerId ?? ''}`;

const getNftOwnerAddress = (nft: { owner_addr?: string; address?: string }) =>
  (nft.owner_addr || nft.address || '').toLowerCase();

export const buildNftEntityId = (
  nft: Pick<DisplayNftItem, 'chain' | 'id'> & {
    owner_addr?: string;
    address?: string;
    inner_id?: string;
    collection_id?: string;
  },
): NftEntityId =>
  [
    getNftOwnerAddress(nft),
    nft.chain?.toLowerCase() || '',
    nft.collection_id?.toLowerCase() || '',
    nft.id?.toLowerCase() || '',
    nft.inner_id?.toLowerCase() || '',
  ].join(':') as NftEntityId;

const buildNftCollectionId = (
  listKey: string,
  section: 'unfold' | 'fold',
  collection: NftCollectionResourceValue,
): NftCollectionId =>
  [
    listKey,
    section,
    collection.address?.toLowerCase() || '',
    collection.chain?.toLowerCase() || '',
    collection.id?.toLowerCase() || '',
  ].join('::') as NftCollectionId;

export const getNftAssetsIndexRowKey = (row: NftAssetsIndexRow) => {
  if (row.type === 'collection') {
    return `collection-${row.collectionId}`;
  }
  return `nft-${row.nftId}`;
};

const getNftListFromNftMap = (nftsMap: NFTListMap) =>
  Object.values(nftsMap).flat();

class NftEntityResourceStore extends ResourceBaseStore<CombinedNFTItem> {
  constructor() {
    super(NFT_ENTITY_RESOURCE_FAMILY);
  }

  upsertNfts = (
    nfts: CombinedNFTItem[],
    source: ObservableResourceValueSource = 'remote',
  ) => {
    if (!nfts.length) {
      return;
    }

    const entries = new Map<NftEntityId, CombinedNFTItem>();
    nfts.forEach(nft => {
      entries.set(buildNftEntityId(nft), nft);
    });

    const now = Date.now();
    this.setState(prev => {
      let changed = false;
      const valueMap = { ...prev.valueMap };
      const metaMap = { ...prev.metaMap };

      entries.forEach((nft, nftId) => {
        const prevNft = prev.valueMap[nftId];
        const prevMeta = prev.metaMap[nftId];
        const isNftChanged = prevNft !== nft;

        if (isNftChanged) {
          valueMap[nftId] = nft;
          changed = true;
        }

        if (!prevMeta || isNftChanged) {
          metaMap[nftId] = {
            family: NFT_ENTITY_RESOURCE_FAMILY,
            resourceKey: nftId,
            hasValue: true,
            version: Math.max(prevMeta?.version || 0, 0) + 1,
            sourceOfCurrentValue: source,
            isHydrating: false,
            isFetchingRemote: false,
            persistStatus: prevMeta?.persistStatus || 'idle',
            localTargets: prevMeta?.localTargets || [],
            activeRemoteRequestId: undefined,
            lastHydratedAt:
              source === 'hydrate' ? now : prevMeta?.lastHydratedAt,
            lastRemoteAt: source === 'remote' ? now : prevMeta?.lastRemoteAt,
            lastPersistAt: prevMeta?.lastPersistAt,
            lastError: prevMeta?.lastError,
          };
          changed = true;
        }
      });

      return changed
        ? {
            valueMap,
            metaMap,
          }
        : prev;
    });
  };

  syncFromNftsMap = (
    nftsMap: NFTListMap,
    source: ObservableResourceValueSource = 'remote',
  ) => {
    this.upsertNfts(getNftListFromNftMap(nftsMap), source);
  };
}

class NftCollectionResourceStore extends ResourceBaseStore<NftCollectionResourceValue> {
  constructor() {
    super(NFT_COLLECTION_RESOURCE_FAMILY);
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

    const now = Date.now();
    this.setState(prev => {
      let changed = false;
      const valueMap = { ...prev.valueMap };
      const metaMap = { ...prev.metaMap };

      collections.forEach(({ collectionId, value }) => {
        const prevValue = prev.valueMap[collectionId];
        const prevMeta = prev.metaMap[collectionId];
        const isValueChanged = prevValue !== value;

        if (isValueChanged) {
          valueMap[collectionId] = value;
          changed = true;
        }

        if (!prevMeta || isValueChanged) {
          metaMap[collectionId] = {
            family: NFT_COLLECTION_RESOURCE_FAMILY,
            resourceKey: collectionId,
            hasValue: true,
            version: Math.max(prevMeta?.version || 0, 0) + 1,
            sourceOfCurrentValue: source,
            isHydrating: false,
            isFetchingRemote: false,
            persistStatus: prevMeta?.persistStatus || 'idle',
            localTargets: prevMeta?.localTargets || [],
            activeRemoteRequestId: undefined,
            lastHydratedAt:
              source === 'hydrate' ? now : prevMeta?.lastHydratedAt,
            lastRemoteAt: source === 'remote' ? now : prevMeta?.lastRemoteAt,
            lastPersistAt: prevMeta?.lastPersistAt,
            lastError: prevMeta?.lastError,
          };
          changed = true;
        }
      });

      return changed
        ? {
            valueMap,
            metaMap,
          }
        : prev;
    });
  };
}

export const nftEntityResourceStore = new NftEntityResourceStore();
export const nftCollectionResourceStore = new NftCollectionResourceStore();

export const useNftEntity = (nftId?: NftEntityId) =>
  nftEntityResourceStore.useValue(nftId);

export const useNftCollection = (collectionId?: NftCollectionId) =>
  nftCollectionResourceStore.useValue(collectionId);

const tagNfts = (nfts: DisplayNftItem[]) => {
  return nfts.map(i => {
    const collection = i.collection as CollectionList | null | undefined;
    const isFold = !i.collection?.is_core || collection?.is_hidden;
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

const filterNftsByChain = <T extends { chain?: string }>(
  nfts: T[],
  chainServerId?: string,
) => {
  return chainServerId
    ? nfts.filter(item => (item.chain ? item.chain === chainServerId : true))
    : nfts;
};

const buildNftAssetsIndexRows = (
  nfts: CombinedNFTItem[],
  section: 'unfold' | 'fold',
  listKey: string,
  options?: {
    forSingleAddress?: boolean;
  },
) => {
  const rows: NftAssetsIndexRow[] = [];
  const collections: Array<{
    collectionId: NftCollectionId;
    value: NftCollectionResourceValue;
  }> = [];
  const collectionMap: Record<string, NftCollectionResourceValue> = {};

  nfts.forEach(item => {
    if (!item.collection_id || !item.collection) {
      rows.push({
        type: 'nft',
        nftId: buildNftEntityId(item),
      });
      return;
    }

    const key = `${options?.forSingleAddress ? '' : item.address}-${
      item.chain
    }-${item.collection.id}`;
    const existingCollection = collectionMap[key];
    if (existingCollection) {
      existingCollection.nft_list.push({ ...item, collection: null });
      return;
    }

    const collection = {
      ...item.collection,
      address: item.address,
      nft_list: [{ ...item, collection: null }],
    } as unknown as NftCollectionResourceValue;
    const collectionId = buildNftCollectionId(listKey, section, collection);
    collectionMap[key] = collection;
    collections.push({
      collectionId,
      value: collection,
    });
    rows.push({
      type: 'collection',
      collectionId,
    });
  });

  if (collections.length) {
    const collectionNfts = collections.flatMap(
      collection => collection.value.nft_list || [],
    );
    nftEntityResourceStore.upsertNfts(collectionNfts as CombinedNFTItem[]);
    nftCollectionResourceStore.upsertCollections(collections);
  }

  return rows;
};

const buildNftAssetsIndexResult = (
  nfts: CombinedNFTItem[],
  listKey: string,
  options?: {
    forSingleAddress?: boolean;
  },
): NftAssetsIndexResult => {
  const foldNfts: CombinedNFTItem[] = [];
  const unFoldNfts: CombinedNFTItem[] = [];

  nfts.forEach(item => {
    if (item._isFold) {
      foldNfts.push(item);
    } else {
      unFoldNfts.push(item);
    }
  });

  nftEntityResourceStore.upsertNfts(nfts);

  return {
    unFoldRows: buildNftAssetsIndexRows(unFoldNfts, 'unfold', listKey, options),
    foldRows: buildNftAssetsIndexRows(foldNfts, 'fold', listKey, options),
  };
};

const computeSingleNftsIndex = (
  nftsMap: NFTListMap,
  address: string,
  chainServerId?: string,
): NftAssetsIndexResult => {
  if (!address) {
    return createEmptyNftAssetsIndexResult();
  }

  const normalizedAddress = address.toLowerCase();
  const nfts = nftsMap[normalizedAddress] || [];

  return buildNftAssetsIndexResult(
    filterNftsByChain(nfts, chainServerId),
    getSingleNftsCacheKey(normalizedAddress, chainServerId),
    {
      forSingleAddress: true,
    },
  );
};

const computeMultiNftsIndex = (
  nftsMap: NFTListMap,
  addresses: string[],
  chainServerId?: string,
): NftAssetsIndexResult => {
  if (!addresses.length) {
    return createEmptyNftAssetsIndexResult();
  }

  return buildNftAssetsIndexResult(
    filterNftsByChain(combinedNfts(nftsMap, addresses), chainServerId),
    getMultiNftsCacheKey(addresses, chainServerId),
  );
};

const multiNftsIndexCacheParams = new Map<
  string,
  {
    addresses: string[];
    chainServerId?: string;
  }
>();

const singleNftsIndexCacheParams = new Map<
  string,
  {
    address: string;
    chainServerId?: string;
  }
>();

const multiNftsIndexCacheOrder: string[] = [];
const singleNftsIndexCacheOrder: string[] = [];

const upsertRecordCache = <T>(
  cache: Record<string, T>,
  key: string,
  value: T,
  keys: string[],
) => {
  return mCreate(cache, draft => {
    const record = draft as Record<string, T>;
    record[key] = value;
    keys.forEach(removedKey => {
      delete record[removedKey];
    });
  });
};

const touchCacheParams = <T>(
  map: Map<string, T>,
  order: string[],
  key: string,
  params: T,
  limit = COMPUTED_CACHE_LIMIT,
) => {
  if (map.has(key)) {
    map.set(key, params);
    const index = order.indexOf(key);
    if (index > -1) {
      order.splice(index, 1);
    }
    order.push(key);
    return [] as string[];
  }
  map.set(key, params);
  order.push(key);
  if (order.length > limit) {
    const removed = order.shift();
    if (removed) {
      map.delete(removed);
      return [removed];
    }
  }
  return [] as string[];
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

const nftListStore = zCreate<NFTListState>((set, get) => ({
  nftsMap: {},
  isLoading: true,
  isFirstFetch: true,
  shortCache: true,

  async initStore() {
    const { top10Addresses } = await getTop10MyAccounts(true);
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

  async getNFTListWithCache(address, force, updateReturn) {
    if (!address) {
      return;
    }

    await get().batchLoadCacheNFT([address]);
    await get().getNFTList(address, force, updateReturn);
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

export const useNftListComputedStore = zCreate<NFTListComputedState>(set => ({
  multiNftsIndexCache: {},
  singleNftsIndexCache: {},
  registerMultiNfts(addresses, chainServerId) {
    const key = getMultiNftsCacheKey(addresses, chainServerId);
    const removedKeys = touchCacheParams(
      multiNftsIndexCacheParams,
      multiNftsIndexCacheOrder,
      key,
      {
        addresses,
        chainServerId,
      },
    );
    const nftsMap = nftListStore.getState().nftsMap;
    set(state => ({
      multiNftsIndexCache: upsertRecordCache(
        state.multiNftsIndexCache,
        key,
        computeMultiNftsIndex(nftsMap, addresses, chainServerId),
        removedKeys,
      ),
    }));
    return key;
  },
  registerSingleNfts(address, chainServerId) {
    const normalizedAddress = address.toLowerCase();
    const key = getSingleNftsCacheKey(normalizedAddress, chainServerId);
    const removedKeys = touchCacheParams(
      singleNftsIndexCacheParams,
      singleNftsIndexCacheOrder,
      key,
      {
        address: normalizedAddress,
        chainServerId,
      },
    );
    const nftsMap = nftListStore.getState().nftsMap;
    set(state => ({
      singleNftsIndexCache: upsertRecordCache(
        state.singleNftsIndexCache,
        key,
        computeSingleNftsIndex(nftsMap, normalizedAddress, chainServerId),
        removedKeys,
      ),
    }));
    return key;
  },
}));

const rebuildComputedCaches = (nftsMap: NFTListMap) => {
  const multiNftsIndexCache: Record<string, NftAssetsIndexResult> = {};
  multiNftsIndexCacheParams.forEach((params, key) => {
    multiNftsIndexCache[key] = computeMultiNftsIndex(
      nftsMap,
      params.addresses,
      params.chainServerId,
    );
  });

  const singleNftsIndexCache: Record<string, NftAssetsIndexResult> = {};
  singleNftsIndexCacheParams.forEach((params, key) => {
    singleNftsIndexCache[key] = computeSingleNftsIndex(
      nftsMap,
      params.address,
      params.chainServerId,
    );
  });

  useNftListComputedStore.setState({
    multiNftsIndexCache,
    singleNftsIndexCache,
  });
};

let latestNftsMap = nftListStore.getState().nftsMap;
nftListStore.subscribe(state => {
  if (state.nftsMap === latestNftsMap) {
    return;
  }
  latestNftsMap = state.nftsMap;
  rebuildComputedCaches(state.nftsMap);
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
