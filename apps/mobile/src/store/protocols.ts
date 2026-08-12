import { zCreate } from '@/core/utils/reexports';
import { ProtocolItemEntity } from '@/databases/entities/portocolItem';
import { AppChainEntity } from '@/databases/entities/appchain';
import {
  syncProtocols,
  syncProtocolsForAddresses,
  syncSpecificProtocol,
} from '@/databases/hooks/assets';
import { formatAppChain } from '@/utils/appchain';
import { reportLendingUserStatusOnce } from '@/utils/lendingUserStatus';
import { complexProtocol2ProtocolItem } from '@/utils/protocol';
import type { ICacheProtocolItem, IProtocolItem } from '@/types/assets';
import { markStartupPerf } from '@/core/utils/startupPerfMarks';
import { getSelectedBalanceAddressesSnapshot } from './balance';
import { ResourceBaseStore } from './_resourceBase';
import type { ObservableResourceValueSource } from './_resourceFlow';
import { beginAssetDataLoadDiagnostic } from '@/core/utils/assetDataLoadDiagnostics';
import { LatestAsyncRequest } from '@/core/utils/latestAsyncRequest';
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
  restoreAssetProjection,
  scheduleAssetProjectionPersistence,
} from './assetProjectionPersistence';

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
  registerMultiProtocols: (
    addresses: string[],
    chainServerId?: string,
  ) => string;
  registerSingleProtocols: (address: string, chainServerId?: string) => string;
};

const COMPUTED_CACHE_LIMIT = 10;
const PROTOCOL_ENTITY_RESOURCE_FAMILY = 'protocol.entity';
const multiAddressProtocolRequests = new LatestAsyncRequest();

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

const sortProtocols = (list: IProtocolItem[]): ICacheProtocolItem =>
  list.slice().sort((a, b) => (b.netWorth || 0) - (a.netWorth || 0));

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

  return sortProtocols(filtered);
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

  return sortProtocols(filtered);
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

const scheduleProtocolProjectionPersistence = (
  key: string,
  scene: ProtocolProjectionScene,
  result: ProtocolAssetsIndexResult,
) => {
  const params =
    scene === 'single-address'
      ? singleProtocolsCacheParams.get(key)
      : multiProtocolsCacheParams.get(key);
  const addresses = params
    ? 'address' in params
      ? [params.address]
      : params.addresses
    : [];
  const sourceMap = useProtocolListStore.getState().protocolMap;
  const isSourceSnapshotReady =
    addresses.length > 0 &&
    addresses.every(address =>
      Object.prototype.hasOwnProperty.call(sourceMap, address.toLowerCase()),
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
  });
};

const protocolProjectionRestoreRequests = new Map<string, Promise<void>>();

const restoreProtocolProjectionIfEmpty = (
  key: string,
  scene: ProtocolProjectionScene,
) => {
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

  const request = (async () => {
    const restored = await restoreAssetProjection({
      runtimeKey: key,
      kind: 'protocol',
      scene,
    });
    if (!restored) {
      return;
    }
    const requiredProtocolIds = new Set<ProtocolEntityId>();
    for (const row of restored.rows) {
      if (row.type !== 'protocol') {
        return;
      }
      requiredProtocolIds.add(row.id as ProtocolEntityId);
    }

    if (requiredProtocolIds.size) {
      const cachedProtocolMap = await loadProtocolSnapshots(addresses);
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
        return;
      }
      const missingProtocols = getProtocolListFromProtocolMap(
        cachedProtocolMap,
      ).filter(protocol => {
        const protocolId = buildProtocolEntityId(protocol);
        return (
          requiredProtocolIds.has(protocolId) &&
          !protocolEntityResourceStore.getValue(protocolId)
        );
      });
      protocolEntityResourceStore.upsertProtocols(missingProtocols, 'hydrate');
    }

    const protocolIds: ProtocolEntityId[] = [];
    for (const row of restored.rows) {
      if (row.type !== 'protocol') {
        return;
      }
      const protocolId = row.id as ProtocolEntityId;
      if (!protocolEntityResourceStore.getValue(protocolId)) {
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
      return;
    }

    const result = { protocolIds };
    useProtocolListComputedStore.setState(current =>
      scene === 'single-address'
        ? {
            singleProtocolsIndexCache: {
              ...current.singleProtocolsIndexCache,
              [key]: result,
            },
          }
        : {
            multiProtocolsIndexCache: {
              ...current.multiProtocolsIndexCache,
              [key]: result,
            },
          },
    );
  })()
    .catch(error => {
      console.error('[protocolProjection] restore failed', error);
    })
    .finally(() => {
      protocolProjectionRestoreRequests.delete(requestKey);
    });
  protocolProjectionRestoreRequests.set(requestKey, request);
};

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

const isDataExpiredBatch = async (addresses: string[]) => {
  const res = await Promise.all(addresses.map(isDataExpired));
  return res.some(item => !!item);
};

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
    const requestId = multiAddressProtocolRequests.next();
    const isCurrentRequest = () =>
      multiAddressProtocolRequests.isCurrent(requestId);
    if (!addresses.length) {
      set(() => ({ isLoading: true }));
      await new Promise(resolve => setTimeout(resolve, 0));
      if (isCurrentRequest()) {
        set(() => ({ protocolMap: {}, isLoading: false }));
      }
      return;
    }
    const lowerAddresses = Array.from(
      new Set(addresses.map(item => item.toLowerCase())),
    );
    const trace = beginAssetDataLoadDiagnostic(
      'multi-address-protocol',
      lowerAddresses.join('|'),
      {
        addressCount: lowerAddresses.length,
        force,
      },
    );

    try {
      if (!force) {
        const isExpired = await isDataExpiredBatch(lowerAddresses);
        trace.mark('expiry-resolved', { isExpired });
        if (!isCurrentRequest()) {
          trace.finish({ path: 'stale-before-hydrate' });
          return;
        }
        if (!isExpired) {
          await protocolCacheHydrator.hydrate(lowerAddresses);
          const protocolMap = get().protocolMap;
          trace.mark('local-db-loaded', {
            itemCount: lowerAddresses.reduce(
              (count, address) => count + (protocolMap[address]?.length || 0),
              0,
            ),
          });
          if (!isCurrentRequest()) {
            trace.finish({ path: 'stale-after-hydrate' });
            return;
          }
          set(() => ({ isLoading: false }));
          reportLendingUserStatusOnce({
            addresses: lowerAddresses,
            protocolMap,
          });
          trace.finish({ path: 'local-db' });
          return;
        }
      }

      if (isCurrentRequest()) {
        set(() => ({ isLoading: true }));
      }

      const remoteProtocolsPromise = syncProtocolsForAddresses(
        lowerAddresses,
        force,
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

      const remoteProtocols = await remoteProtocolsPromise;
      if (remoteProtocols.status === 'rejected') {
        throw remoteProtocols.error;
      }
      const resultMap = remoteProtocols.result;
      trace.mark('remote-response-completed', {
        itemCount: Object.values(resultMap).reduce(
          (count, protocols) => count + protocols.length,
          0,
        ),
      });
      if (!isCurrentRequest()) {
        trace.finish({ path: 'stale-after-remote' });
        return;
      }
      const nextProtocolMap = mergeAddressListSnapshots(
        get().protocolMap,
        lowerAddresses,
        resultMap,
      );
      protocolEntityResourceStore.syncFromProtocolMap(
        nextProtocolMap,
        'remote',
      );
      protocolCacheHydrator.invalidate(lowerAddresses);
      set(() => ({ protocolMap: nextProtocolMap }));
      reportLendingUserStatusOnce({
        addresses: lowerAddresses,
        protocolMap: resultMap,
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
  async getProtocols(address, force = false) {
    if (!address) {
      return;
    }

    const normalizedAddress = address.toLowerCase();

    set(state => ({
      isLoadingByAddress: {
        ...state.isLoadingByAddress,
        [normalizedAddress]: true,
      },
    }));

    try {
      if (!force) {
        const isExpired = await isDataExpired(normalizedAddress);
        if (!isExpired) {
          const [cacheProtocols, appChainProtocols] = await Promise.all([
            ProtocolItemEntity.batchQueryProtocols(normalizedAddress),
            buildAppChainProtocolMap([normalizedAddress]),
          ]);
          set(state => ({
            protocolMap: {
              ...state.protocolMap,
              [normalizedAddress]: [
                ...cacheProtocols,
                ...(appChainProtocols[normalizedAddress] || []),
              ],
            },
          }));
          return;
        }
      }

      // 内部通过给db的非阻塞action，所以下面的同步store是先行的
      const protocols = await syncProtocols(normalizedAddress, force);
      set(state => ({
        protocolMap: {
          ...state.protocolMap,
          [normalizedAddress]: protocols,
        },
      }));
    } finally {
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

let latestProtocolMap = useProtocolListStore.getState().protocolMap;
useProtocolListStore.subscribe(state => {
  if (state.protocolMap === latestProtocolMap) {
    return;
  }
  latestProtocolMap = state.protocolMap;
  rebuildComputedCaches(state.protocolMap);
});

export default useProtocolListStore;
