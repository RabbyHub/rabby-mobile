import { openapi } from '@/core/request';
import { zCreate } from '@/core/utils/reexports';
import { AppChainEntity } from '@/databases/entities/appchain';
import {
  AppChainItem,
  PortfolioItem,
} from '@rabby-wallet/rabby-api/dist/types';
import PQueue from 'p-queue';

/**
 * 用于展示的 AppChain 数据结构
 */
export interface IAppChainItem {
  id: string;
  name: string;
  site_url: string;
  logo_url: string;
  is_support_portfolio: boolean;
  is_visible: boolean;
  portfolio_item_list: PortfolioItem[];
  // 计算的总价值
  netWorth: number;
}

type AppChainListMap = Record<string, IAppChainItem[]>;

interface AppChainState {
  appChainMap: AppChainListMap;
  isLoading: boolean;
  isLoadingByAddress: Record<string, boolean>;

  initStore(): Promise<void>;
  batchGetAppChains(addresses: string[], force?: boolean): Promise<void>;
  getAppChains(address: string, force?: boolean): Promise<void>;
  getAppChainTotalUsdValue(address: string): number;
  getMultiAddressAppChainTotalUsdValue(addresses: string[]): number;
}

const getAppChainQueue = new PQueue({
  interval: 1000,
  intervalCap: 10,
});

/**
 * 将 AppChainItem 转换为 IAppChainItem
 */
const toAppChainItem = (item: AppChainItem): IAppChainItem => {
  const netWorth = (item.portfolio_item_list ?? []).reduce((acc, portfolio) => {
    return acc + (portfolio.stats?.net_usd_value ?? 0);
  }, 0);

  return {
    id: item.id,
    name: item.name,
    site_url: item.site_url,
    logo_url: item.logo_url,
    is_support_portfolio: item.is_support_portfolio,
    is_visible: item.is_visible,
    portfolio_item_list: item.portfolio_item_list ?? [],
    netWorth,
  };
};

/**
 * 同步 AppChain 数据到数据库
 * 从接口获取数据后，更新数据库
 */
const syncAppChains = async (
  owner_addr: string,
  appChains: AppChainItem[],
): Promise<void> => {
  const syncTimestamp = Date.now();

  try {
    // 批量保存
    const entities = appChains.map(item => {
      const entity = new AppChainEntity();
      AppChainEntity.fillEntity(entity, owner_addr.toLowerCase(), item);
      return entity;
    });

    if (entities.length > 0) {
      await AppChainEntity.getRepository().save(entities);
    }

    // 清理过期数据（在本次同步之前更新的数据）
    await AppChainEntity.cleanupStaleAppChains(
      owner_addr.toLowerCase(),
      syncTimestamp,
    );
  } catch (error) {
    console.error(`Failed to sync appchains for ${owner_addr}:`, error);
  }
};

export const useAppChainStore = zCreate<AppChainState>((set, get) => ({
  appChainMap: {},
  isLoading: false,
  isLoadingByAddress: {},

  async initStore() {
    try {
      // 从数据库加载缓存数据
      const allAppChains = await AppChainEntity.getRepository().find({
        order: { usd_value: 'DESC' },
      });

      const appChainMap: AppChainListMap = {};
      for (const entity of allAppChains) {
        const lowerAddr = entity.owner_addr.toLowerCase();
        if (!appChainMap[lowerAddr]) {
          appChainMap[lowerAddr] = [];
        }
        appChainMap[lowerAddr].push({
          id: entity.id,
          name: entity.name,
          site_url: entity.site_url,
          logo_url: entity.logo_url,
          is_support_portfolio: entity.is_support_portfolio,
          is_visible: entity.is_visible,
          portfolio_item_list: entity.portfolio_item_list,
          netWorth: entity.usd_value,
        });
      }

      set({ appChainMap });
    } catch (error) {
      console.error('Failed to init appchain store:', error);
    }
  },

  async batchGetAppChains(addresses, force = false) {
    if (!addresses.length) {
      set({ appChainMap: {}, isLoadingByAddress: {} });
      return;
    }

    const normalizedAddresses = addresses.map(addr => addr.toLowerCase());
    const cacheMap: AppChainListMap = {};
    const fetchList: string[] = [];
    const nextLoadingMap: Record<string, boolean> = {};

    // 检查缓存
    for (const address of normalizedAddresses) {
      if (!force) {
        const expired = await AppChainEntity.isExpired(address);
        if (!expired) {
          const cached = await AppChainEntity.queryByOwner(address);
          cacheMap[address] = cached.map(toAppChainItem);
          nextLoadingMap[address] = false;
          continue;
        }
      }
      nextLoadingMap[address] = true;
      fetchList.push(address);
    }

    // 先设置缓存数据和加载状态
    set(state => ({
      appChainMap: {
        ...state.appChainMap,
        ...cacheMap,
      },
      isLoadingByAddress: {
        ...state.isLoadingByAddress,
        ...nextLoadingMap,
      },
    }));

    if (!fetchList.length) {
      return;
    }

    // 并发请求
    const results = await Promise.allSettled(
      fetchList.map(address =>
        getAppChainQueue.add<{
          address: string;
          appChains: AppChainItem[];
        }>(async () => {
          const { apps } = await openapi.getAppChainList(address);
          // 同步到数据库
          await syncAppChains(address, apps ?? []);
          return { address, appChains: apps ?? [] };
        }),
      ),
    );

    // 处理结果
    const latestMap: AppChainListMap = {};
    const finishedLoadingMap: Record<string, boolean> = {};

    results.forEach(result => {
      if (result.status !== 'fulfilled' || !result.value) {
        return;
      }
      const { address, appChains } = result.value;
      latestMap[address] = appChains.map(toAppChainItem);
    });

    fetchList.forEach(address => {
      finishedLoadingMap[address] = false;
    });

    set(state => ({
      appChainMap: {
        ...state.appChainMap,
        ...latestMap,
      },
      isLoadingByAddress: {
        ...state.isLoadingByAddress,
        ...finishedLoadingMap,
      },
    }));
  },

  async getAppChains(address, force = false) {
    if (!address) {
      return;
    }

    const lowerAddress = address.toLowerCase();

    set(state => ({
      isLoadingByAddress: {
        ...state.isLoadingByAddress,
        [lowerAddress]: true,
      },
    }));

    try {
      // 检查缓存是否过期
      if (!force) {
        const expired = await AppChainEntity.isExpired(lowerAddress);
        if (!expired) {
          const cached = await AppChainEntity.queryByOwner(lowerAddress);
          set(state => ({
            appChainMap: {
              ...state.appChainMap,
              [lowerAddress]: cached.map(toAppChainItem),
            },
          }));
          return;
        }
      }

      // 请求数据
      const { apps } = await openapi.getAppChainList(lowerAddress);
      const appChains = apps ?? [];

      // 同步到数据库
      await syncAppChains(lowerAddress, appChains);

      // 更新 store
      set(state => ({
        appChainMap: {
          ...state.appChainMap,
          [lowerAddress]: appChains.map(toAppChainItem),
        },
      }));
    } catch (error) {
      console.error(`Failed to get appchains for ${address}:`, error);
    } finally {
      set(state => ({
        isLoadingByAddress: {
          ...state.isLoadingByAddress,
          [lowerAddress]: false,
        },
      }));
    }
  },

  getAppChainTotalUsdValue(address) {
    const lowerAddress = address.toLowerCase();
    const appChains = get().appChainMap[lowerAddress] ?? [];
    return appChains.reduce((acc, item) => acc + item.netWorth, 0);
  },

  getMultiAddressAppChainTotalUsdValue(addresses) {
    const { appChainMap } = get();
    return addresses.reduce((total, address) => {
      const lowerAddress = address.toLowerCase();
      const appChains = appChainMap[lowerAddress] ?? [];
      const addressTotal = appChains.reduce(
        (acc, item) => acc + item.netWorth,
        0,
      );
      return total + addressTotal;
    }, 0);
  },
}));

export default useAppChainStore;
