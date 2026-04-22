import { openapi } from '@/core/request';
import { zCreate } from '@/core/utils/reexports';
import { ORM_TABLE_NAMES } from '@/databases/constant';
import { AppChainEntity } from '@/databases/entities/appchain';
import {
  AppChainItem,
  PortfolioItem,
} from '@rabby-wallet/rabby-api/dist/types';
import PQueue from 'p-queue';
import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { ResourceBaseStore } from './_resourceBase';
import type { ResourceLocalTarget } from './_resourceFlowDebug';

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

type AppChainResourceDetail = {
  trigger: 'initStore' | 'batchGetAppChains' | 'getAppChains';
  force?: boolean;
  reason?: string;
  count?: number;
  chainId?: string;
};

const APPCHAIN_RESOURCE_KEY_SEPARATOR = '::';

const createAppChainLocalTargets = (
  ownerAddr: string,
  chainId: string,
): ResourceLocalTarget[] => [
  {
    kind: 'sqlite',
    table: ORM_TABLE_NAMES.cache_appchain,
    where: {
      owner_addr: ownerAddr.toLowerCase(),
      id: chainId,
    },
  },
];

const normalizeOwnerAddresses = (ownerAddrs: string[]) =>
  Array.from(
    new Set(
      ownerAddrs
        .map(ownerAddr => ownerAddr?.toLowerCase())
        .filter((ownerAddr): ownerAddr is string => !!ownerAddr),
    ),
  );

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

class AppChainResourceStore extends ResourceBaseStore<IAppChainItem> {
  private readonly ownerResourceKeys = new Map<string, Set<string>>();
  private remoteRequestSequence = 0;

  constructor() {
    super('appchain');
  }

  private getOwnerKey(ownerAddr: string) {
    return ownerAddr.toLowerCase();
  }

  private getResourceKey(ownerAddr: string, chainId: string) {
    return [this.getOwnerKey(ownerAddr), chainId].join(
      APPCHAIN_RESOURCE_KEY_SEPARATOR,
    );
  }

  private getOwnerResourceKeyPrefix(ownerAddr: string) {
    return `${this.getOwnerKey(ownerAddr)}${APPCHAIN_RESOURCE_KEY_SEPARATOR}`;
  }

  private parseResourceKey(resourceKey: string) {
    const [ownerAddr, ...chainIdParts] = resourceKey.split(
      APPCHAIN_RESOURCE_KEY_SEPARATOR,
    );

    return {
      ownerAddr,
      chainId: chainIdParts.join(APPCHAIN_RESOURCE_KEY_SEPARATOR),
    };
  }

  private createRemoteRequestId(ownerAddr: string) {
    this.remoteRequestSequence += 1;
    return `appchain:${this.getOwnerKey(ownerAddr)}:remote:${
      this.remoteRequestSequence
    }`;
  }

  private getKnownResourceKeys(ownerAddr: string) {
    return Array.from(
      this.ownerResourceKeys.get(this.getOwnerKey(ownerAddr)) || [],
    );
  }

  getKnownOwnerAddresses() {
    return Array.from(this.ownerResourceKeys.keys()).sort();
  }

  getAddressAppChains(ownerAddr?: string) {
    if (!ownerAddr) {
      return [];
    }

    return this.getKnownResourceKeys(ownerAddr)
      .map(resourceKey => this.getValue(resourceKey))
      .filter((value): value is IAppChainItem => !!value);
  }

  getAddressesAppChains(ownerAddrs: string[]) {
    return normalizeOwnerAddresses(ownerAddrs).reduce((acc, ownerAddr) => {
      acc[ownerAddr] = this.getAddressAppChains(ownerAddr);
      return acc;
    }, {} as Record<string, IAppChainItem[]>);
  }

  getAppChainMap(ownerAddrs?: string[]) {
    const normalizedOwnerAddrs = ownerAddrs?.length
      ? normalizeOwnerAddresses(ownerAddrs)
      : this.getKnownOwnerAddresses();

    return normalizedOwnerAddrs.reduce((acc, ownerAddr) => {
      acc[ownerAddr] = this.getAddressAppChains(ownerAddr);
      return acc;
    }, {} as Record<string, IAppChainItem[]>);
  }

  getAppChainTotalUsdValue(ownerAddr?: string) {
    return this.getAddressAppChains(ownerAddr).reduce(
      (acc, item) => acc + item.netWorth,
      0,
    );
  }

  getMultiAddressAppChainTotalUsdValue(ownerAddrs: string[]) {
    return normalizeOwnerAddresses(ownerAddrs).reduce((acc, ownerAddr) => {
      return acc + this.getAppChainTotalUsdValue(ownerAddr);
    }, 0);
  }

  useAddressesAppChains = (ownerAddrs: string[]) => {
    const normalizedOwnerAddrs = useMemo(
      () => normalizeOwnerAddresses(ownerAddrs),
      [ownerAddrs],
    );

    const resourceKeys = this.useStore(
      useShallow(state => {
        if (!normalizedOwnerAddrs.length) {
          return [];
        }

        const prefixes = normalizedOwnerAddrs.map(ownerAddr =>
          this.getOwnerResourceKeyPrefix(ownerAddr),
        );

        return Object.keys(state.metaMap)
          .filter(resourceKey =>
            prefixes.some(prefix => resourceKey.startsWith(prefix)),
          )
          .sort();
      }),
    );

    const snapshots = this.useSnapshots(resourceKeys);

    return useMemo(() => {
      const appChainsByAddress = normalizedOwnerAddrs.reduce(
        (acc, ownerAddr) => {
          acc[ownerAddr] = [];
          return acc;
        },
        {} as Record<string, IAppChainItem[]>,
      );

      snapshots.forEach(snapshot => {
        if (!snapshot.value) {
          return;
        }

        const { ownerAddr } = this.parseResourceKey(snapshot.resourceKey);
        if (!appChainsByAddress[ownerAddr]) {
          appChainsByAddress[ownerAddr] = [];
        }
        appChainsByAddress[ownerAddr].push(snapshot.value);
      });

      return appChainsByAddress;
    }, [normalizedOwnerAddrs, snapshots]);
  };

  useAddressAppChains = (ownerAddr?: string) => {
    const appChainsByAddress = this.useAddressesAppChains(
      ownerAddr ? [ownerAddr] : [],
    );

    return useMemo(() => {
      if (!ownerAddr) {
        return [];
      }

      return appChainsByAddress[this.getOwnerKey(ownerAddr)] || [];
    }, [appChainsByAddress, ownerAddr]);
  };

  private replaceOwnerResourceKeys(ownerAddr: string, resourceKeys: string[]) {
    const ownerKey = this.getOwnerKey(ownerAddr);

    if (!resourceKeys.length) {
      this.ownerResourceKeys.delete(ownerKey);
      return;
    }

    this.ownerResourceKeys.set(ownerKey, new Set(resourceKeys));
  }

  private getLifecycleOptionsByResourceKey(
    resourceKey: string,
    detail: AppChainResourceDetail,
    requestId?: string,
  ) {
    const { ownerAddr, chainId } = this.parseResourceKey(resourceKey);

    return {
      requestId,
      detail: {
        ...detail,
        chainId,
      },
      localTargets: createAppChainLocalTargets(ownerAddr, chainId),
    };
  }

  private syncOwnerResources(
    ownerAddr: string,
    appChains: IAppChainItem[],
    detail: AppChainResourceDetail,
    syncItem: (resourceKey: string, appChain: IAppChainItem) => void,
  ) {
    const nextResourceKeys = new Set<string>();

    appChains.forEach(appChain => {
      const resourceKey = this.getResourceKey(ownerAddr, appChain.id);
      nextResourceKeys.add(resourceKey);
      syncItem(resourceKey, appChain);
    });

    this.getKnownResourceKeys(ownerAddr).forEach(resourceKey => {
      if (nextResourceKeys.has(resourceKey)) {
        return;
      }

      this.removeResource(
        resourceKey,
        this.getLifecycleOptionsByResourceKey(resourceKey, {
          ...detail,
          reason: 'removed_from_latest_snapshot',
        }),
      );
    });

    this.replaceOwnerResourceKeys(ownerAddr, Array.from(nextResourceKeys));
  }

  hydrate(
    ownerAddr: string,
    value: IAppChainItem[],
    detail: AppChainResourceDetail,
  ) {
    this.syncOwnerResources(
      ownerAddr,
      value,
      detail,
      (resourceKey, appChain) => {
        this.applyHydratedValue(
          resourceKey,
          appChain,
          this.getLifecycleOptionsByResourceKey(resourceKey, {
            ...detail,
            count: value.length,
          }),
        );
      },
    );
  }

  markHydrateStartedFor(ownerAddr: string, detail: AppChainResourceDetail) {
    this.getKnownResourceKeys(ownerAddr).forEach(resourceKey => {
      this.markHydrateStarted(
        resourceKey,
        this.getLifecycleOptionsByResourceKey(resourceKey, detail),
      );
    });
  }

  markHydrateSkippedFor(ownerAddr: string, detail: AppChainResourceDetail) {
    this.getKnownResourceKeys(ownerAddr).forEach(resourceKey => {
      this.markHydrateSkipped(
        resourceKey,
        this.getLifecycleOptionsByResourceKey(resourceKey, detail),
      );
    });
  }

  startRemoteFetchFor(ownerAddr: string, detail: AppChainResourceDetail) {
    const requestId = this.createRemoteRequestId(ownerAddr);

    this.getKnownResourceKeys(ownerAddr).forEach(resourceKey => {
      this.markRemoteFetchStartedWithRequestId(
        resourceKey,
        requestId,
        this.getLifecycleOptionsByResourceKey(resourceKey, detail),
      );
    });

    return requestId;
  }

  applyRemoteValueFor(
    ownerAddr: string,
    requestId: string | undefined,
    value: IAppChainItem[],
    detail: AppChainResourceDetail,
  ) {
    const effectiveRequestId =
      requestId || this.createRemoteRequestId(ownerAddr);
    let hasApplied = false;

    this.syncOwnerResources(
      ownerAddr,
      value,
      detail,
      (resourceKey, appChain) => {
        hasApplied =
          this.applyRemoteValue(
            resourceKey,
            effectiveRequestId,
            appChain,
            this.getLifecycleOptionsByResourceKey(resourceKey, {
              ...detail,
              count: value.length,
            }),
          ) || hasApplied;
      },
    );

    return hasApplied;
  }

  markRemoteErrorFor(
    ownerAddr: string,
    requestId: string | undefined,
    error: unknown,
    detail: AppChainResourceDetail,
  ) {
    const effectiveRequestId =
      requestId || this.createRemoteRequestId(ownerAddr);
    let hasMarked = false;

    this.getKnownResourceKeys(ownerAddr).forEach(resourceKey => {
      hasMarked =
        this.markError(
          resourceKey,
          'remote',
          error,
          this.getLifecycleOptionsByResourceKey(
            resourceKey,
            detail,
            effectiveRequestId,
          ),
        ) || hasMarked;
    });

    return hasMarked;
  }

  persistInBackgroundFor(
    ownerAddr: string,
    persist: () => Promise<void>,
    detail: AppChainResourceDetail,
  ) {
    const resourceKeys = this.getKnownResourceKeys(ownerAddr);

    if (!resourceKeys.length) {
      return persist();
    }

    resourceKeys.forEach(resourceKey => {
      this.queuePersist(
        resourceKey,
        this.getLifecycleOptionsByResourceKey(resourceKey, detail),
      );
    });

    return Promise.resolve()
      .then(() => {
        resourceKeys.forEach(resourceKey => {
          this.markPersistStarted(
            resourceKey,
            this.getLifecycleOptionsByResourceKey(resourceKey, detail),
          );
        });

        return persist();
      })
      .then(() => {
        resourceKeys.forEach(resourceKey => {
          this.markPersistSucceeded(
            resourceKey,
            this.getLifecycleOptionsByResourceKey(resourceKey, detail),
          );
        });
      })
      .catch(error => {
        console.error(`Failed to persist appchains for ${ownerAddr}:`, error);

        resourceKeys.forEach(resourceKey => {
          this.markError(
            resourceKey,
            'persist',
            error,
            this.getLifecycleOptionsByResourceKey(resourceKey, detail),
          );
        });
      });
  }
}

export const appChainResourceStore = new AppChainResourceStore();

const getAppChainQueue = new PQueue({
  interval: 1000,
  intervalCap: 10,
});

const buildAppChainLoadingState = (
  prev: Record<string, boolean>,
  patch: Record<string, boolean>,
) => {
  const nextLoadingMap = {
    ...prev,
    ...patch,
  };

  return {
    isLoadingByAddress: nextLoadingMap,
    isLoading: Object.values(nextLoadingMap).some(Boolean),
  };
};

const syncLegacyAppChainMap = (
  set: (
    partial:
      | Partial<AppChainState>
      | ((state: AppChainState) => Partial<AppChainState>),
  ) => void,
) => {
  set(() => ({
    appChainMap: appChainResourceStore.getAppChainMap(),
  }));
};

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

export const useAppChainStore = zCreate<AppChainState>(set => ({
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

      Object.entries(appChainMap).forEach(([ownerAddr, value]) => {
        appChainResourceStore.hydrate(ownerAddr, value, {
          trigger: 'initStore',
        });
      });
      syncLegacyAppChainMap(set);
    } catch (error) {
      console.error('Failed to init appchain store:', error);
    }
  },

  async batchGetAppChains(addresses, force = false) {
    const lowerAddresses = Array.from(
      new Set(addresses.map(item => item.toLowerCase())),
    );
    if (!lowerAddresses.length) {
      set(() => ({
        isLoading: false,
        isLoadingByAddress: {},
      }));
      syncLegacyAppChainMap(set);
      return;
    }
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

    set(state => ({
      ...buildAppChainLoadingState(state.isLoadingByAddress, nextLoadingMap),
    }));
    syncLegacyAppChainMap(set);

    if (!fetchList.length) {
      return;
    }

    // 并发请求
    await Promise.allSettled(
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

    const finishedLoadingMap: Record<string, boolean> = {};

    fetchList.forEach(address => {
      finishedLoadingMap[address] = false;
    });

    set(state => ({
      ...buildAppChainLoadingState(
        state.isLoadingByAddress,
        finishedLoadingMap,
      ),
    }));
    syncLegacyAppChainMap(set);
  },

  async getAppChains(address, force = false) {
    if (!address) {
      return;
    }

    const lowerAddress = address.toLowerCase();
    let requestId: string | undefined;

    set(state => ({
      ...buildAppChainLoadingState(state.isLoadingByAddress, {
        [lowerAddress]: true,
      }),
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
          syncLegacyAppChainMap(set);
          return appChainResourceStore.getAddressAppChains(lowerAddress);
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
      syncLegacyAppChainMap(set);
      return value;
    } catch (error) {
      appChainResourceStore.markRemoteErrorFor(lowerAddress, requestId, error, {
        trigger: 'getAppChains',
        force,
      });
      console.error(`Failed to get appchains for ${address}:`, error);
    } finally {
      set(state => ({
        ...buildAppChainLoadingState(state.isLoadingByAddress, {
          [lowerAddress]: false,
        }),
      }));
    }
  },

  getAppChainTotalUsdValue(address) {
    return appChainResourceStore.getAppChainTotalUsdValue(address);
  },

  getMultiAddressAppChainTotalUsdValue(addresses) {
    return appChainResourceStore.getMultiAddressAppChainTotalUsdValue(
      addresses,
    );
  },
}));

export default useAppChainStore;
