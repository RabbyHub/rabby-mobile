import { getTop10MyAccounts } from '@/core/apis/account';
import { zCreate } from '@/core/utils/reexports';
import { syncNFTs } from '@/databases/hooks/assets';
import type { NftSnapshotLoadResult } from '@/databases/hooks/nft';
import { syncRemoteNFTs } from '@/databases/sync/assets';
import { NFTItemEntity } from '@/databases/entities/nftItem';
import type { DisplayNftItem } from '@/types/assets';
import { getSelectedBalanceAddressesSnapshot } from './balance';
import { ResourceBaseStore } from './_resourceBase';
import type { ObservableResourceValueSource } from './_resourceFlow';
import {
  buildNftAssetsIndexProjection,
  buildNftEntityId,
  createNftCollectionResourceValue,
  type CombinedNftItem,
  type NftAssetsIndexResult,
  type NftAssetsIndexRow,
  type NftCollectionId,
  type NftCollectionResourceValue,
  type NftEntityId,
} from './nftAssetsIndex';
import { beginAssetDataLoadDiagnostic } from '@/core/utils/assetDataLoadDiagnostics';
import { LatestAsyncRequest } from '@/core/utils/latestAsyncRequest';
import {
  LatestAddressRequest,
  type LatestAddressRequestTicket,
} from '@/core/utils/latestAddressRequest';
import {
  completeAddressListSnapshots,
  createAddressListSnapshotHydrator,
  mergeAddressListSnapshots,
} from './_addressListSnapshot';
import type { RestoredAssetProjection } from '@/databases/assetProjection';
import {
  isAssetProjectionPersistenceActive,
  restoreAssetProjection,
  scheduleAssetProjectionPersistence,
  subscribeAssetProjectionDatabaseCommits,
} from './assetProjectionPersistence';
import {
  getAssetSourceReadinessChangedAddresses,
  hasConfirmedAssetProjectionSources,
  markAssetSourceSnapshotsReady,
  retainAssetSourceSnapshotReadiness,
  resolveAssetProjectionAvailability,
  type AssetProjectionAvailability,
  type AssetSourceSnapshotReadiness,
} from './assetProjectionAvailability';

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

type NftListComputedState = {
  multiNftsIndexCache: Record<string, NftAssetsIndexResult>;
  singleNftsIndexCache: Record<string, NftAssetsIndexResult>;
  multiNftsAvailabilityByKey: Record<string, AssetProjectionAvailability>;
  singleNftsAvailabilityByKey: Record<string, AssetProjectionAvailability>;
  registerMultiNfts(addresses: string[], chainServerId?: string): string;
  registerSingleNfts(address: string, chainServerId?: string): string;
};

const NFT_COMPUTED_CACHE_LIMIT = 10;
const NFT_ENTITY_RESOURCE_FAMILY = 'nft.entity';
const NFT_COLLECTION_RESOURCE_FAMILY = 'nft.collection';

export const getSingleNftsCacheKey = (
  address: string,
  chainServerId?: string,
) => `${address.toLowerCase()}::${chainServerId ?? ''}`;

export const getMultiNftsCacheKey = (
  addresses: string[],
  chainServerId?: string,
) =>
  `multi::${normalizeAddresses(addresses).sort().join('|')}::${
    chainServerId ?? ''
  }`;

const getNftEntityIdAddress = (nftId: string) => nftId.split(':', 1)[0];

const getChangedNftKeys = (
  previousNft: CombinedNftItem | undefined,
  nextNft: CombinedNftItem,
) => {
  if (!previousNft) {
    return null;
  }

  const keys = new Set([
    ...Object.keys(previousNft),
    ...Object.keys(nextNft),
  ] as Array<keyof CombinedNftItem>);
  const changedKeys: Array<keyof CombinedNftItem> = [];

  keys.forEach(key => {
    if (!Object.is(previousNft[key], nextNft[key])) {
      changedKeys.push(key);
    }
  });

  return changedKeys;
};

class NftEntityResourceStore extends ResourceBaseStore<CombinedNftItem> {
  constructor() {
    super(NFT_ENTITY_RESOURCE_FAMILY, { mutative: true });
  }

  upsertNfts = (
    nfts: CombinedNftItem[],
    source: ObservableResourceValueSource = 'remote',
    options?: { pruneMissingAddresses?: Set<string> },
  ) => {
    const entries = new Map<NftEntityId, CombinedNftItem>();
    nfts.forEach(nft => {
      entries.set(buildNftEntityId(nft), nft);
    });

    const now = Date.now();
    const previous = this.getState();
    const changedNfts: Array<{
      nftId: NftEntityId;
      nft: CombinedNftItem;
      changedKeys: Array<keyof CombinedNftItem> | null;
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

    const pruneMissingAddresses = options?.pruneMissingAddresses;
    const removedNftIds = Array.from(
      new Set([
        ...Object.keys(previous.valueMap),
        ...Object.keys(previous.metaMap),
      ]),
    ).filter(
      nftId =>
        pruneMissingAddresses?.has(getNftEntityIdAddress(nftId)) &&
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

  syncAddressesFromNftsMap = (
    nftsMap: Record<string, DisplayNftItem[]>,
    addresses: string[],
    source: ObservableResourceValueSource = 'remote',
  ) => {
    const addressSet = new Set(normalizeAddresses(addresses));
    if (!addressSet.size) {
      return;
    }

    const nfts = Array.from(addressSet).flatMap(address =>
      (nftsMap[address] || []).map(nft => ({
        ...nft,
        address,
        owner_addr: address,
      })),
    );
    this.upsertNfts(nfts, source, { pruneMissingAddresses: addressSet });
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
const multiNftsCacheParams = new Map<
  string,
  { addresses: string[]; chainServerId?: string }
>();
const singleNftsCacheOrder: string[] = [];
const multiNftsCacheOrder: string[] = [];
const singleNftCollectionIds = new Map<string, Set<NftCollectionId>>();
const multiNftCollectionIds = new Map<string, Set<NftCollectionId>>();

const getSingleNftList = (
  nftsMap: Record<string, DisplayNftItem[]>,
  address: string,
  chainServerId?: string,
) => {
  const list = nftsMap[address.toLowerCase()] || [];
  const ownedList: CombinedNftItem[] = list.map(nft => ({
    ...nft,
    address: address.toLowerCase(),
    owner_addr: address.toLowerCase(),
  }));
  return chainServerId
    ? ownedList.filter(nft => !nft.chain || nft.chain === chainServerId)
    : ownedList;
};

const getMultiNftList = (
  nftsMap: Record<string, DisplayNftItem[]>,
  addresses: string[],
  chainServerId?: string,
) => {
  const list = combinedNfts(nftsMap, addresses);
  return chainServerId
    ? list.filter(nft => !nft.chain || nft.chain === chainServerId)
    : list;
};

const removeNftsCacheKey = <T>(
  key: string,
  params: Map<string, T>,
  collectionIdsByKey: Map<string, Set<NftCollectionId>>,
) => {
  params.delete(key);
  const collectionIds = collectionIdsByKey.get(key);
  if (collectionIds) {
    nftCollectionResourceStore.removeCollections(collectionIds);
    collectionIdsByKey.delete(key);
  }
};

const removeSingleNftsCacheKey = (key: string) => {
  removeNftsCacheKey(key, singleNftsCacheParams, singleNftCollectionIds);
};

const removeMultiNftsCacheKey = (key: string) => {
  removeNftsCacheKey(key, multiNftsCacheParams, multiNftCollectionIds);
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

const touchMultiNftsCache = (
  key: string,
  params: { addresses: string[]; chainServerId?: string },
) => {
  multiNftsCacheParams.set(key, params);
  const previousIndex = multiNftsCacheOrder.indexOf(key);
  if (previousIndex > -1) {
    multiNftsCacheOrder.splice(previousIndex, 1);
  }
  multiNftsCacheOrder.push(key);

  if (multiNftsCacheOrder.length <= NFT_COMPUTED_CACHE_LIMIT) {
    return undefined;
  }
  const removedKey = multiNftsCacheOrder.shift();
  if (removedKey) {
    removeMultiNftsCacheKey(removedKey);
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

type NftProjectionScene = 'single-address' | 'multi-address';

const getNftProjectionAvailability = (
  params:
    | { address: string; chainServerId?: string }
    | { addresses: string[]; chainServerId?: string }
    | undefined,
  result: NftAssetsIndexResult | undefined,
  isRestoring = false,
) => {
  const addresses = params
    ? 'address' in params
      ? [params.address]
      : params.addresses
    : [];
  return resolveAssetProjectionAvailability({
    hasProjection: !!params && !!result,
    hasData: !!result?.rows.length,
    hasCompleteSource:
      !!params &&
      hasConfirmedAssetProjectionSources(
        addresses,
        nftListStore.getState().sourceSnapshotReadyByAddress,
      ),
    isRestoring,
  });
};

const scheduleNftProjectionPersistence = (
  key: string,
  scene: NftProjectionScene,
  result: NftAssetsIndexResult,
) => {
  const params =
    scene === 'single-address'
      ? singleNftsCacheParams.get(key)
      : multiNftsCacheParams.get(key);
  if (!params) {
    return;
  }
  const addresses = 'address' in params ? [params.address] : params.addresses;
  const isSourceSnapshotReady = hasConfirmedAssetProjectionSources(
    addresses,
    nftListStore.getState().sourceSnapshotReadyByAddress,
  );
  if (!result.rows.length && !isSourceSnapshotReady) {
    return;
  }
  const groups = result.rows.flatMap(row => {
    if (row.type !== 'collection') {
      return [];
    }
    const collection = nftCollectionResourceStore.getValue(row.collectionId);
    return collection
      ? [
          {
            id: row.collectionId,
            memberIds: collection.nft_list.map(buildNftEntityId),
          },
        ]
      : [];
  });
  const collectionRowCount = result.rows.filter(
    row => row.type === 'collection',
  ).length;
  if (groups.length !== collectionRowCount) {
    return;
  }

  scheduleAssetProjectionPersistence({
    runtimeKey: key,
    kind: 'nft',
    scene,
    rows: result.rows.map(row =>
      row.type === 'collection'
        ? { type: 'nft-collection', id: row.collectionId }
        : { type: 'nft', id: row.nftId },
    ),
    groups,
    metadata: {
      defaultVisibleRowCount: result.defaultVisibleRowCount,
    },
  });
};

const buildRestoredNftProjection = (
  restored: RestoredAssetProjection,
): {
  result: NftAssetsIndexResult;
  collections: Array<{
    collectionId: NftCollectionId;
    value: NftCollectionResourceValue;
  }>;
} | null => {
  const groupMembers = new Map(
    restored.groups.map(group => [group.id, group.memberIds]),
  );
  const rows: NftAssetsIndexRow[] = [];
  const collections: Array<{
    collectionId: NftCollectionId;
    value: NftCollectionResourceValue;
  }> = [];

  for (const row of restored.rows) {
    if (row.type === 'nft') {
      const nftId = row.id as NftEntityId;
      if (!nftEntityResourceStore.getValue(nftId)) {
        return null;
      }
      rows.push({ type: 'nft', nftId });
      continue;
    }
    if (row.type !== 'nft-collection') {
      return null;
    }

    const collectionId = row.id as NftCollectionId;
    const memberIds = (groupMembers.get(collectionId) || []).map(
      id => id as NftEntityId,
    );
    const members = memberIds.map(id => nftEntityResourceStore.getValue(id));
    if (!memberIds.length || members.some(member => !member)) {
      return null;
    }
    const concreteMembers = members as CombinedNftItem[];
    const first = concreteMembers[0];
    const collectionAddress = first?.address || first?.owner_addr;
    if (!first?.collection || !collectionAddress) {
      return null;
    }
    collections.push({
      collectionId,
      value: createNftCollectionResourceValue(
        first,
        collectionAddress,
        concreteMembers.map(nft => ({
          ...nft,
          collection: null,
        })),
      ),
    });
    rows.push({ type: 'collection', collectionId });
  }

  const defaultVisibleRowCount = restored.metadata.defaultVisibleRowCount;
  if (
    typeof defaultVisibleRowCount !== 'number' ||
    !Number.isInteger(defaultVisibleRowCount) ||
    defaultVisibleRowCount < 0 ||
    defaultVisibleRowCount > rows.length
  ) {
    return null;
  }

  return {
    result: {
      rows,
      defaultVisibleRowCount,
    },
    collections,
  };
};

const nftProjectionRestoreRequests = new Map<string, Promise<void>>();

const restoreNftProjectionIfEmpty = (
  key: string,
  scene: NftProjectionScene,
) => {
  if (
    isAssetProjectionPersistenceActive({
      runtimeKey: key,
      kind: 'nft',
      scene,
    })
  ) {
    return;
  }
  const requestKey = `${scene}:${key}`;
  if (nftProjectionRestoreRequests.has(requestKey)) {
    return;
  }
  const params =
    scene === 'single-address'
      ? singleNftsCacheParams.get(key)
      : multiNftsCacheParams.get(key);
  if (!params) {
    return;
  }

  const startedResult =
    scene === 'single-address'
      ? useNftListComputedStore.getState().singleNftsIndexCache[key]
      : useNftListComputedStore.getState().multiNftsIndexCache[key];
  if (startedResult?.rows.length) {
    return;
  }
  const startedSourceMap = nftListStore.getState().nftsMap;
  const addresses = 'address' in params ? [params.address] : params.addresses;
  if (
    addresses.every(address =>
      Object.prototype.hasOwnProperty.call(
        startedSourceMap,
        address.toLowerCase(),
      ),
    )
  ) {
    return;
  }

  useNftListComputedStore.setState(current =>
    scene === 'single-address'
      ? {
          singleNftsAvailabilityByKey: {
            ...current.singleNftsAvailabilityByKey,
            [key]: 'restoring',
          },
        }
      : {
          multiNftsAvailabilityByKey: {
            ...current.multiNftsAvailabilityByKey,
            [key]: 'restoring',
          },
        },
  );

  const request = (async () => {
    const restored = await restoreAssetProjection({
      runtimeKey: key,
      kind: 'nft',
      scene,
    });
    if (!restored) {
      return;
    }

    const requiredNftIds = new Set<NftEntityId>();
    restored.rows.forEach(row => {
      if (row.type === 'nft') {
        requiredNftIds.add(row.id as NftEntityId);
      }
    });
    restored.groups.forEach(group => {
      group.memberIds.forEach(id => requiredNftIds.add(id as NftEntityId));
    });
    if (requiredNftIds.size) {
      const cachedNfts = await NFTItemEntity.batchMultAddressNFTs(addresses);
      const latestParamsBeforeHydrate =
        scene === 'single-address'
          ? singleNftsCacheParams.get(key)
          : multiNftsCacheParams.get(key);
      const stateBeforeHydrate = useNftListComputedStore.getState();
      const resultBeforeHydrate =
        scene === 'single-address'
          ? stateBeforeHydrate.singleNftsIndexCache[key]
          : stateBeforeHydrate.multiNftsIndexCache[key];
      if (
        latestParamsBeforeHydrate !== params ||
        resultBeforeHydrate !== startedResult ||
        nftListStore.getState().nftsMap !== startedSourceMap
      ) {
        return;
      }
      const missingNfts = cachedNfts
        .map(nft => ({
          ...nft,
          address: nft.owner_addr.toLowerCase(),
          owner_addr: nft.owner_addr.toLowerCase(),
        }))
        .filter(nft => {
          const nftId = buildNftEntityId(nft);
          return (
            requiredNftIds.has(nftId) && !nftEntityResourceStore.getValue(nftId)
          );
        }) as CombinedNftItem[];
      nftEntityResourceStore.upsertNfts(missingNfts, 'hydrate');
    }

    const projection = buildRestoredNftProjection(restored);
    if (!projection) {
      return;
    }

    const latestParams =
      scene === 'single-address'
        ? singleNftsCacheParams.get(key)
        : multiNftsCacheParams.get(key);
    const state = useNftListComputedStore.getState();
    const currentResult =
      scene === 'single-address'
        ? state.singleNftsIndexCache[key]
        : state.multiNftsIndexCache[key];
    if (
      latestParams !== params ||
      currentResult !== startedResult ||
      nftListStore.getState().nftsMap !== startedSourceMap
    ) {
      return;
    }

    nftCollectionResourceStore.upsertCollections(
      projection.collections,
      'hydrate',
    );
    const collectionIds = new Set(
      projection.collections.map(collection => collection.collectionId),
    );
    if (scene === 'single-address') {
      singleNftCollectionIds.set(key, collectionIds);
      useNftListComputedStore.setState(current => ({
        singleNftsIndexCache: {
          ...current.singleNftsIndexCache,
          [key]: projection.result,
        },
        singleNftsAvailabilityByKey: {
          ...current.singleNftsAvailabilityByKey,
          [key]: 'ready',
        },
      }));
    } else {
      multiNftCollectionIds.set(key, collectionIds);
      useNftListComputedStore.setState(current => ({
        multiNftsIndexCache: {
          ...current.multiNftsIndexCache,
          [key]: projection.result,
        },
        multiNftsAvailabilityByKey: {
          ...current.multiNftsAvailabilityByKey,
          [key]: 'ready',
        },
      }));
    }
  })()
    .catch(error => {
      console.error('[nftProjection] restore failed', error);
    })
    .finally(() => {
      nftProjectionRestoreRequests.delete(requestKey);
      const state = useNftListComputedStore.getState();
      const availability =
        scene === 'single-address'
          ? state.singleNftsAvailabilityByKey[key]
          : state.multiNftsAvailabilityByKey[key];
      if (availability !== 'restoring') {
        return;
      }
      const latestParams =
        scene === 'single-address'
          ? singleNftsCacheParams.get(key)
          : multiNftsCacheParams.get(key);
      const result =
        scene === 'single-address'
          ? state.singleNftsIndexCache[key]
          : state.multiNftsIndexCache[key];
      const nextAvailability = getNftProjectionAvailability(
        latestParams,
        result,
      );
      useNftListComputedStore.setState(current =>
        scene === 'single-address'
          ? {
              singleNftsAvailabilityByKey: {
                ...current.singleNftsAvailabilityByKey,
                [key]: nextAvailability,
              },
            }
          : {
              multiNftsAvailabilityByKey: {
                ...current.multiNftsAvailabilityByKey,
                [key]: nextAvailability,
              },
            },
      );
    });
  nftProjectionRestoreRequests.set(requestKey, request);
};

subscribeAssetProjectionDatabaseCommits(() => {
  singleNftsCacheParams.forEach((_params, key) => {
    restoreNftProjectionIfEmpty(key, 'single-address');
  });
  multiNftsCacheParams.forEach((_params, key) => {
    restoreNftProjectionIfEmpty(key, 'multi-address');
  });
});

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
      singleNftsAvailabilityByKey: {
        ...state.singleNftsAvailabilityByKey,
        [key]: getNftProjectionAvailability(params, projection.result),
      },
    }));
  } else {
    const availability = getNftProjectionAvailability(
      params,
      projection.result,
    );
    if (
      useNftListComputedStore.getState().singleNftsAvailabilityByKey[key] !==
      availability
    ) {
      useNftListComputedStore.setState(state => ({
        singleNftsAvailabilityByKey: {
          ...state.singleNftsAvailabilityByKey,
          [key]: availability,
        },
      }));
    }
  }
  scheduleNftProjectionPersistence(key, 'single-address', projection.result);
  if (!projection.result.rows.length) {
    restoreNftProjectionIfEmpty(key, 'single-address');
  }
};

const updateMultiNftsIndex = (
  key: string,
  nftsMap: Record<string, DisplayNftItem[]>,
) => {
  const params = multiNftsCacheParams.get(key);
  if (!params) {
    return;
  }

  const previousResult =
    useNftListComputedStore.getState().multiNftsIndexCache[key];
  const projection = buildNftAssetsIndexProjection(
    getMultiNftList(nftsMap, params.addresses, params.chainServerId),
    key,
    previousResult,
  );
  const previousCollectionIds = multiNftCollectionIds.get(key) || new Set();
  const nextCollectionIds = new Set(
    projection.collections.map(item => item.collectionId),
  );
  const removedCollectionIds = Array.from(previousCollectionIds).filter(
    collectionId => !nextCollectionIds.has(collectionId),
  );

  nftCollectionResourceStore.upsertCollections(projection.collections);
  nftCollectionResourceStore.removeCollections(removedCollectionIds);
  multiNftCollectionIds.set(key, nextCollectionIds);

  if (previousResult !== projection.result) {
    useNftListComputedStore.setState(state => ({
      multiNftsIndexCache: {
        ...state.multiNftsIndexCache,
        [key]: projection.result,
      },
      multiNftsAvailabilityByKey: {
        ...state.multiNftsAvailabilityByKey,
        [key]: getNftProjectionAvailability(params, projection.result),
      },
    }));
  } else {
    const availability = getNftProjectionAvailability(
      params,
      projection.result,
    );
    if (
      useNftListComputedStore.getState().multiNftsAvailabilityByKey[key] !==
      availability
    ) {
      useNftListComputedStore.setState(state => ({
        multiNftsAvailabilityByKey: {
          ...state.multiNftsAvailabilityByKey,
          [key]: availability,
        },
      }));
    }
  }
  scheduleNftProjectionPersistence(key, 'multi-address', projection.result);
  if (!projection.result.rows.length) {
    restoreNftProjectionIfEmpty(key, 'multi-address');
  }
};

export const useNftListComputedStore = zCreate<NftListComputedState>(set => ({
  multiNftsIndexCache: {},
  singleNftsIndexCache: {},
  multiNftsAvailabilityByKey: {},
  singleNftsAvailabilityByKey: {},
  registerMultiNfts(addresses, chainServerId) {
    const normalizedAddresses = normalizeAddresses(addresses);
    const key = getMultiNftsCacheKey(normalizedAddresses, chainServerId);
    const removedKey = touchMultiNftsCache(key, {
      addresses: normalizedAddresses,
      chainServerId,
    });
    const nftsMap = nftListStore.getState().nftsMap;
    nftEntityResourceStore.syncAddressesFromNftsMap(
      nftsMap,
      normalizedAddresses,
    );
    updateMultiNftsIndex(key, nftsMap);

    if (removedKey) {
      set(state => {
        const nextCache = { ...state.multiNftsIndexCache };
        const nextAvailability = { ...state.multiNftsAvailabilityByKey };
        delete nextCache[removedKey];
        delete nextAvailability[removedKey];
        return {
          multiNftsIndexCache: nextCache,
          multiNftsAvailabilityByKey: nextAvailability,
        };
      });
    }
    return key;
  },
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
        const nextAvailability = { ...state.singleNftsAvailabilityByKey };
        delete nextCache[removedKey];
        delete nextAvailability[removedKey];
        return {
          singleNftsIndexCache: nextCache,
          singleNftsAvailabilityByKey: nextAvailability,
        };
      });
    }
    return key;
  },
}));

export const combinedNfts = (
  nftsMap: Record<string, DisplayNftItem[]>,
  caredAddresses: string[],
): CombinedNftItem[] => {
  const nfts: CombinedNftItem[] = [];
  caredAddresses.forEach(address => {
    const lowerAddr = address.toLowerCase();
    const nftList = nftsMap[lowerAddr] || nftsMap[address] || [];
    nftList?.forEach(nft => {
      const key = nft.id;
      if (!key) {
        return;
      }
      nfts.push({
        ...nft,
        address: lowerAddr,
        owner_addr: lowerAddr,
      });
    });
  });

  return nfts;
};

export interface NFTListState {
  nftsMap: Record<string, DisplayNftItem[]>;
  sourceSnapshotReadyByAddress: AssetSourceSnapshotReadiness;
  isLoading: boolean;
  isFirstFetch: boolean;
  shortCache: boolean;
  singleLoadStatusByAddress: Record<string, 'loading' | 'ready'>;
  initStore(): Promise<void>;
  updateNFTListByAddress(
    address: string,
    nfts: DisplayNftItem[],
    options?: { sourceSnapshotReady?: boolean },
  ): void;
  clearUnusedNFTs(addresses: string[]): void;
  batchLoadCacheNFT(
    addresses: string[],
    options?: {
      core?: boolean;
      maxLength?: number;
      shouldApply?: () => boolean;
      shouldApplyAddress?: (address: string) => boolean;
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
    options?: { skipCache?: boolean },
  ): Promise<void>;
  hydrateSingleNftCache(address: string): Promise<void>;
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
const latestSingleNftLoadByAddress = new Map<string, Promise<void>>();
const multiAddressNftRequests = new LatestAsyncRequest();
const nftAddressRequests = new LatestAddressRequest();

const getSingleNftRequestKey = (
  address: string,
  force?: boolean,
  updateReturn?: boolean,
) => `${address.toLowerCase()}::${force ? 1 : 0}::${updateReturn ? 1 : 0}`;

const buildNftSnapshotMap = (
  addresses: string[],
  nfts: Array<DisplayNftItem & { owner_addr: string }>,
) => {
  const grouped = nfts.reduce<Record<string, DisplayNftItem[]>>((acc, item) => {
    const address = item.owner_addr.toLowerCase();
    (acc[address] ||= []).push(item);
    return acc;
  }, {});
  return completeAddressListSnapshots(addresses, grouped);
};

const nftCacheHydrator = createAddressListSnapshotHydrator<DisplayNftItem>({
  load: async addresses => {
    const nfts = await NFTItemEntity.batchMultAddressNFTs(addresses);
    return buildNftSnapshotMap(
      addresses,
      nfts as Array<DisplayNftItem & { owner_addr: string }>,
    );
  },
  apply: (snapshots, addresses) => {
    nftListStore.setState(state => ({
      nftsMap: mergeAddressListSnapshots(state.nftsMap, addresses, snapshots),
    }));
  },
});

type TaggedNftLoadResult =
  | NftSnapshotLoadResult
  | { status: 'failed'; error: unknown };

const loadTaggedNfts = async (
  address: string,
  ticket: LatestAddressRequestTicket,
  force?: boolean,
  updateReturn?: boolean,
): Promise<TaggedNftLoadResult> => {
  try {
    return await syncNFTs(address, force, updateReturn ? false : !force, {
      beforeRemote: () => {
        if (!nftAddressRequests.activate(ticket).length) {
          return false;
        }
        nftCacheHydrator.invalidate([address]);
        return true;
      },
      deferPersistence: true,
    });
  } catch (error) {
    console.error('ServiceErrorType.NFT', error);
    return { status: 'failed', error };
  }
};

const canApplyNftSnapshot = (
  address: string,
  ticket: LatestAddressRequestTicket,
  result: Extract<NftSnapshotLoadResult, { status: 'snapshot' }>,
) =>
  result.remoteNfts !== undefined
    ? nftAddressRequests.isCurrent(ticket, address)
    : !nftAddressRequests.isSuperseded(ticket, address);

const publishNftSnapshot = (
  address: string,
  ticket: LatestAddressRequestTicket,
  result: TaggedNftLoadResult,
) => {
  const normalizedAddress = address.toLowerCase();
  if (result.status === 'unchanged') {
    if (
      nftAddressRequests.isSuperseded(ticket, normalizedAddress) ||
      !Object.prototype.hasOwnProperty.call(
        nftListStore.getState().nftsMap,
        normalizedAddress,
      )
    ) {
      return false;
    }
    nftListStore.setState(state => ({
      sourceSnapshotReadyByAddress: markAssetSourceSnapshotsReady(
        state.sourceSnapshotReadyByAddress,
        [normalizedAddress],
      ),
    }));
    return true;
  }
  if (
    result.status !== 'snapshot' ||
    !canApplyNftSnapshot(address, ticket, result)
  ) {
    return false;
  }

  const nfts = result.nfts as DisplayNftItem[];
  nftCacheHydrator.invalidate([normalizedAddress]);
  nftListStore.getState().updateNFTListByAddress(normalizedAddress, nfts, {
    sourceSnapshotReady: true,
  });
  if (result.remoteNfts !== undefined) {
    syncRemoteNFTs(normalizedAddress, result.remoteNfts).catch(error => {
      console.error('[nft] background persistence failed', error);
    });
  }
  return true;
};

const loadAndPublishNfts = async (
  address: string,
  ticket: LatestAddressRequestTicket,
  force?: boolean,
  updateReturn?: boolean,
) => {
  const result = await loadTaggedNfts(address, ticket, force, updateReturn);
  return publishNftSnapshot(address, ticket, result);
};

const nftListStore = zCreate<NFTListState>((set, get) => ({
  nftsMap: {},
  sourceSnapshotReadyByAddress: {},
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
        sourceSnapshotReadyByAddress: {},
        isLoading: false,
        isFirstFetch: false,
      }));
      return;
    }

    await get().batchLoadCacheNFT(top10Addresses);
  },

  updateNFTListByAddress(address, nfts, options) {
    const lowerAddress = address.toLowerCase();
    nftCacheHydrator.invalidate([lowerAddress]);
    set(state => ({
      ...state,
      nftsMap: {
        ...state.nftsMap,
        [lowerAddress]: nfts,
      },
      sourceSnapshotReadyByAddress: options?.sourceSnapshotReady
        ? markAssetSourceSnapshotsReady(state.sourceSnapshotReadyByAddress, [
            lowerAddress,
          ])
        : state.sourceSnapshotReadyByAddress,
    }));
  },

  clearUnusedNFTs(addresses) {
    const cared = new Set(normalizeAddresses(addresses));
    const currentState = get();
    const prevMap = currentState.nftsMap;
    let hasChanged = false;
    const nextMap = { ...prevMap };

    Object.keys(prevMap).forEach(address => {
      if (!cared.has(address.toLowerCase())) {
        delete nextMap[address];
        hasChanged = true;
      }
    });

    const nextReadiness = retainAssetSourceSnapshotReadiness(
      currentState.sourceSnapshotReadyByAddress,
      addresses,
    );
    if (
      hasChanged ||
      nextReadiness !== currentState.sourceSnapshotReadyByAddress
    ) {
      set(state => ({
        ...state,
        nftsMap: nextMap,
        sourceSnapshotReadyByAddress: nextReadiness,
      }));
    }
  },

  async batchLoadCacheNFT(addresses, options) {
    const lowerAddresses = normalizeAddresses(addresses);
    if (!lowerAddresses.length) {
      return;
    }

    if (
      !options?.core &&
      !options?.maxLength &&
      !options?.shouldApply &&
      !options?.shouldApplyAddress
    ) {
      await nftCacheHydrator.hydrate(lowerAddresses);
      return;
    }

    const startedSnapshots = new Map(
      lowerAddresses.map(address => [address, get().nftsMap[address]]),
    );
    const cacheNfts = await NFTItemEntity.batchMultAddressNFTs(
      lowerAddresses,
      options.core,
      options.maxLength,
    );
    if (options?.shouldApply && !options.shouldApply()) {
      return;
    }

    const applicableAddresses = options?.shouldApplyAddress
      ? lowerAddresses.filter(options.shouldApplyAddress)
      : lowerAddresses;
    const unchangedAddresses = applicableAddresses.filter(address =>
      Object.is(get().nftsMap[address], startedSnapshots.get(address)),
    );
    if (!unchangedAddresses.length) {
      return;
    }

    const groupedMap = buildNftSnapshotMap(
      unchangedAddresses,
      cacheNfts as Array<DisplayNftItem & { owner_addr: string }>,
    );

    set(state => {
      const merged = { ...state.nftsMap };

      unchangedAddresses.forEach(address => {
        merged[address] = groupedMap[address] || [];
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

    const normalizedAddress = address.toLowerCase();
    const ticket = nftAddressRequests.reserve([normalizedAddress]);
    await loadAndPublishNfts(normalizedAddress, ticket, force, updateReturn);
  },

  hydrateSingleNftCache(address) {
    if (!address) {
      return Promise.resolve();
    }

    const normalizedAddress = address.toLowerCase();

    const trace = beginAssetDataLoadDiagnostic(
      'single-address-nft',
      normalizedAddress,
      { stage: 'local-cache' },
    );
    return nftCacheHydrator
      .hydrate([normalizedAddress])
      .then(() => {
        trace.mark('cache-store-published', {
          itemCount: get().nftsMap[normalizedAddress]?.length || 0,
        });
        trace.finish({ path: 'local-cache' });
      })
      .catch(error => {
        trace.fail({ phase: 'local-cache' });
        throw error;
      });
  },

  getNFTListWithCache(address, force, updateReturn, options) {
    if (!address) {
      return Promise.resolve();
    }

    const normalizedAddress = address.toLowerCase();
    const requestKey = getSingleNftRequestKey(
      normalizedAddress,
      force,
      updateReturn,
    );
    const trace = beginAssetDataLoadDiagnostic(
      'single-address-nft',
      normalizedAddress,
      {
        force: !!force,
        updateReturn: !!updateReturn,
      },
    );
    const activeRequest = singleNftLoadRequests.get(requestKey);
    if (activeRequest) {
      trace.finish({ path: 'joined-active-request' });
      return activeRequest;
    }

    set(state => ({
      singleLoadStatusByAddress: {
        ...state.singleLoadStatusByAddress,
        [normalizedAddress]: 'loading',
      },
    }));

    const ticket = nftAddressRequests.reserve([normalizedAddress]);
    let request: Promise<void> | undefined;
    request = (async () => {
      try {
        if (!options?.skipCache) {
          await get().hydrateSingleNftCache(normalizedAddress);
          trace.mark('cache-store-published', {
            itemCount: get().nftsMap[normalizedAddress]?.length || 0,
          });
        } else {
          trace.mark('cache-preloaded', {
            itemCount: get().nftsMap[normalizedAddress]?.length || 0,
          });
        }
        await loadAndPublishNfts(
          normalizedAddress,
          ticket,
          force,
          updateReturn,
        );
        trace.mark('remote-store-published', {
          itemCount: get().nftsMap[normalizedAddress]?.length || 0,
        });
        trace.finish({ path: 'cache-then-remote' });
      } catch (error) {
        trace.fail({ phase: 'load' });
        throw error;
      } finally {
        if (singleNftLoadRequests.get(requestKey) === request) {
          singleNftLoadRequests.delete(requestKey);
        }
        if (latestSingleNftLoadByAddress.get(normalizedAddress) === request) {
          latestSingleNftLoadByAddress.delete(normalizedAddress);
          set(state => ({
            singleLoadStatusByAddress: {
              ...state.singleLoadStatusByAddress,
              [normalizedAddress]: 'ready',
            },
          }));
        }
      }
    })();
    singleNftLoadRequests.set(requestKey, request);
    latestSingleNftLoadByAddress.set(normalizedAddress, request);
    return request;
  },

  async batchGetNFTList(force, options) {
    const requestId = multiAddressNftRequests.next();
    const invocationRevision = nftAddressRequests.issueRevision();
    const isCurrentRequest = () => multiAddressNftRequests.isCurrent(requestId);
    const addresses = normalizeAddresses(
      options?.realTimeAddresses || (await getTop10MyAccounts()).top10Addresses,
    );
    const addressTickets = new Map(
      addresses.map(address => [
        address,
        nftAddressRequests.reserveAtRevision([address], invocationRevision),
      ]),
    );
    const trace = beginAssetDataLoadDiagnostic(
      'multi-address-nft',
      addresses.join('|'),
      {
        addressCount: addresses.length,
        force: !!force,
        ignoreLoading: !!options?.ignoreLoading,
      },
    );

    if (!isCurrentRequest()) {
      trace.finish({ path: 'stale-before-hydrate' });
      return;
    }

    get().clearUnusedNFTs(addresses);
    if (!options?.ignoreLoading) {
      set(state => ({ ...state, isLoading: true }));
    }

    try {
      const currentNftsMap = get().nftsMap;
      const hasMemorySnapshot = addresses.every(address =>
        Object.prototype.hasOwnProperty.call(currentNftsMap, address),
      );
      if (!force && !hasMemorySnapshot) {
        await get().batchLoadCacheNFT(addresses, {
          shouldApply: isCurrentRequest,
          shouldApplyAddress: address => {
            const ticket = addressTickets.get(address);
            return (
              !!ticket && !nftAddressRequests.isSuperseded(ticket, address)
            );
          },
        });
        if (!isCurrentRequest()) {
          trace.finish({ path: 'stale-after-hydrate' });
          return;
        }
        trace.mark('local-store-published', {
          itemCount: addresses.reduce(
            (count, address) => count + (get().nftsMap[address]?.length || 0),
            0,
          ),
        });
      } else {
        trace.mark('memory-snapshot-retained', {
          hasMemorySnapshot,
        });
      }

      for (const address of addresses) {
        if (!isCurrentRequest()) {
          trace.finish({ path: 'stale-before-remote' });
          return;
        }
        const ticket = addressTickets.get(address);
        if (!ticket) {
          continue;
        }
        const result = await loadTaggedNfts(
          address,
          ticket,
          force,
          options?.updateReturn,
        );
        if (isCurrentRequest() && publishNftSnapshot(address, ticket, result)) {
          trace.mark('remote-address-published', {
            itemCount: get().nftsMap[address]?.length || 0,
          });
        }
      }
      await new Promise(resolve => setTimeout(resolve, 0));
      trace.finish({ path: 'local-then-remote' });
    } catch (error) {
      trace.fail({ phase: 'load' });
      throw error;
    } finally {
      if (isCurrentRequest()) {
        set(state => ({
          ...state,
          isLoading: false,
          isFirstFetch: false,
        }));
      }
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

const refreshNftProjectionAvailabilityForAddresses = (
  changedAddresses: Set<string>,
) => {
  const state = useNftListComputedStore.getState();
  let singleNftsAvailabilityByKey = state.singleNftsAvailabilityByKey;
  let multiNftsAvailabilityByKey = state.multiNftsAvailabilityByKey;

  singleNftsCacheParams.forEach((params, key) => {
    if (!changedAddresses.has(params.address)) {
      return;
    }
    const result = state.singleNftsIndexCache[key];
    if (!result) {
      return;
    }
    const availability = getNftProjectionAvailability(params, result);
    if (singleNftsAvailabilityByKey[key] !== availability) {
      if (singleNftsAvailabilityByKey === state.singleNftsAvailabilityByKey) {
        singleNftsAvailabilityByKey = { ...singleNftsAvailabilityByKey };
      }
      singleNftsAvailabilityByKey[key] = availability;
    }
    scheduleNftProjectionPersistence(key, 'single-address', result);
  });

  multiNftsCacheParams.forEach((params, key) => {
    if (!params.addresses.some(address => changedAddresses.has(address))) {
      return;
    }
    const result = state.multiNftsIndexCache[key];
    if (!result) {
      return;
    }
    const availability = getNftProjectionAvailability(params, result);
    if (multiNftsAvailabilityByKey[key] !== availability) {
      if (multiNftsAvailabilityByKey === state.multiNftsAvailabilityByKey) {
        multiNftsAvailabilityByKey = { ...multiNftsAvailabilityByKey };
      }
      multiNftsAvailabilityByKey[key] = availability;
    }
    scheduleNftProjectionPersistence(key, 'multi-address', result);
  });

  if (
    singleNftsAvailabilityByKey !== state.singleNftsAvailabilityByKey ||
    multiNftsAvailabilityByKey !== state.multiNftsAvailabilityByKey
  ) {
    useNftListComputedStore.setState({
      singleNftsAvailabilityByKey,
      multiNftsAvailabilityByKey,
    });
  }
};

let latestNftsMap = nftListStore.getState().nftsMap;
let latestNftSourceSnapshotReadiness =
  nftListStore.getState().sourceSnapshotReadyByAddress;
nftListStore.subscribe(state => {
  if (
    state.nftsMap === latestNftsMap &&
    state.sourceSnapshotReadyByAddress === latestNftSourceSnapshotReadiness
  ) {
    return;
  }

  const changedAddresses = getNftsMapChangedAddresses(
    latestNftsMap,
    state.nftsMap,
  );
  const readinessChangedAddresses = getAssetSourceReadinessChangedAddresses(
    latestNftSourceSnapshotReadiness,
    state.sourceSnapshotReadyByAddress,
  );
  const readinessOnlyChangedAddresses = new Set(
    Array.from(readinessChangedAddresses).filter(
      address => !changedAddresses.has(address),
    ),
  );
  latestNftsMap = state.nftsMap;
  latestNftSourceSnapshotReadiness = state.sourceSnapshotReadyByAddress;
  const registeredChangedAddresses = Array.from(changedAddresses).filter(
    address =>
      Array.from(singleNftsCacheParams.values()).some(
        params => params.address === address,
      ) ||
      Array.from(multiNftsCacheParams.values()).some(params =>
        params.addresses.includes(address),
      ),
  );
  if (registeredChangedAddresses.length) {
    nftEntityResourceStore.syncAddressesFromNftsMap(
      state.nftsMap,
      registeredChangedAddresses,
    );
    singleNftsCacheParams.forEach((params, key) => {
      if (changedAddresses.has(params.address)) {
        updateSingleNftsIndex(key, state.nftsMap);
      }
    });
    multiNftsCacheParams.forEach((params, key) => {
      if (params.addresses.some(address => changedAddresses.has(address))) {
        updateMultiNftsIndex(key, state.nftsMap);
      }
    });
  }
  if (readinessOnlyChangedAddresses.size) {
    refreshNftProjectionAvailabilityForAddresses(readinessOnlyChangedAddresses);
  }
});

export function getAssetsMapDirectly(type: 'nfts') {
  if (type !== 'nfts') {
    console.warn('Invalid asset type requested');
    return {};
  }

  return nftListStore.getState().nftsMap;
}

export default nftListStore;
