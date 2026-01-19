import { PortfolioItem } from '@rabby-wallet/rabby-api/dist/types';
import { zCreate } from '@/core/utils/reexports';
import { ProtocolItemEntity } from '@/databases/entities/portocolItem';
import { syncProtocols, syncSpecificProtocol } from '@/databases/hooks/assets';
import { getTop10MyAccounts } from '@/core/apis/account';
import { protocolEntityToIProtocolItem } from '@/utils/protocol';

/**
 * interface for all DeFi data
 */
export interface IProtocolItem {
  id: string;
  name: string;
  logo?: string;
  chain?: string;
  netWorth: number;
  site_url?: string;
  owner_addr: string;

  // 仓位数组
  _portfolios: IProtocolPortfolio[];
}

export interface IProtocolPortfolio {
  id: string;
  name?: string;

  // 用于计算美元总价值、排序
  _sumTokenRealUsdValue: number;

  // 仓位summary信息
  netWorth: number;

  // 原始仓位详情
  _originPortfolio: PortfolioItem;
}

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

export type ICacheProtocolItem = {
  fold: IProtocolItem[];
  unFold: IProtocolItem[];
};
type ProtocolListComputedState = {
  multiProtocolsCache: Record<string, ICacheProtocolItem>;
  singleProtocolsCache: Record<string, ICacheProtocolItem>;
  registerMultiProtocols: (
    addresses: string[],
    chainServerId?: string,
  ) => string;
  registerSingleProtocols: (address: string, chainServerId?: string) => string;
};

const COMPUTED_CACHE_LIMIT = 10;

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

  const list = filtered.sort((a, b) => (b.netWorth || 0) - (a.netWorth || 0));

  const totalNetWorth = list.reduce(
    (acc, curr) => acc + (Number(curr?.netWorth) || 0),
    0,
  );
  const threshold = Math.min((totalNetWorth || 0) / 1000, 1000);
  const thresholdIndex = list
    ? list.findIndex(m => (Number(m?.netWorth) || 0) < threshold)
    : -1;
  const hasExpandSwitch =
    list.length >= 15 &&
    thresholdIndex > -1 &&
    thresholdIndex <= list.length - 4;

  const isFold = (p: IProtocolItem) => {
    if (hasExpandSwitch && (p?.netWorth || 0) < threshold) {
      return true;
    }
    return false;
  };
  return {
    fold: list.filter(isFold),
    unFold: list.filter(p => !isFold(p)),
  };
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

  const list = filtered.sort((a, b) => (b.netWorth || 0) - (a.netWorth || 0));

  const totalNetWorth = list.reduce(
    (acc, curr) => acc + (Number(curr?.netWorth) || 0),
    0,
  );
  const threshold = Math.min((totalNetWorth || 0) / 1000, 1000);
  const thresholdIndex = list
    ? list.findIndex(m => (Number(m?.netWorth) || 0) < threshold)
    : -1;
  const hasExpandSwitch =
    list.length >= 15 &&
    thresholdIndex > -1 &&
    thresholdIndex <= list.length - 4;

  const isFold = (p: IProtocolItem) => {
    if (hasExpandSwitch && (p?.netWorth || 0) < threshold) {
      return true;
    }
    return false;
  };
  return {
    fold: list.filter(isFold),
    unFold: list.filter(p => !isFold(p)),
  };
};

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

export const useProtocolListStore = zCreate<ProtocolListState>(set => ({
  protocolMap: {},
  isLoading: false,
  isLoadingByAddress: {},
  async initStore() {
    const { top10Addresses } = await getTop10MyAccounts(true);
    const protocolMap = await ProtocolItemEntity.getDefaultProtocolsByAddresses(
      top10Addresses,
    );
    // 写入 Store
    set(() => ({ protocolMap }));
  },
  async batchGetProtocols(addresses, force = false) {
    if (!addresses.length) {
      return;
    }

    if (!force) {
      const isExpired = await isDataExpiredBatch(addresses);
      if (!isExpired) {
        const cached = await ProtocolItemEntity.batchMultiAddressProtocols(
          addresses,
        );
        const res: Record<string, IProtocolItem[]> = {};
        cached?.forEach(item => {
          const owner = item.owner_addr.toLowerCase();
          const project = protocolEntityToIProtocolItem(item);
          if (!res[owner]) {
            res[owner] = [];
          }
          res[owner].push(project);
        });
        set(() => ({
          protocolMap: res,
        }));
        // cache击中，不用走下面流程了
        return;
      }
    }

    set(() => ({ isLoading: true }));
    try {
      const results = await Promise.all(
        addresses.map(address => syncProtocols(address, force)),
      );
      const realTimeResult: Record<string, IProtocolItem[]> = {};
      results.forEach((protocols, index) => {
        const address = addresses[index];
        if (!address) {
          return;
        }
        const lower = address.toLowerCase();
        realTimeResult[lower] = protocols;
      });
      set(() => ({ protocolMap: realTimeResult }));
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
          const cacheProtocols = await ProtocolItemEntity.batchQueryProtocols(
            address,
          );
          const protocols = cacheProtocols.map(protocolEntityToIProtocolItem);

          set(state => ({
            protocolMap: {
              ...state.protocolMap,
              [normalizedAddress]: protocols,
            },
          }));
          return;
        }
      }

      // 内部通过给db的非阻塞action，所以下面的同步store是先行的
      const protocols = await syncProtocols(address, force);
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
        address,
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
    multiProtocolsCache: {},
    singleProtocolsCache: {},
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
      set(state => ({
        multiProtocolsCache: removeKeysFromCache(
          {
            ...state.multiProtocolsCache,
            [key]: computeMultiProtocols(protocolMap, addresses, chainServerId),
          },
          removedKeys,
        ),
      }));
      return key;
    },
    registerSingleProtocols(address, chainServerId) {
      const key = getSingleProtocolsCacheKey(address, chainServerId);
      const removedKeys = touchCacheParams(
        singleProtocolsCacheParams,
        singleProtocolsCacheOrder,
        key,
        {
          address,
          chainServerId,
        },
      );
      const protocolMap = useProtocolListStore.getState().protocolMap;
      set(state => ({
        singleProtocolsCache: removeKeysFromCache(
          {
            ...state.singleProtocolsCache,
            [key]: computeSingleProtocols(protocolMap, address, chainServerId),
          },
          removedKeys,
        ),
      }));
      return key;
    },
  }),
);

const rebuildComputedCaches = (protocolMap: ProtocolListMap) => {
  const multiProtocolsCache: Record<string, ICacheProtocolItem> = {};
  multiProtocolsCacheParams.forEach((params, key) => {
    multiProtocolsCache[key] = computeMultiProtocols(
      protocolMap,
      params.addresses,
      params.chainServerId,
    );
  });

  const singleProtocolsCache: Record<string, ICacheProtocolItem> = {};
  singleProtocolsCacheParams.forEach((params, key) => {
    singleProtocolsCache[key] = computeSingleProtocols(
      protocolMap,
      params.address,
      params.chainServerId,
    );
  });

  useProtocolListComputedStore.setState({
    multiProtocolsCache,
    singleProtocolsCache,
  });
};

useProtocolListStore.subscribe(state => {
  rebuildComputedCaches(state.protocolMap);
});

export default useProtocolListStore;
