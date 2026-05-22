import { mCreate, zCreate } from '@/core/utils/reexports';
import { ProtocolItemEntity } from '@/databases/entities/portocolItem';
import { AppChainEntity } from '@/databases/entities/appchain';
import { syncProtocols, syncSpecificProtocol } from '@/databases/hooks/assets';
import { getTop10MyAccounts } from '@/core/apis/account';
import { formatAppChain } from '@/utils/appchain';
import { reportLendingUserStatusOnce } from '@/utils/lendingUserStatus';
import { complexProtocol2ProtocolItem } from '@/utils/protocol';
import type { ICacheProtocolItem, IProtocolItem } from '@/types/assets';
import { formatNetworth } from '@/utils/math';
import { ResourceBaseStore } from './_resourceBase';
import type { ObservableResourceValueSource } from './_resourceFlow';

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

export type ProtocolEntityId = string & {
  readonly __protocolEntityId: unique symbol;
};

export type ProtocolAssetsIndexResult = {
  foldIds: ProtocolEntityId[];
  unFoldIds: ProtocolEntityId[];
  foldDeFiValue: string;
};

const createEmptyProtocolAssetsIndexResult = (): ProtocolAssetsIndexResult => ({
  foldIds: [],
  unFoldIds: [],
  foldDeFiValue: '',
});

const normalizeAddresses = (addresses: string[]) =>
  addresses.map(address => address.toLowerCase());

const getAddressesKey = (addresses: string[]) =>
  normalizeAddresses(addresses).slice().sort().join('|');

export const getMultiProtocolsCacheKey = (
  addresses: string[],
  chainServerId?: string,
) => `${getAddressesKey(addresses)}::${chainServerId ?? ''}`;

export const getSingleProtocolsCacheKey = (
  address: string,
  chainServerId?: string,
) => `${address.toLowerCase()}::${chainServerId ?? ''}`;

export const buildProtocolEntityId = (
  protocol: Pick<IProtocolItem, 'owner_addr' | 'chain' | 'id'>,
): ProtocolEntityId =>
  [
    protocol.owner_addr.toLowerCase(),
    (protocol.chain || '').toLowerCase(),
    protocol.id.toLowerCase(),
  ].join(':') as ProtocolEntityId;

const getProtocolListFromProtocolMap = (protocolMap: ProtocolListMap) =>
  Object.values(protocolMap).flat();

class ProtocolEntityResourceStore extends ResourceBaseStore<IProtocolItem> {
  constructor() {
    super(PROTOCOL_ENTITY_RESOURCE_FAMILY);
  }

  upsertProtocols = (
    protocols: IProtocolItem[],
    source: ObservableResourceValueSource = 'remote',
  ) => {
    if (!protocols.length) {
      return;
    }

    const entries = new Map<ProtocolEntityId, IProtocolItem>();
    protocols.forEach(protocol => {
      entries.set(buildProtocolEntityId(protocol), protocol);
    });

    const now = Date.now();
    this.setState(prev => {
      let changed = false;
      const valueMap = { ...prev.valueMap };
      const metaMap = { ...prev.metaMap };

      entries.forEach((protocol, protocolId) => {
        const prevProtocol = prev.valueMap[protocolId];
        const prevMeta = prev.metaMap[protocolId];
        const isProtocolChanged = prevProtocol !== protocol;

        if (isProtocolChanged) {
          valueMap[protocolId] = protocol;
          changed = true;
        }

        if (!prevMeta || isProtocolChanged) {
          metaMap[protocolId] = {
            family: PROTOCOL_ENTITY_RESOURCE_FAMILY,
            resourceKey: protocolId,
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

  syncFromProtocolMap = (
    protocolMap: ProtocolListMap,
    source: ObservableResourceValueSource = 'remote',
  ) => {
    this.upsertProtocols(getProtocolListFromProtocolMap(protocolMap), source);
  };
}

export const protocolEntityResourceStore = new ProtocolEntityResourceStore();

export const useProtocolEntity = (protocolId?: ProtocolEntityId) =>
  protocolEntityResourceStore.useValue(protocolId);

const splitFoldAndUnfold = (list: IProtocolItem[]): ICacheProtocolItem => {
  const sortedList = [...list].sort(
    (a, b) => (b.netWorth || 0) - (a.netWorth || 0),
  );

  const totalNetWorth = sortedList.reduce(
    (acc, curr) => acc + (Number(curr?.netWorth) || 0),
    0,
  );
  const threshold = Math.min((totalNetWorth || 0) / 1000, 1000);
  const thresholdIndex = sortedList
    ? sortedList.findIndex(m => (Number(m?.netWorth) || 0) < threshold)
    : -1;
  const hasExpandSwitch =
    sortedList.length > 3 &&
    thresholdIndex > -1 &&
    thresholdIndex <= sortedList.length - 4;

  const isFold = (p: IProtocolItem) => {
    if (hasExpandSwitch && (p?.netWorth || 0) < threshold) {
      return true;
    }
    return false;
  };
  return {
    fold: sortedList.filter(isFold),
    unFold: sortedList.filter(p => !isFold(p)),
  };
};

const computeSingleProtocols = (
  protocolMap: ProtocolListMap,
  address: string,
  chainServerId?: string,
): ICacheProtocolItem => {
  if (!address) {
    return {
      fold: [],
      unFold: [],
    };
  }

  const normalizedAddress = address.toLowerCase();
  const projects = protocolMap[normalizedAddress] || [];

  const filtered = chainServerId
    ? projects.filter(p => p.chain === chainServerId)
    : projects;

  return splitFoldAndUnfold(filtered);
};

const computeMultiProtocols = (
  protocolMap: ProtocolListMap,
  addresses: string[],
  chainServerId?: string,
): ICacheProtocolItem => {
  if (!addresses.length) {
    return {
      fold: [],
      unFold: [],
    };
  }

  const normalizedAddresses = normalizeAddresses(addresses);
  const projects = normalizedAddresses.flatMap(
    address => protocolMap[address] || [],
  );

  const filtered = chainServerId
    ? projects.filter(p => p.chain === chainServerId)
    : projects;

  return splitFoldAndUnfold(filtered);
};

const getAllProtocolCount = (protocols: IProtocolItem[]) => {
  let total = 0;
  protocols?.forEach(protocol => {
    total +=
      protocol._portfolios?.reduce((sum, item) => {
        return (
          sum +
          (item._sumTokenRealUsdValue < 0 ? 0 : item._sumTokenRealUsdValue || 0)
        );
      }, 0) || 0;
  });
  return formatNetworth(total, false, '$');
};

const buildProtocolAssetsIndexResult = (
  result: ICacheProtocolItem,
): ProtocolAssetsIndexResult => {
  const protocols = [...result.unFold, ...result.fold];
  protocolEntityResourceStore.upsertProtocols(protocols);

  return {
    unFoldIds: result.unFold.map(buildProtocolEntityId),
    foldIds: result.fold.map(buildProtocolEntityId),
    foldDeFiValue: getAllProtocolCount(result.fold),
  };
};

const computeSingleProtocolsIndex = (
  protocolMap: ProtocolListMap,
  address: string,
  chainServerId?: string,
): ProtocolAssetsIndexResult => {
  if (!address) {
    return createEmptyProtocolAssetsIndexResult();
  }
  return buildProtocolAssetsIndexResult(
    computeSingleProtocols(protocolMap, address, chainServerId),
  );
};

const computeMultiProtocolsIndex = (
  protocolMap: ProtocolListMap,
  addresses: string[],
  chainServerId?: string,
): ProtocolAssetsIndexResult => {
  if (!addresses.length) {
    return createEmptyProtocolAssetsIndexResult();
  }
  return buildProtocolAssetsIndexResult(
    computeMultiProtocols(protocolMap, addresses, chainServerId),
  );
};

const multiProtocolsIndexCacheParams = new Map<
  string,
  {
    addresses: string[];
    chainServerId?: string;
  }
>();

const singleProtocolsIndexCacheParams = new Map<
  string,
  {
    address: string;
    chainServerId?: string;
  }
>();

const multiProtocolsIndexCacheOrder: string[] = [];
const singleProtocolsIndexCacheOrder: string[] = [];

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

export const useProtocolListStore = zCreate<ProtocolListState>(set => ({
  protocolMap: {},
  isLoading: false,
  isLoadingByAddress: {},
  async initStore() {
    const { top10Addresses } = await getTop10MyAccounts(true);
    const [protocolMap, appChainMap] = await Promise.all([
      ProtocolItemEntity.getDefaultProtocolsByAddresses(top10Addresses),
      buildAppChainProtocolMap(top10Addresses),
    ]);
    // 写入 Store
    set(() => ({
      protocolMap: mergeProtocolMaps(protocolMap, appChainMap),
    }));
  },
  async batchGetProtocols(addresses, force = false) {
    if (!addresses.length) {
      return;
    }
    const lowerAddresses = Array.from(
      new Set(addresses.map(item => item.toLowerCase())),
    );

    if (!force) {
      const isExpired = await isDataExpiredBatch(lowerAddresses);
      if (!isExpired) {
        const [protocolMap, appChainMap] = await Promise.all([
          ProtocolItemEntity.getDefaultProtocolsByAddresses(lowerAddresses),
          buildAppChainProtocolMap(lowerAddresses),
        ]);
        set(() => ({
          protocolMap: mergeProtocolMaps(protocolMap, appChainMap),
        }));
        reportLendingUserStatusOnce({
          addresses: lowerAddresses,
          protocolMap,
        });
        // cache击中，不用走下面流程了
        return;
      }
    }

    set(() => ({ isLoading: true }));
    try {
      const results = await Promise.all(
        lowerAddresses.map(address => syncProtocols(address, force)),
      );
      const resultMap: Record<string, IProtocolItem[]> = {};
      results.forEach((protocols, index) => {
        const address = lowerAddresses[index];
        if (!address) {
          return;
        }
        const lower = address.toLowerCase();
        resultMap[lower] = protocols;
      });
      set(() => ({ protocolMap: resultMap }));
      reportLendingUserStatusOnce({
        addresses: lowerAddresses,
        protocolMap: resultMap,
      });
    } finally {
      set(() => ({ isLoading: false }));
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
        multiProtocolsIndexCacheParams,
        multiProtocolsIndexCacheOrder,
        key,
        {
          addresses,
          chainServerId,
        },
      );
      const protocolMap = useProtocolListStore.getState().protocolMap;
      protocolEntityResourceStore.syncFromProtocolMap(protocolMap);
      set(state => ({
        multiProtocolsIndexCache: upsertRecordCache(
          state.multiProtocolsIndexCache,
          key,
          computeMultiProtocolsIndex(protocolMap, addresses, chainServerId),
          removedKeys,
        ),
      }));
      return key;
    },
    registerSingleProtocols(address, chainServerId) {
      const normalizedAddress = address.toLowerCase();
      const key = getSingleProtocolsCacheKey(normalizedAddress, chainServerId);
      const removedKeys = touchCacheParams(
        singleProtocolsIndexCacheParams,
        singleProtocolsIndexCacheOrder,
        key,
        {
          address: normalizedAddress,
          chainServerId,
        },
      );
      const protocolMap = useProtocolListStore.getState().protocolMap;
      protocolEntityResourceStore.syncFromProtocolMap(protocolMap);
      set(state => ({
        singleProtocolsIndexCache: upsertRecordCache(
          state.singleProtocolsIndexCache,
          key,
          computeSingleProtocolsIndex(protocolMap, address, chainServerId),
          removedKeys,
        ),
      }));
      return key;
    },
  }),
);

const rebuildComputedCaches = (protocolMap: ProtocolListMap) => {
  protocolEntityResourceStore.syncFromProtocolMap(protocolMap);

  const multiProtocolsIndexCache: Record<string, ProtocolAssetsIndexResult> =
    {};
  multiProtocolsIndexCacheParams.forEach((params, key) => {
    multiProtocolsIndexCache[key] = computeMultiProtocolsIndex(
      protocolMap,
      params.addresses,
      params.chainServerId,
    );
  });

  const singleProtocolsIndexCache: Record<string, ProtocolAssetsIndexResult> =
    {};
  singleProtocolsIndexCacheParams.forEach((params, key) => {
    singleProtocolsIndexCache[key] = computeSingleProtocolsIndex(
      protocolMap,
      params.address.toLowerCase(),
      params.chainServerId,
    );
  });

  useProtocolListComputedStore.setState({
    multiProtocolsIndexCache,
    singleProtocolsIndexCache,
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
