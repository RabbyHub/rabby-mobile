import { zCreate } from '@/core/utils/reexports';
import { ProtocolItemEntity } from '@/databases/entities/portocolItem';
import { AppChainEntity } from '@/databases/entities/appchain';
import {
  loadProtocols,
  loadProtocolsForAddresses,
  syncSpecificProtocol,
} from '@/databases/hooks/assets';
import {
  syncRemoteProtocols,
  syncRemoteProtocolsForAddresses,
} from '@/databases/sync/assets';
import { formatAppChain } from '@/utils/appchain';
import { reportLendingUserStatusOnce } from '@/utils/lendingUserStatus';
import { complexProtocol2ProtocolItem } from '@/utils/protocol';
import type { ICacheProtocolItem, IProtocolItem } from '@/types/assets';
import { markStartupPerf } from '@/core/utils/startupPerfMarks';
import { getSelectedBalanceAddressesSnapshot } from './balance';
import { ResourceBaseStore } from './_resourceBase';
import type { ObservableResourceValueSource } from './_resourceFlow';
import { beginAssetDataLoadDiagnostic } from '@/core/utils/assetDataLoadDiagnostics';
import { AddressBatchRefreshCoordinator } from '@/core/utils/addressBatchRefreshCoordinator';
import { LatestAsyncRequest } from '@/core/utils/latestAsyncRequest';
import { LatestAddressRequest } from '@/core/utils/latestAddressRequest';
import {
  buildProtocolAssetsIndexResult,
  buildProtocolEntityId,
  type ProtocolAssetsIndexResult,
  type ProtocolEntityId,
} from './protocolAssetsIndex';
import {
  completeAddressListSnapshots,
  createAddressListSnapshotHydrator,
  mergeAddressListSnapshots,
} from './_addressListSnapshot';
import {
  isAssetProjectionPersistenceActive,
  restoreAssetProjection,
  scheduleAssetProjectionPersistence,
  subscribeAssetProjectionDatabaseCommits,
} from './assetProjectionPersistence';
import {
  hasConfirmedAssetProjectionSources,
  markAssetSourceSnapshotsReady,
  resolveAssetProjectionAvailability,
  type AssetProjectionAvailability,
  type AssetSourceSnapshotReadiness,
} from './assetProjectionAvailability';

export {
  buildProtocolEntityId,
  EMPTY_PROTOCOL_ASSETS_INDEX_RESULT,
  type ProtocolAssetsIndexResult,
  type ProtocolEntityId,
} from './protocolAssetsIndex';

export type {
  ICacheProtocolItem,
  IProtocolItem,
  IProtocolPortfolio,
} from '@/types/assets';

type ProtocolListMap = Record<string, IProtocolItem[]>;

interface ProtocolListState {
  protocolMap: ProtocolListMap;
  sourceSnapshotReadyByAddress: AssetSourceSnapshotReadiness;
  isLoading: boolean;
  isLoadingByAddress: Record<string, boolean>;
  hasLoadedByAddress: Record<string, boolean>;
  initStore(): void;
  batchGetProtocols(addresses: string[], force?: boolean): Promise<void>;
  getProtocols(address: string, force?: boolean): Promise<void>;
  updateSpecificProtocol(
    address: string,
    protocolId: string,
    chain: string,
  ): void;
}

type ProtocolListComputedState = {
  multiProtocolsIndexCache: Record<string, ProtocolAssetsIndexResult>;
  singleProtocolsIndexCache: Record<string, ProtocolAssetsIndexResult>;
  multiProtocolsAvailabilityByKey: Record<string, AssetProjectionAvailability>;
  singleProtocolsAvailabilityByKey: Record<string, AssetProjectionAvailability>;
  registerMultiProtocols: (
    addresses: string[],
    chainServerId?: string,
  ) => string;
  registerSingleProtocols: (address: string, chainServerId?: string) => string;
};

const COMPUTED_CACHE_LIMIT = 10;
const PROTOCOL_ENTITY_RESOURCE_FAMILY = 'protocol.entity';
const multiAddressProtocolRequests = new LatestAsyncRequest();
const multiAddressProtocolBatchRefreshes = new AddressBatchRefreshCoordinator();
const protocolAddressRequests = new LatestAddressRequest();

const normalizeAddresses = (addresses: string[]) =>
  addresses.map(address => address.toLowerCase());

const getAddressesKey = (addresses: string[]) =>
  normalizeAddresses(addresses).join('|');

export const getMultiProtocolsCacheKey = (
  addresses: string[],
  chainServerId?: string,
) => `${getAddressesKey(addresses)}::${chainServerId ?? ''}`;

export const getSingleProtocolsCacheKey = (
  address: string,
  chainServerId?: string,
) => `${address.toLowerCase()}::${chainServerId ?? ''}`;

const getProtocolListFromProtocolMap = (protocolMap: ProtocolListMap) =>
  Object.values(protocolMap).flat();

const getChangedProtocolKeys = (
  previousProtocol: IProtocolItem | undefined,
  nextProtocol: IProtocolItem,
) => {
  if (!previousProtocol) {
    return null;
  }

  const keys = new Set([
    ...Object.keys(previousProtocol),
    ...Object.keys(nextProtocol),
  ] as Array<keyof IProtocolItem>);
  const changedKeys: Array<keyof IProtocolItem> = [];

  keys.forEach(key => {
    if (!Object.is(previousProtocol[key], nextProtocol[key])) {
      changedKeys.push(key);
    }
  });

  return changedKeys;
};

class ProtocolEntityResourceStore extends ResourceBaseStore<IProtocolItem> {
  constructor() {
    super(PROTOCOL_ENTITY_RESOURCE_FAMILY, { mutative: true });
  }

  upsertProtocols = (
    protocols: IProtocolItem[],
    source: ObservableResourceValueSource = 'remote',
    options?: { pruneMissing?: boolean },
  ) => {
    const entries = new Map<ProtocolEntityId, IProtocolItem>();
    protocols.forEach(protocol => {
      entries.set(buildProtocolEntityId(protocol), protocol);
    });

    const now = Date.now();
    const previous = this.getState();
    const changedProtocols: Array<{
      protocolId: ProtocolEntityId;
      protocol: IProtocolItem;
      changedKeys: Array<keyof IProtocolItem> | null;
      meta: (typeof previous.metaMap)[string];
    }> = [];

    entries.forEach((protocol, protocolId) => {
      const previousProtocol = previous.valueMap[protocolId];
      const previousMeta = previous.metaMap[protocolId];
      const changedKeys = getChangedProtocolKeys(previousProtocol, protocol);

      if (!previousMeta || !previousProtocol || changedKeys?.length) {
        changedProtocols.push({
          protocolId,
          protocol,
          changedKeys,
          meta: {
            family: PROTOCOL_ENTITY_RESOURCE_FAMILY,
            resourceKey: protocolId,
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

    const removedProtocolIds = options?.pruneMissing
      ? Array.from(
          new Set([
            ...Object.keys(previous.valueMap),
            ...Object.keys(previous.metaMap),
          ]),
        ).filter(protocolId => !entries.has(protocolId as ProtocolEntityId))
      : [];

    if (!changedProtocols.length && !removedProtocolIds.length) {
      return;
    }

    this.mutateState(draft => {
      changedProtocols.forEach(
        ({ protocolId, protocol, changedKeys, meta }) => {
          const previousProtocol = draft.valueMap[protocolId];
          if (!previousProtocol || !changedKeys) {
            draft.valueMap[protocolId] = protocol;
          } else {
            changedKeys.forEach(key => {
              if (Object.prototype.hasOwnProperty.call(protocol, key)) {
                previousProtocol[key] = protocol[key] as never;
              } else {
                delete previousProtocol[key];
              }
            });
          }
          draft.metaMap[protocolId] = meta;
        },
      );

      removedProtocolIds.forEach(protocolId => {
        delete draft.valueMap[protocolId];
        delete draft.metaMap[protocolId];
      });
    });
  };

  syncFromProtocolMap = (
    protocolMap: ProtocolListMap,
    source: ObservableResourceValueSource = 'remote',
  ) => {
    this.upsertProtocols(getProtocolListFromProtocolMap(protocolMap), source, {
      pruneMissing: true,
    });
  };
}

export const protocolEntityResourceStore = new ProtocolEntityResourceStore();

const computeSingleProtocols = (
  protocolMap: ProtocolListMap,
  address: string,
  chainServerId?: string,
): ICacheProtocolItem => {
  if (!address) {
    return [];
  }

  const normalizedAddress = address.toLowerCase();
  const projects = protocolMap[normalizedAddress] || [];

  const filtered = chainServerId
    ? projects.filter(p => p.chain === chainServerId)
    : projects;

  return filtered;
};

const computeSingleProtocolsIndex = (
  protocolMap: ProtocolListMap,
  address: string,
  chainServerId?: string,
  previousResult?: ProtocolAssetsIndexResult,
) =>
  buildProtocolAssetsIndexResult(
    computeSingleProtocols(protocolMap, address, chainServerId),
    previousResult,
  );

const computeMultiProtocols = (
  protocolMap: ProtocolListMap,
  addresses: string[],
  chainServerId?: string,
): ICacheProtocolItem => {
  if (!addresses.length) {
    return [];
  }

  const normalizedAddresses = normalizeAddresses(addresses);
  const projects = normalizedAddresses.flatMap(
    address => protocolMap[address] || [],
  );

  const filtered = chainServerId
    ? projects.filter(p => p.chain === chainServerId)
    : projects;

  return filtered;
};

const computeMultiProtocolsIndex = (
  protocolMap: ProtocolListMap,
  addresses: string[],
  chainServerId?: string,
  previousResult?: ProtocolAssetsIndexResult,
) =>
  buildProtocolAssetsIndexResult(
    computeMultiProtocols(protocolMap, addresses, chainServerId),
    previousResult,
  );

const multiProtocolsCacheParams = new Map<
  string,
  {
    addresses: string[];
    chainServerId?: string;
  }
>();

const singleProtocolsCacheParams = new Map<
  string,
  {
    address: string;
    chainServerId?: string;
  }
>();

const multiProtocolsCacheOrder: string[] = [];
const singleProtocolsCacheOrder: string[] = [];

type ProtocolProjectionScene = 'single-address' | 'multi-address';

const getProtocolProjectionAvailability = (
  params:
    | { address: string; chainServerId?: string }
    | { addresses: string[]; chainServerId?: string }
    | undefined,
  result: ProtocolAssetsIndexResult | undefined,
  isRestoring = false,
) => {
  const addresses = params
    ? 'address' in params
      ? [params.address]
      : params.addresses
    : [];
  return resolveAssetProjectionAvailability({
    hasProjection: !!params && !!result,
    hasData: !!result?.protocolIds.length,
    hasCompleteSource:
      !!params &&
      hasConfirmedAssetProjectionSources(
        addresses,
        useProtocolListStore.getState().sourceSnapshotReadyByAddress,
      ),
    isRestoring,
  });
};

const scheduleProtocolProjectionPersistence = (
  key: string,
  scene: ProtocolProjectionScene,
  result: ProtocolAssetsIndexResult,
) => {
  const params =
    scene === 'single-address'
      ? singleProtocolsCacheParams.get(key)
      : multiProtocolsCacheParams.get(key);
  if (!params) {
    return;
  }
  const addresses = 'address' in params ? [params.address] : params.addresses;
  const isSourceSnapshotReady = hasConfirmedAssetProjectionSources(
    addresses,
    useProtocolListStore.getState().sourceSnapshotReadyByAddress,
  );
  if (!result.protocolIds.length && !isSourceSnapshotReady) {
    return;
  }
  scheduleAssetProjectionPersistence({
    runtimeKey: key,
    kind: 'protocol',
    scene,
    rows: result.protocolIds.map(protocolId => ({
      type: 'protocol',
      id: protocolId,
    })),
    metadata: {
      defaultVisibleProtocolCount: result.defaultVisibleProtocolCount,
      foldedProtocolUsdValue: result.foldedProtocolUsdValue,
    },
  });
};

const protocolProjectionRestoreRequests = new Map<string, Promise<void>>();

const restoreProtocolProjectionIfEmpty = (
  key: string,
  scene: ProtocolProjectionScene,
) => {
  if (
    isAssetProjectionPersistenceActive({
      runtimeKey: key,
      kind: 'protocol',
      scene,
    })
  ) {
    return;
  }
  const requestKey = `${scene}:${key}`;
  if (protocolProjectionRestoreRequests.has(requestKey)) {
    return;
  }
  const params =
    scene === 'single-address'
      ? singleProtocolsCacheParams.get(key)
      : multiProtocolsCacheParams.get(key);
  if (!params) {
    return;
  }

  const startedResult =
    scene === 'single-address'
      ? useProtocolListComputedStore.getState().singleProtocolsIndexCache[key]
      : useProtocolListComputedStore.getState().multiProtocolsIndexCache[key];
  if (startedResult?.protocolIds.length) {
    return;
  }
  const startedSourceMap = useProtocolListStore.getState().protocolMap;
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

  useProtocolListComputedStore.setState(current =>
    scene === 'single-address'
      ? {
          singleProtocolsAvailabilityByKey: {
            ...current.singleProtocolsAvailabilityByKey,
            [key]: 'restoring',
          },
        }
      : {
          multiProtocolsAvailabilityByKey: {
            ...current.multiProtocolsAvailabilityByKey,
            [key]: 'restoring',
          },
        },
  );
  const trace = beginAssetDataLoadDiagnostic(
    'asset-projection-protocol-restore',
    scene,
    { addressCount: addresses.length },
  );

  const request = (async () => {
    const restored = await restoreAssetProjection({
      runtimeKey: key,
      kind: 'protocol',
      scene,
    });
    if (!restored) {
      trace.finish({ reason: 'projection-missing' });
      return;
    }
    trace.mark('projection-restored', { itemCount: restored.rows.length });
    const requiredProtocolIds = new Set<ProtocolEntityId>();
    for (const row of restored.rows) {
      if (row.type !== 'protocol') {
        trace.finish({ reason: 'projection-invalid' });
        return;
      }
      requiredProtocolIds.add(row.id as ProtocolEntityId);
    }

    const missingProtocolIds = Array.from(requiredProtocolIds).filter(
      protocolId => !protocolEntityResourceStore.getValue(protocolId),
    );
    trace.mark('entity-selection-ready', {
      itemCount: requiredProtocolIds.size,
    });
    if (missingProtocolIds.length) {
      trace.mark('entity-query-started', {
        itemCount: missingProtocolIds.length,
      });
      const [cachedProtocols, cachedAppChainMap] = await Promise.all([
        ProtocolItemEntity.batchMultiAddressProtocolsByResourceIds(
          missingProtocolIds,
        ),
        AppChainEntity.queryByProtocolResourceIds(missingProtocolIds),
      ]);
      trace.mark('entity-query-finished', {
        itemCount:
          cachedProtocols.length +
          Object.values(cachedAppChainMap).reduce(
            (count, appChains) => count + appChains.length,
            0,
          ),
      });
      const latestParamsBeforeHydrate =
        scene === 'single-address'
          ? singleProtocolsCacheParams.get(key)
          : multiProtocolsCacheParams.get(key);
      const stateBeforeHydrate = useProtocolListComputedStore.getState();
      const resultBeforeHydrate =
        scene === 'single-address'
          ? stateBeforeHydrate.singleProtocolsIndexCache[key]
          : stateBeforeHydrate.multiProtocolsIndexCache[key];
      if (
        latestParamsBeforeHydrate !== params ||
        resultBeforeHydrate !== startedResult ||
        useProtocolListStore.getState().protocolMap !== startedSourceMap
      ) {
        trace.finish({ reason: 'state-changed-before-entity-publish' });
        return;
      }
      const cachedAppChainProtocols = Object.entries(cachedAppChainMap).flatMap(
        ([owner, appChains]) =>
          appChains.map(appChain =>
            complexProtocol2ProtocolItem(formatAppChain(appChain), owner),
          ),
      );
      const missingProtocols = cachedProtocols
        .concat(cachedAppChainProtocols)
        .filter(protocol => {
          const protocolId = buildProtocolEntityId(protocol);
          return (
            requiredProtocolIds.has(protocolId) &&
            !protocolEntityResourceStore.getValue(protocolId)
          );
        });
      protocolEntityResourceStore.upsertProtocols(missingProtocols, 'hydrate');
      trace.mark('entities-published', { itemCount: missingProtocols.length });
    }

    const protocolIds: ProtocolEntityId[] = [];
    for (const row of restored.rows) {
      if (row.type !== 'protocol') {
        trace.finish({ reason: 'projection-invalid' });
        return;
      }
      const protocolId = row.id as ProtocolEntityId;
      if (!protocolEntityResourceStore.getValue(protocolId)) {
        trace.finish({ reason: 'projection-entity-missing' });
        return;
      }
      protocolIds.push(protocolId);
    }

    const latestParams =
      scene === 'single-address'
        ? singleProtocolsCacheParams.get(key)
        : multiProtocolsCacheParams.get(key);
    const state = useProtocolListComputedStore.getState();
    const currentResult =
      scene === 'single-address'
        ? state.singleProtocolsIndexCache[key]
        : state.multiProtocolsIndexCache[key];
    if (
      latestParams !== params ||
      currentResult !== startedResult ||
      useProtocolListStore.getState().protocolMap !== startedSourceMap
    ) {
      trace.finish({ reason: 'state-changed-before-projection-publish' });
      return;
    }

    const defaultVisibleProtocolCount =
      restored.metadata.defaultVisibleProtocolCount;
    const foldedProtocolUsdValue = restored.metadata.foldedProtocolUsdValue;
    if (
      typeof defaultVisibleProtocolCount !== 'number' ||
      !Number.isInteger(defaultVisibleProtocolCount) ||
      defaultVisibleProtocolCount < 0 ||
      defaultVisibleProtocolCount > protocolIds.length ||
      typeof foldedProtocolUsdValue !== 'string'
    ) {
      trace.finish({ reason: 'projection-invalid' });
      return;
    }

    const result: ProtocolAssetsIndexResult = {
      protocolIds,
      defaultVisibleProtocolCount,
      foldedProtocolUsdValue,
    };
    useProtocolListComputedStore.setState(current =>
      scene === 'single-address'
        ? {
            singleProtocolsIndexCache: {
              ...current.singleProtocolsIndexCache,
              [key]: result,
            },
            singleProtocolsAvailabilityByKey: {
              ...current.singleProtocolsAvailabilityByKey,
              [key]: 'ready',
            },
          }
        : {
            multiProtocolsIndexCache: {
              ...current.multiProtocolsIndexCache,
              [key]: result,
            },
            multiProtocolsAvailabilityByKey: {
              ...current.multiProtocolsAvailabilityByKey,
              [key]: 'ready',
            },
          },
    );
    trace.finish({ itemCount: protocolIds.length });
  })()
    .catch(error => {
      trace.fail({ reason: 'restore-error' });
      console.error('[protocolProjection] restore failed', error);
    })
    .finally(() => {
      protocolProjectionRestoreRequests.delete(requestKey);
      const state = useProtocolListComputedStore.getState();
      const availability =
        scene === 'single-address'
          ? state.singleProtocolsAvailabilityByKey[key]
          : state.multiProtocolsAvailabilityByKey[key];
      if (availability !== 'restoring') {
        return;
      }
      const latestParams =
        scene === 'single-address'
          ? singleProtocolsCacheParams.get(key)
          : multiProtocolsCacheParams.get(key);
      const result =
        scene === 'single-address'
          ? state.singleProtocolsIndexCache[key]
          : state.multiProtocolsIndexCache[key];
      const nextAvailability = getProtocolProjectionAvailability(
        latestParams,
        result,
      );
      useProtocolListComputedStore.setState(current =>
        scene === 'single-address'
          ? {
              singleProtocolsAvailabilityByKey: {
                ...current.singleProtocolsAvailabilityByKey,
                [key]: nextAvailability,
              },
            }
          : {
              multiProtocolsAvailabilityByKey: {
                ...current.multiProtocolsAvailabilityByKey,
                [key]: nextAvailability,
              },
            },
      );
    });
  protocolProjectionRestoreRequests.set(requestKey, request);
};

subscribeAssetProjectionDatabaseCommits(() => {
  singleProtocolsCacheParams.forEach((_params, key) => {
    restoreProtocolProjectionIfEmpty(key, 'single-address');
  });
  multiProtocolsCacheParams.forEach((_params, key) => {
    restoreProtocolProjectionIfEmpty(key, 'multi-address');
  });
});

const removeKeysFromCache = <T extends Record<string, unknown>>(
  cache: T,
  keys: string[],
) => {
  if (!keys.length) {
    return cache;
  }
  const next = { ...cache };
  keys.forEach(key => {
    delete next[key];
  });
  return next;
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

const isDataExpired = async (address: string) => {
  const isExpired = await ProtocolItemEntity.isExpired(address);
  return isExpired;
};

const getDataExpirationByAddress = (addresses: string[]) =>
  ProtocolItemEntity.getExpirationByOwners(addresses);

const buildAppChainProtocolMap = async (
  addresses: string[],
): Promise<ProtocolListMap> => {
  if (!addresses.length) {
    return {};
  }
  const normalizedAddresses = normalizeAddresses(addresses);
  const appChainMap = await AppChainEntity.queryByOwners(normalizedAddresses);
  const result: ProtocolListMap = {};
  Object.entries(appChainMap).forEach(([owner, appChains]) => {
    if (!appChains?.length) {
      return;
    }
    result[owner.toLowerCase()] = appChains.map(appChain =>
      complexProtocol2ProtocolItem(formatAppChain(appChain), owner),
    );
  });
  return result;
};

const mergeProtocolMaps = (
  base: ProtocolListMap,
  extra: ProtocolListMap,
): ProtocolListMap => {
  const merged: ProtocolListMap = {};
  const keys = new Set([...Object.keys(base), ...Object.keys(extra)]);
  keys.forEach(key => {
    const baseList = base[key] || [];
    const extraList = extra[key] || [];
    if (baseList.length || extraList.length) {
      merged[key] = [...baseList, ...extraList];
    }
  });
  return merged;
};

const loadProtocolSnapshots = async (
  addresses: string[],
): Promise<ProtocolListMap> => {
  const normalizedAddresses = Array.from(
    new Set(normalizeAddresses(addresses)),
  );
  const [protocolMap, appChainMap] = await Promise.all([
    ProtocolItemEntity.getDefaultProtocolsByAddresses(normalizedAddresses),
    buildAppChainProtocolMap(normalizedAddresses),
  ]);

  return completeAddressListSnapshots(
    normalizedAddresses,
    mergeProtocolMaps(protocolMap, appChainMap),
  );
};

const protocolCacheHydrator = createAddressListSnapshotHydrator<IProtocolItem>({
  load: loadProtocolSnapshots,
  apply: (snapshots, addresses) => {
    const nextProtocolMap = mergeAddressListSnapshots(
      useProtocolListStore.getState().protocolMap,
      addresses,
      snapshots,
    );
    protocolEntityResourceStore.syncFromProtocolMap(nextProtocolMap, 'hydrate');
    useProtocolListStore.setState({ protocolMap: nextProtocolMap });
  },
});

export const useProtocolListStore = zCreate<ProtocolListState>((set, get) => ({
  protocolMap: {},
  sourceSnapshotReadyByAddress: {},
  isLoading: false,
  isLoadingByAddress: {},
  hasLoadedByAddress: {},
  async initStore() {
    const startedAt = Date.now();
    markStartupPerf('protocolListStore', 'initStore_start');

    const addressesStartedAt = Date.now();
    const top10Addresses = getSelectedBalanceAddressesSnapshot();
    markStartupPerf('protocolListStore', 'selected_addresses_snapshot_end', {
      elapsedMs: Date.now() - addressesStartedAt,
      count: top10Addresses.length,
    });

    const loadStartedAt = Date.now();
    await protocolCacheHydrator.hydrate(top10Addresses);
    markStartupPerf('protocolListStore', 'load_cache_end', {
      elapsedMs: Date.now() - loadStartedAt,
      count: top10Addresses.length,
    });
    markStartupPerf('protocolListStore', 'initStore_end', {
      elapsedMs: Date.now() - startedAt,
      count: top10Addresses.length,
    });
  },
  async batchGetProtocols(addresses, force = false) {
    const lowerAddresses = Array.from(
      new Set(addresses.map(item => item.toLowerCase())),
    );
    return multiAddressProtocolBatchRefreshes.run(
      lowerAddresses,
      force,
      async ticket => {
        const requestId = multiAddressProtocolRequests.next();
        const addressRequest = protocolAddressRequests.reserve(lowerAddresses);
        const isCurrentRequest = () =>
          multiAddressProtocolRequests.isCurrent(requestId);
        const getCurrentAddresses = () =>
          isCurrentRequest()
            ? protocolAddressRequests.getCurrentAddresses(addressRequest)
            : [];
        const isForceRequested = () => force || ticket.isForceRequested();
        if (!lowerAddresses.length) {
          set(() => ({ isLoading: true }));
          await new Promise(resolve => setTimeout(resolve, 0));
          if (isCurrentRequest()) {
            set(() => ({
              protocolMap: {},
              sourceSnapshotReadyByAddress: {},
              isLoading: false,
            }));
          }
          return;
        }
        const trace = beginAssetDataLoadDiagnostic(
          'multi-address-protocol',
          lowerAddresses.join('|'),
          {
            addressCount: lowerAddresses.length,
            force,
          },
        );

        try {
          let confirmedLocalAddresses: string[] = [];
          if (!isForceRequested()) {
            const expirationByAddress = await getDataExpirationByAddress(
              lowerAddresses,
            );
            const isExpired = Object.values(expirationByAddress).some(Boolean);
            confirmedLocalAddresses = lowerAddresses.filter(
              address => !expirationByAddress[address],
            );
            trace.mark('expiry-resolved', { isExpired });
            if (!isExpired && !isForceRequested()) {
              const hasMemorySnapshot = lowerAddresses.every(address =>
                Object.prototype.hasOwnProperty.call(
                  get().protocolMap,
                  address,
                ),
              );
              if (!hasMemorySnapshot) {
                await protocolCacheHydrator.hydrate(lowerAddresses);
              }
              set(state => ({
                sourceSnapshotReadyByAddress: markAssetSourceSnapshotsReady(
                  state.sourceSnapshotReadyByAddress,
                  confirmedLocalAddresses,
                ),
              }));
              const protocolMap = get().protocolMap;
              trace.mark('local-db-loaded', {
                itemCount: lowerAddresses.reduce(
                  (count, address) =>
                    count + (protocolMap[address]?.length || 0),
                  0,
                ),
              });
              reportLendingUserStatusOnce({
                addresses: lowerAddresses,
                protocolMap,
              });
              trace.finish({ path: 'local-db' });
              return;
            }
            if (!isExpired) {
              confirmedLocalAddresses = [];
              trace.mark('force-refresh-coalesced');
            }
          }

          if (
            !isCurrentRequest() ||
            !protocolAddressRequests.activate(addressRequest).length
          ) {
            trace.finish({ path: 'stale-before-remote' });
            return;
          }
          protocolCacheHydrator.invalidate(lowerAddresses);
          set(() => ({ isLoading: true }));

          trace.mark('remote-address-requests-dispatched', {
            addressCount: lowerAddresses.length,
          });
          const remoteProtocolsPromise = loadProtocolsForAddresses(
            lowerAddresses,
            isForceRequested(),
          ).then(
            result => ({ status: 'fulfilled' as const, result }),
            error => ({ status: 'rejected' as const, error }),
          );
          const currentProtocolMap = get().protocolMap;
          const hasMemorySnapshot = lowerAddresses.every(address =>
            Object.prototype.hasOwnProperty.call(currentProtocolMap, address),
          );

          if (!force && !hasMemorySnapshot) {
            await protocolCacheHydrator.hydrate(lowerAddresses);
            const localProtocolMap = get().protocolMap;
            trace.mark('stale-local-db-loaded', {
              itemCount: lowerAddresses.reduce(
                (count, address) =>
                  count + (localProtocolMap[address]?.length || 0),
                0,
              ),
            });
            if (isCurrentRequest()) {
              trace.mark('stale-local-store-published');
            }
          } else {
            trace.mark('memory-snapshot-retained', {
              hasMemorySnapshot,
            });
          }
          if (confirmedLocalAddresses.length) {
            set(state => ({
              sourceSnapshotReadyByAddress: markAssetSourceSnapshotsReady(
                state.sourceSnapshotReadyByAddress,
                confirmedLocalAddresses,
              ),
            }));
          }

          const remoteProtocols = await remoteProtocolsPromise;
          if (remoteProtocols.status === 'rejected') {
            throw remoteProtocols.error;
          }
          const { protocolMap: resultMap, remoteProtocolMap } =
            remoteProtocols.result;
          trace.mark('remote-response-completed', {
            itemCount: Object.values(resultMap).reduce(
              (count, protocols) => count + protocols.length,
              0,
            ),
          });
          const currentAddresses = getCurrentAddresses();
          if (!currentAddresses.length) {
            trace.finish({ path: 'stale-after-remote' });
            return;
          }
          const applicableProtocolMap = Object.fromEntries(
            currentAddresses.map(address => [
              address,
              resultMap[address] || [],
            ]),
          );
          const applicableRemoteProtocolMap = Object.fromEntries(
            currentAddresses
              .filter(address =>
                Object.prototype.hasOwnProperty.call(
                  remoteProtocolMap,
                  address,
                ),
              )
              .map(address => [address, remoteProtocolMap[address]]),
          );
          const nextProtocolMap = mergeAddressListSnapshots(
            get().protocolMap,
            currentAddresses,
            applicableProtocolMap,
          );
          protocolEntityResourceStore.syncFromProtocolMap(
            nextProtocolMap,
            'remote',
          );
          protocolCacheHydrator.invalidate(currentAddresses);
          set(state => ({
            protocolMap: nextProtocolMap,
            sourceSnapshotReadyByAddress: markAssetSourceSnapshotsReady(
              state.sourceSnapshotReadyByAddress,
              currentAddresses,
            ),
          }));
          trace.mark('remote-store-published', {
            addressCount: currentAddresses.length,
          });
          void syncRemoteProtocolsForAddresses(applicableRemoteProtocolMap);
          reportLendingUserStatusOnce({
            addresses: currentAddresses,
            protocolMap: applicableProtocolMap,
          });
          trace.finish({ path: 'local-then-remote' });
        } catch (error) {
          trace.fail({ phase: 'load' });
          throw error;
        } finally {
          if (isCurrentRequest()) {
            set(() => ({ isLoading: false }));
          }
        }
      },
    );
  },
  async getProtocols(address, force = false) {
    if (!address) {
      return;
    }

    const normalizedAddress = address.toLowerCase();
    const addressRequest = protocolAddressRequests.reserve([normalizedAddress]);
    const isCurrentRequest = () =>
      protocolAddressRequests.isCurrent(addressRequest, normalizedAddress);

    try {
      if (!force) {
        const isExpired = await isDataExpired(normalizedAddress);
        if (!isExpired) {
          const hasMemorySnapshot = Object.prototype.hasOwnProperty.call(
            get().protocolMap,
            normalizedAddress,
          );
          if (!hasMemorySnapshot) {
            await protocolCacheHydrator.hydrate([normalizedAddress]);
          }
          set(state => ({
            sourceSnapshotReadyByAddress: markAssetSourceSnapshotsReady(
              state.sourceSnapshotReadyByAddress,
              [normalizedAddress],
            ),
            hasLoadedByAddress: {
              ...state.hasLoadedByAddress,
              [normalizedAddress]: true,
            },
          }));
          return;
        }
      }

      if (!protocolAddressRequests.activate(addressRequest).length) {
        return;
      }
      protocolCacheHydrator.invalidate([normalizedAddress]);
      set(state => ({
        isLoadingByAddress: {
          ...state.isLoadingByAddress,
          [normalizedAddress]: true,
        },
      }));

      const result = await loadProtocols(normalizedAddress, force);
      if (!isCurrentRequest()) {
        return;
      }
      const nextProtocolMap = {
        ...get().protocolMap,
        [normalizedAddress]: result.protocols,
      };
      protocolEntityResourceStore.syncFromProtocolMap(
        nextProtocolMap,
        'remote',
      );
      set(state => ({
        protocolMap: nextProtocolMap,
        sourceSnapshotReadyByAddress: markAssetSourceSnapshotsReady(
          state.sourceSnapshotReadyByAddress,
          [normalizedAddress],
        ),
      }));
      if (result.remoteProtocols) {
        void syncRemoteProtocols(normalizedAddress, result.remoteProtocols);
      }
    } finally {
      if (isCurrentRequest()) {
        set(state => ({
          isLoadingByAddress: {
            ...state.isLoadingByAddress,
            [normalizedAddress]: false,
          },
          hasLoadedByAddress: {
            ...state.hasLoadedByAddress,
            [normalizedAddress]: true,
          },
        }));
      }
    }
  },
  //更新特定的仓位，类似之前的updateSpecificProtocol
  async updateSpecificProtocol(address, protocolId, chain) {
    const normalizedAddress = address.toLowerCase();
    if (!normalizedAddress || !protocolId || !chain) {
      return;
    }

    try {
      const targetProtocol = await syncSpecificProtocol(
        normalizedAddress,
        protocolId,
        chain,
      );
      if (!targetProtocol || !targetProtocol?._portfolios?.length) {
        // 仓位没了，要删除
        set(state => ({
          protocolMap: {
            ...state.protocolMap,
            [normalizedAddress]:
              state.protocolMap?.[normalizedAddress]?.filter(
                item => item.id !== protocolId,
              ) || [],
          },
        }));
        return;
      }

      // 仓位还在，要更新、或者插入
      set(state => {
        const preData = [...(state.protocolMap?.[normalizedAddress] || [])];
        const currentProtocolIndex = preData.findIndex(
          item => item.id === protocolId,
        );
        if (currentProtocolIndex > -1) {
          preData[currentProtocolIndex] = targetProtocol;
        } else {
          preData.push(targetProtocol);
        }
        return {
          protocolMap: {
            ...state.protocolMap,
            [normalizedAddress]: preData,
          },
        };
      });
    } catch (error) {
      console.error('Failed to update specific protocol:', error);
    }
  },
}));

export const useProtocolListComputedStore = zCreate<ProtocolListComputedState>(
  set => ({
    multiProtocolsIndexCache: {},
    singleProtocolsIndexCache: {},
    multiProtocolsAvailabilityByKey: {},
    singleProtocolsAvailabilityByKey: {},
    registerMultiProtocols(addresses, chainServerId) {
      const key = getMultiProtocolsCacheKey(addresses, chainServerId);
      const removedKeys = touchCacheParams(
        multiProtocolsCacheParams,
        multiProtocolsCacheOrder,
        key,
        {
          addresses,
          chainServerId,
        },
      );
      const protocolMap = useProtocolListStore.getState().protocolMap;
      protocolEntityResourceStore.syncFromProtocolMap(protocolMap);
      const previousState = useProtocolListComputedStore.getState();
      const previousResult = previousState.multiProtocolsIndexCache[key];
      const nextResult = computeMultiProtocolsIndex(
        protocolMap,
        addresses,
        chainServerId,
        previousResult,
      );
      set(state => ({
        multiProtocolsIndexCache: removeKeysFromCache(
          {
            ...state.multiProtocolsIndexCache,
            [key]: nextResult,
          },
          removedKeys,
        ),
        multiProtocolsAvailabilityByKey: removeKeysFromCache(
          {
            ...state.multiProtocolsAvailabilityByKey,
            [key]: getProtocolProjectionAvailability(
              multiProtocolsCacheParams.get(key),
              nextResult,
            ),
          },
          removedKeys,
        ),
      }));
      scheduleProtocolProjectionPersistence(key, 'multi-address', nextResult);
      if (!nextResult.protocolIds.length) {
        restoreProtocolProjectionIfEmpty(key, 'multi-address');
      }
      return key;
    },
    registerSingleProtocols(address, chainServerId) {
      const normalizedAddress = address.toLowerCase();
      const key = getSingleProtocolsCacheKey(normalizedAddress, chainServerId);
      const removedKeys = touchCacheParams(
        singleProtocolsCacheParams,
        singleProtocolsCacheOrder,
        key,
        {
          address: normalizedAddress,
          chainServerId,
        },
      );
      const protocolMap = useProtocolListStore.getState().protocolMap;
      protocolEntityResourceStore.syncFromProtocolMap(protocolMap);
      const previousState = useProtocolListComputedStore.getState();
      const previousResult = previousState.singleProtocolsIndexCache[key];
      const nextResult = computeSingleProtocolsIndex(
        protocolMap,
        address,
        chainServerId,
        previousResult,
      );
      set(state => ({
        singleProtocolsIndexCache: removeKeysFromCache(
          {
            ...state.singleProtocolsIndexCache,
            [key]: nextResult,
          },
          removedKeys,
        ),
        singleProtocolsAvailabilityByKey: removeKeysFromCache(
          {
            ...state.singleProtocolsAvailabilityByKey,
            [key]: getProtocolProjectionAvailability(
              singleProtocolsCacheParams.get(key),
              nextResult,
            ),
          },
          removedKeys,
        ),
      }));
      scheduleProtocolProjectionPersistence(key, 'single-address', nextResult);
      if (!nextResult.protocolIds.length) {
        restoreProtocolProjectionIfEmpty(key, 'single-address');
      }
      return key;
    },
  }),
);

const rebuildComputedCaches = (protocolMap: ProtocolListMap) => {
  if (multiProtocolsCacheParams.size || singleProtocolsCacheParams.size) {
    protocolEntityResourceStore.syncFromProtocolMap(protocolMap);
  }

  const previousComputedState = useProtocolListComputedStore.getState();
  const multiProtocolsIndexCache: Record<string, ProtocolAssetsIndexResult> =
    {};
  multiProtocolsCacheParams.forEach((params, key) => {
    multiProtocolsIndexCache[key] = computeMultiProtocolsIndex(
      protocolMap,
      params.addresses,
      params.chainServerId,
      previousComputedState.multiProtocolsIndexCache[key],
    );
  });

  const singleProtocolsIndexCache: Record<string, ProtocolAssetsIndexResult> =
    {};
  singleProtocolsCacheParams.forEach((params, key) => {
    singleProtocolsIndexCache[key] = computeSingleProtocolsIndex(
      protocolMap,
      params.address.toLowerCase(),
      params.chainServerId,
      previousComputedState.singleProtocolsIndexCache[key],
    );
  });

  useProtocolListComputedStore.setState({
    multiProtocolsIndexCache,
    singleProtocolsIndexCache,
    multiProtocolsAvailabilityByKey: Object.fromEntries(
      Object.entries(multiProtocolsIndexCache).map(([key, result]) => [
        key,
        getProtocolProjectionAvailability(
          multiProtocolsCacheParams.get(key),
          result,
        ),
      ]),
    ),
    singleProtocolsAvailabilityByKey: Object.fromEntries(
      Object.entries(singleProtocolsIndexCache).map(([key, result]) => [
        key,
        getProtocolProjectionAvailability(
          singleProtocolsCacheParams.get(key),
          result,
        ),
      ]),
    ),
  });
  Object.entries(multiProtocolsIndexCache).forEach(([key, result]) => {
    scheduleProtocolProjectionPersistence(key, 'multi-address', result);
    if (!result.protocolIds.length) {
      restoreProtocolProjectionIfEmpty(key, 'multi-address');
    }
  });
  Object.entries(singleProtocolsIndexCache).forEach(([key, result]) => {
    scheduleProtocolProjectionPersistence(key, 'single-address', result);
    if (!result.protocolIds.length) {
      restoreProtocolProjectionIfEmpty(key, 'single-address');
    }
  });
};

const refreshProtocolProjectionAvailability = () => {
  const state = useProtocolListComputedStore.getState();
  let multiProtocolsAvailabilityByKey = state.multiProtocolsAvailabilityByKey;
  let singleProtocolsAvailabilityByKey = state.singleProtocolsAvailabilityByKey;

  multiProtocolsCacheParams.forEach((params, key) => {
    const result = state.multiProtocolsIndexCache[key];
    if (!result) {
      return;
    }
    const availability = getProtocolProjectionAvailability(params, result);
    if (multiProtocolsAvailabilityByKey[key] !== availability) {
      if (
        multiProtocolsAvailabilityByKey ===
        state.multiProtocolsAvailabilityByKey
      ) {
        multiProtocolsAvailabilityByKey = {
          ...multiProtocolsAvailabilityByKey,
        };
      }
      multiProtocolsAvailabilityByKey[key] = availability;
    }
    scheduleProtocolProjectionPersistence(key, 'multi-address', result);
  });

  singleProtocolsCacheParams.forEach((params, key) => {
    const result = state.singleProtocolsIndexCache[key];
    if (!result) {
      return;
    }
    const availability = getProtocolProjectionAvailability(params, result);
    if (singleProtocolsAvailabilityByKey[key] !== availability) {
      if (
        singleProtocolsAvailabilityByKey ===
        state.singleProtocolsAvailabilityByKey
      ) {
        singleProtocolsAvailabilityByKey = {
          ...singleProtocolsAvailabilityByKey,
        };
      }
      singleProtocolsAvailabilityByKey[key] = availability;
    }
    scheduleProtocolProjectionPersistence(key, 'single-address', result);
  });

  if (
    multiProtocolsAvailabilityByKey !== state.multiProtocolsAvailabilityByKey ||
    singleProtocolsAvailabilityByKey !== state.singleProtocolsAvailabilityByKey
  ) {
    useProtocolListComputedStore.setState({
      multiProtocolsAvailabilityByKey,
      singleProtocolsAvailabilityByKey,
    });
  }
};

let latestProtocolMap = useProtocolListStore.getState().protocolMap;
let latestProtocolSourceSnapshotReadiness =
  useProtocolListStore.getState().sourceSnapshotReadyByAddress;
useProtocolListStore.subscribe(state => {
  const protocolMapChanged = state.protocolMap !== latestProtocolMap;
  const readinessChanged =
    state.sourceSnapshotReadyByAddress !==
    latestProtocolSourceSnapshotReadiness;
  if (!protocolMapChanged && !readinessChanged) {
    return;
  }
  latestProtocolMap = state.protocolMap;
  latestProtocolSourceSnapshotReadiness = state.sourceSnapshotReadyByAddress;
  if (protocolMapChanged) {
    rebuildComputedCaches(state.protocolMap);
    return;
  }
  refreshProtocolProjectionAvailability();
});

export default useProtocolListStore;
