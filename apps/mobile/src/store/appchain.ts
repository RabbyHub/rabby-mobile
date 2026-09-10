import { openapi } from '@/core/request';
import type { AssetDataLoadDiagnosticTrace } from '@/core/utils/assetDataLoadDiagnostics';
import { zCreate } from '@/core/utils/reexports';
import { AppChainEntity } from '@/databases/entities/appchain';
import { batchSaveWithPQueueAndTransaction } from '@/databases/sync/_task';
import {
  AppChainItem,
  PortfolioItem,
} from '@rabby-wallet/rabby-api/dist/types';
import PQueue from 'p-queue';
import { appChainResourceStore } from './appchainResource';
import { traceStartupDiagnostic } from '@/core/utils/startupDiagnostics';
import { runAfterHomePostStartupReady } from '@/core/utils/homeStartupReady';
import {
  getSyncAbortVersion,
  isSyncAbortVersionStale,
  makeSyncAbortError,
  registerSyncAbortHandler,
} from '@/databases/sync/abort';

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
  batchGetAppChains(
    addresses: string[],
    force?: boolean,
    diagnostic?: AssetDataLoadDiagnosticTrace,
  ): Promise<void>;
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

const APPCHAIN_PERSIST_FLUSH_DELAY_MS = 80;
const APPCHAIN_PERSIST_FALLBACK_MS = 4000;
const APPCHAIN_BATCH_OWNER = '__appchain_batch__';

type AppChainPersistDetail = Parameters<
  typeof appChainResourceStore.persistInBackgroundFor
>[2];

type PendingAppChainPersistRequest = {
  resolve: () => void;
  reject: (error: unknown) => void;
};

type PendingAppChainPersist = {
  appChains: AppChainItem[];
  requests: PendingAppChainPersistRequest[];
};

const pendingAppChainPersists = new Map<string, PendingAppChainPersist>();
let pendingAppChainFlushTimer: ReturnType<typeof setTimeout> | null = null;
let pendingAppChainFlushCancel: (() => void) | null = null;
let appChainPersistInFlight: Promise<void> | null = null;
const appChainInitStoreStateRef = {
  promise: null as Promise<void> | null,
  hasCompleted: false,
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
function buildAppChainEntities(
  owner_addr: string,
  appChains: AppChainItem[],
  syncTimestamp: number,
) {
  const ownerAddr = owner_addr.toLowerCase();
  return appChains.map(item => {
    const entity = new AppChainEntity();
    AppChainEntity.fillEntity(entity, ownerAddr, item);
    entity._local_updated_at = syncTimestamp;
    return entity;
  });
}

async function cleanupStaleAppChainsForOwners(
  ownerAddrs: string[],
  syncTimestamp: number,
) {
  const cleanupStartedAt = Date.now();
  const results = await Promise.all(
    ownerAddrs.map(ownerAddr =>
      AppChainEntity.cleanupStaleAppChains(ownerAddr, syncTimestamp),
    ),
  );
  traceStartupDiagnostic('db', 'appchain_cleanup', {
    taskFor: 'appchain',
    entityName: AppChainEntity.name,
    ownerCount: ownerAddrs.length,
    deletedCount: results.reduce(
      (sum, result) => sum + (result.deletedCount || 0),
      0,
    ),
    durationMs: Date.now() - cleanupStartedAt,
  });
}

function settleAppChainPersistRequests(
  pending: PendingAppChainPersist[],
  error?: unknown,
) {
  pending.forEach(item => {
    item.requests.forEach(request => {
      if (error) {
        request.reject(error);
      } else {
        request.resolve();
      }
    });
  });
}

function abortPendingAppChainPersists(reason: string) {
  const pendingOwnerCount = pendingAppChainPersists.size;
  const error = makeSyncAbortError(reason);

  if (pendingAppChainFlushCancel) {
    pendingAppChainFlushCancel();
    pendingAppChainFlushCancel = null;
  }
  if (pendingAppChainFlushTimer) {
    clearTimeout(pendingAppChainFlushTimer);
    pendingAppChainFlushTimer = null;
  }

  const pending = Array.from(pendingAppChainPersists.values());
  pendingAppChainPersists.clear();
  settleAppChainPersistRequests(pending, error);

  if (pendingOwnerCount) {
    traceStartupDiagnostic('db', 'pending_appchain_sync_abort', {
      reason,
      pendingOwnerCount,
    });
  }
}

registerSyncAbortHandler(abortPendingAppChainPersists);

async function persistPendingAppChains(
  pendingEntries: Array<[string, PendingAppChainPersist]>,
) {
  const abortVersion = getSyncAbortVersion();
  const ownerAddrs = pendingEntries.map(([ownerAddr]) => ownerAddr);
  const pending = pendingEntries.map(([, item]) => item);
  if (!ownerAddrs.length) {
    settleAppChainPersistRequests(pending);
    return;
  }

  const requestCount = pending.reduce(
    (sum, item) => sum + item.requests.length,
    0,
  );
  traceStartupDiagnostic('db', 'appchain_coalesce_flush', {
    ownerCount: ownerAddrs.length,
    requestCount,
  });

  const syncTimestamp = Date.now();
  const entityBuildStartedAt = Date.now();
  const entities = pendingEntries.flatMap(([ownerAddr, item]) =>
    buildAppChainEntities(ownerAddr, item.appChains, syncTimestamp),
  );
  const rawCount = pending.reduce(
    (sum, item) => sum + item.appChains.length,
    0,
  );

  traceStartupDiagnostic('db', 'entity_build', {
    taskFor: 'appchain',
    entityName: AppChainEntity.name,
    rawCount,
    entityCount: entities.length,
    durationMs: Date.now() - entityBuildStartedAt,
  });

  try {
    if (isSyncAbortVersionStale(abortVersion)) {
      throw makeSyncAbortError('appchain_persist');
    }

    if (entities.length) {
      const { queueCompleted, taskKey } =
        await batchSaveWithPQueueAndTransaction(AppChainEntity, entities, {
          owner_addr: `${APPCHAIN_BATCH_OWNER}:${ownerAddrs.length}`,
          taskFor: 'appchain',
          batchSize: 100,
          concurrency: 1,
          delayBetweenTasks: 0,
          waitTaskDoneReturn: true,
          noNeedAbort: true,
          skipEmit: true,
          afterBatches: () =>
            cleanupStaleAppChainsForOwners(ownerAddrs, syncTimestamp),
        });

      if (!queueCompleted) {
        throw new Error(`[${taskKey}] appchain persist aborted`);
      }
    } else {
      if (isSyncAbortVersionStale(abortVersion)) {
        throw makeSyncAbortError('appchain_persist');
      }
      await cleanupStaleAppChainsForOwners(ownerAddrs, syncTimestamp);
    }

    settleAppChainPersistRequests(pending);
  } catch (error) {
    settleAppChainPersistRequests(pending, error);
    throw error;
  }
}

function scheduleAppChainPersistFlush() {
  if (
    pendingAppChainFlushTimer ||
    pendingAppChainFlushCancel ||
    appChainPersistInFlight
  ) {
    return;
  }

  let didRunImmediately = false;
  const cancel = runAfterHomePostStartupReady(
    () => {
      didRunImmediately = true;
      pendingAppChainFlushCancel = null;
      pendingAppChainFlushTimer = setTimeout(() => {
        pendingAppChainFlushTimer = null;
        pendingAppChainFlushCancel = null;
        void flushPendingAppChainPersists();
      }, APPCHAIN_PERSIST_FLUSH_DELAY_MS);
    },
    {
      fallbackMs: APPCHAIN_PERSIST_FALLBACK_MS,
      label: 'appchain_persist_flush',
    },
  );
  pendingAppChainFlushCancel = didRunImmediately ? null : cancel;
}

async function flushPendingAppChainPersists() {
  if (appChainPersistInFlight) {
    return;
  }

  const pendingEntries = Array.from(pendingAppChainPersists.entries());
  pendingAppChainPersists.clear();
  if (!pendingEntries.length) {
    return;
  }

  appChainPersistInFlight = persistPendingAppChains(pendingEntries).finally(
    () => {
      appChainPersistInFlight = null;
      if (pendingAppChainPersists.size > 0) {
        scheduleAppChainPersistFlush();
      }
    },
  );

  await appChainPersistInFlight;
}

const persistAppChains = async (
  owner_addr: string,
  appChains: AppChainItem[],
): Promise<void> => {
  const ownerAddr = owner_addr.toLowerCase();

  return new Promise<void>((resolve, reject) => {
    const pending = pendingAppChainPersists.get(ownerAddr);
    if (pending) {
      pending.appChains = appChains.slice();
      pending.requests.push({ resolve, reject });
    } else {
      pendingAppChainPersists.set(ownerAddr, {
        appChains: appChains.slice(),
        requests: [{ resolve, reject }],
      });
    }

    scheduleAppChainPersistFlush();
  });
};

function persistAppChainsInBackground(
  ownerAddr: string,
  appChains: AppChainItem[],
  detail: AppChainPersistDetail,
) {
  void appChainResourceStore
    .persistInBackgroundFor(
      ownerAddr.toLowerCase(),
      () => persistAppChains(ownerAddr, appChains),
      detail,
    )
    .catch(error => {
      console.error(`Failed to persist appchains for ${ownerAddr}:`, error);
    });
}

export const useAppChainStore = zCreate<AppChainState>((set, get) => ({
  appChainMap: {},
  isLoading: false,
  isLoadingByAddress: {},

  async initStore() {
    if (appChainInitStoreStateRef.hasCompleted) {
      return;
    }
    if (appChainInitStoreStateRef.promise) {
      return appChainInitStoreStateRef.promise;
    }

    const promise = (async () => {
      // 从数据库加载缓存数据
      const allAppChains = await AppChainEntity.queryAllForStartup();

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

      let nextAppChainMap = appChainMap;
      set(state => {
        nextAppChainMap = {
          ...appChainMap,
          ...state.appChainMap,
        };
        return {
          appChainMap: nextAppChainMap,
        };
      });
      Object.entries(nextAppChainMap).forEach(([ownerAddr, value]) => {
        appChainResourceStore.hydrate(ownerAddr, value, {
          trigger: 'initStore',
        });
      });
      appChainInitStoreStateRef.hasCompleted = true;
    })()
      .catch(error => {
        console.error('Failed to init appchain store:', error);
      })
      .finally(() => {
        appChainInitStoreStateRef.promise = null;
      });

    appChainInitStoreStateRef.promise = promise;
    await promise;
  },

  async batchGetAppChains(addresses, force = false, diagnostic) {
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

    diagnostic?.mark('app-chain-fetch-targets-resolved', {
      fetchAddressCount: fetchList.length,
    });

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

    const queuedAt = Date.now();
    const queueSizeAtStart = getAppChainQueue.size;
    const queuePendingAtStart = getAppChainQueue.pending;
    const queueWaits: number[] = [];
    const requestDurations: number[] = [];
    diagnostic?.mark('app-chain-remote-requests-started', {
      queueSizeAtStart,
      queuePendingAtStart,
    });

    // 并发请求
    const results = await Promise.allSettled(
      fetchList.map(address =>
        getAppChainQueue.add<{
          address: string;
          appChains: AppChainItem[];
        }>(async () => {
          queueWaits.push(Date.now() - queuedAt);
          const requestStartedAt = Date.now();
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
            persistAppChainsInBackground(address, appChains, {
              trigger: 'batchGetAppChains',
              force,
            });
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
          } finally {
            requestDurations.push(Date.now() - requestStartedAt);
          }
        }),
      ),
    );

    const getAverage = (values: number[]) =>
      values.length
        ? Math.round(
            values.reduce((total, value) => total + value, 0) / values.length,
          )
        : 0;
    const succeededCount = results.filter(
      result => result.status === 'fulfilled',
    ).length;
    diagnostic?.mark('app-chain-remote-requests-settled', {
      fetchAddressCount: fetchList.length,
      succeededCount,
      failedCount: fetchList.length - succeededCount,
      queueWaitAverageMs: getAverage(queueWaits),
      queueWaitMaxMs: Math.max(0, ...queueWaits),
      requestAverageMs: getAverage(requestDurations),
      requestMaxMs: Math.max(0, ...requestDurations),
    });

    // 处理结果
    const applyStartedAt = Date.now();
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
    diagnostic?.mark('app-chain-remote-values-applied', {
      elapsedMs: Date.now() - applyStartedAt,
    });
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
      persistAppChainsInBackground(lowerAddress, appChains, {
        trigger: 'getAppChains',
        force,
      });
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

export const ensureAppChainStoreInitialized = () =>
  useAppChainStore.getState().initStore();

export default useAppChainStore;
