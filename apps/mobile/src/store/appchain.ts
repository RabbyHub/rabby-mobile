import { openapi } from '@/core/request';
import { zCreate } from '@/core/utils/reexports';
import { AppChainEntity } from '@/databases/entities/appchain';
import {
  AppChainItem,
  PortfolioItem,
} from '@rabby-wallet/rabby-api/dist/types';
import PQueue from 'p-queue';
import { appChainResourceStore } from './appchainResource';

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
  getAppChains(
    address: string,
    force?: boolean,
  ): Promise<IAppChainItem[] | void>;
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
const persistAppChains = async (
  owner_addr: string,
  appChains: AppChainItem[],
): Promise<void> => {
  const syncTimestamp = Date.now();

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
};

export const useAppChainStore = zCreate<AppChainState>((set, get) => ({
  appChainMap: {},
  isLoading: false,
  isLoadingByAddress: {},

  async initStore() {
    try {
      // 从数据库加载缓存数据
      const allAppChains = await AppChainEntity.queryAll();

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
      Object.entries(appChainMap).forEach(([ownerAddr, value]) => {
        appChainResourceStore.hydrate(ownerAddr, value, {
          trigger: 'initStore',
        });
      });
    } catch (error) {
      console.error('Failed to init appchain store:', error);
    }
  },

  async batchGetAppChains(addresses, force = false) {
    const lowerAddresses = Array.from(
      new Set(addresses.map(item => item.toLowerCase())),
    );
    if (!lowerAddresses.length) {
      set({ appChainMap: {}, isLoadingByAddress: {} });
      return;
    }
    const cacheMap: AppChainListMap = {};
    const fetchList: string[] = [];
    const nextLoadingMap: Record<string, boolean> = {};

    // 检查缓存
    for (const address of lowerAddresses) {
      if (!force) {
        appChainResourceStore.markHydrateStartedFor(address, {
          trigger: 'batchGetAppChains',
          force,
        });
        const expired = await AppChainEntity.isExpired(address);
        if (!expired) {
          const cached = await AppChainEntity.queryByOwner(address);
          const value = cached.map(toAppChainItem);
          cacheMap[address] = value;
          appChainResourceStore.hydrate(address, value, {
            trigger: 'batchGetAppChains',
            force,
          });
          nextLoadingMap[address] = false;
          continue;
        }
        appChainResourceStore.markHydrateSkippedFor(address, {
          trigger: 'batchGetAppChains',
          force,
          reason: 'cache_expired_or_missing',
        });
      } else {
        appChainResourceStore.markHydrateSkippedFor(address, {
          trigger: 'batchGetAppChains',
          force,
          reason: 'force_refresh',
        });
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
          const requestId = appChainResourceStore.startRemoteFetchFor(address, {
            trigger: 'batchGetAppChains',
            force,
          });

          try {
            const { apps } = await openapi.getAppChainList(address);
            const appChains = apps ?? [];
            const value = appChains.map(toAppChainItem);
            appChainResourceStore.applyRemoteValueFor(
              address,
              requestId,
              value,
              {
                trigger: 'batchGetAppChains',
                force,
              },
            );
            await appChainResourceStore.persistInBackgroundFor(
              address,
              () => persistAppChains(address, appChains),
              {
                trigger: 'batchGetAppChains',
                force,
              },
            );
            return { address, appChains };
          } catch (error) {
            appChainResourceStore.markRemoteErrorFor(
              address,
              requestId,
              error,
              {
                trigger: 'batchGetAppChains',
                force,
              },
            );
            throw error;
          }
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
    let requestId: string | undefined;

    set(state => ({
      isLoadingByAddress: {
        ...state.isLoadingByAddress,
        [lowerAddress]: true,
      },
    }));

    try {
      // 检查缓存是否过期
      if (!force) {
        appChainResourceStore.markHydrateStartedFor(lowerAddress, {
          trigger: 'getAppChains',
          force,
        });
        const expired = await AppChainEntity.isExpired(lowerAddress);
        if (!expired) {
          const cached = await AppChainEntity.queryByOwner(lowerAddress);
          const value = cached.map(toAppChainItem);
          appChainResourceStore.hydrate(lowerAddress, value, {
            trigger: 'getAppChains',
            force,
          });
          set(state => ({
            appChainMap: {
              ...state.appChainMap,
              [lowerAddress]: value,
            },
          }));
          return value;
        }
        appChainResourceStore.markHydrateSkippedFor(lowerAddress, {
          trigger: 'getAppChains',
          force,
          reason: 'cache_expired_or_missing',
        });
      } else {
        appChainResourceStore.markHydrateSkippedFor(lowerAddress, {
          trigger: 'getAppChains',
          force,
          reason: 'force_refresh',
        });
      }

      // 请求数据
      requestId = appChainResourceStore.startRemoteFetchFor(lowerAddress, {
        trigger: 'getAppChains',
        force,
      });
      const { apps } = await openapi.getAppChainList(lowerAddress);
      const appChains = apps ?? [];

      const value = appChains.map(toAppChainItem);
      appChainResourceStore.applyRemoteValueFor(
        lowerAddress,
        requestId,
        value,
        {
          trigger: 'getAppChains',
          force,
        },
      );
      await appChainResourceStore.persistInBackgroundFor(
        lowerAddress,
        () => persistAppChains(lowerAddress, appChains),
        {
          trigger: 'getAppChains',
          force,
        },
      );
      // 更新 store
      set(state => ({
        appChainMap: {
          ...state.appChainMap,
          [lowerAddress]: value,
        },
      }));
      return value;
    } catch (error) {
      appChainResourceStore.markRemoteErrorFor(lowerAddress, requestId, error, {
        trigger: 'getAppChains',
        force,
      });
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
