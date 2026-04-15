import { useMemo } from 'react';
import { makeSWRKeyAsyncFunc } from '@/core/utils/concurrency';
import { getTop10MyAccounts } from '@/core/apis/account';
import { keyringService } from '@/core/services';
import { perfEvents } from '@/core/utils/perf';
import { MMKV_FILE_NAMES } from '@/core/storage/mmkvConstants';
import { balance24hMMKV } from '@/core/storage/mmkvInstances';
import {
  AccountsBalanceState,
  accountsBalanceEvents,
  balanceAccountsStore,
} from './balance';
import { formatSmallUsdValue } from './curveShared';
import { formatUsdValue } from '@/utils/number';
import { debounce, isEqual } from 'lodash';
import PQueue from 'p-queue';
import { useShallow } from 'zustand/react/shallow';
import { BaseStore } from './_base';
import { ResourceBaseStore, ResourceFlowState } from './_resourceBase';
import { ResourceLocalTarget } from './_resourceFlowDebug';
import addressBalanceStore, { type AddressBalanceSnapshot } from './balance';
import {
  fetch24hBalance,
  getBalance24hCache,
  type IBalance24hData,
  setBalance24hCache,
} from '@/utils/24hBalanceCache';

export type Address24hBalanceValue = IBalance24hData['data'] & {
  updateTime: IBalance24hData['updateTime'];
};

export type Address24hBalanceMap = Record<string, Address24hBalanceValue>;

export type Address24hBalanceSnapshot = {
  address: string;
  value?: Address24hBalanceValue;
  flow: ResourceFlowState;
  sourceOfCurrentValue?: 'hydrate' | 'remote';
  persistStatus: ResourceFlowState['persistStatus'];
};

export type Address24hChangeFlowState = {
  address: string;
  hasValue: boolean;
  isHydrating: boolean;
  isFetchingRemote: boolean;
  isResourceLoading: boolean;
  isComputing: boolean;
  isLoading: boolean;
  isLoadingWithoutValue: boolean;
  persistStatus: ResourceFlowState['persistStatus'];
  lastError?: ResourceFlowState['lastError'];
};

export type Balance24hTraceContext = {
  scene?: string;
  requester?: string;
  endpoint?: string;
};

export type Addresses24hChangeFlowState = {
  addresses: string[];
  loadingAddresses: string[];
  missingAddresses: string[];
  computingAddresses: string[];
  hasAnyValue: boolean;
  isAnyLoading: boolean;
  isAnyLoadingWithoutValue: boolean;
  hasAllValues: boolean;
};

export type Scene24hChangeFlowState = Addresses24hChangeFlowState & {
  isSceneComputing: boolean;
};

function buildAddress24hBalanceMapFromSnapshots(
  snapshots: Address24hBalanceSnapshot[],
) {
  return snapshots.reduce((acc, snapshot) => {
    if (snapshot.value) {
      acc[snapshot.address] = snapshot.value;
    }

    return acc;
  }, {} as Address24hBalanceMap);
}

function buildCurrentBalanceMapFromSnapshots(
  snapshots: AddressBalanceSnapshot[],
) {
  return snapshots.reduce(
    (acc, snapshot) => {
      if (snapshot.value) {
        acc[snapshot.address] = {
          evmBalance: snapshot.value.evmBalance,
          totalBalance: snapshot.value.totalBalance,
        };
      }

      return acc;
    },
    {} as Record<
      string,
      {
        evmBalance: number;
        totalBalance: number;
      }
    >,
  );
}

const build24hBalanceLocalTargets = (
  address: string,
): ResourceLocalTarget[] => [
  {
    kind: 'mmkv',
    file: MMKV_FILE_NAMES.BALANCE_24H,
    key: address,
  },
];

const build24hTraceDetail = (
  detail: Record<string, unknown>,
  trace?: Balance24hTraceContext,
) => {
  return {
    ...detail,
    scene: trace?.scene,
    requester: trace?.requester,
    endpoint: trace?.endpoint,
  };
};

class Address24hBalanceStore extends ResourceBaseStore<Address24hBalanceValue> {
  constructor() {
    super('address24hBalance');
  }

  private normalizeAddress(address?: string) {
    return address?.toLowerCase();
  }

  removeAddress24hBalance = (
    address: string,
    detail?: Record<string, unknown>,
  ) => {
    const lowerAddress = this.normalizeAddress(address);
    if (!lowerAddress) {
      return false;
    }

    return this.removeResource(lowerAddress, {
      localTargets: build24hBalanceLocalTargets(lowerAddress),
      detail,
    });
  };

  getAddress24hBalance = (address?: string) => {
    return this.getValue(this.normalizeAddress(address));
  };

  getAddress24hBalanceMap = () => this.getValueMap();

  getAddress24hBalanceResourceState = (address?: string) => {
    return this.getMeta(this.normalizeAddress(address));
  };

  getAddress24hBalanceFlowState = (address?: string) => {
    return this.getFlowState(this.normalizeAddress(address));
  };

  useAddress24hBalance = (address?: string) => {
    const balance24h = this.useValue(this.normalizeAddress(address) || '');

    return { balance24h };
  };

  useAddress24hBalanceFlowState = (address?: string) => {
    return this.useFlowState(this.normalizeAddress(address) || '');
  };

  useAddresses24hBalanceSnapshots = (addresses: string[]) => {
    const normalizedAddresses = useMemo(
      () =>
        Array.from(new Set(addresses.map(address => address.toLowerCase()))),
      [addresses],
    );
    const snapshots = this.useSnapshots(normalizedAddresses);

    return useMemo(() => {
      return snapshots.map(snapshot => {
        return {
          address: snapshot.resourceKey,
          value: snapshot.value,
          flow: snapshot.flow,
          sourceOfCurrentValue: snapshot.sourceOfCurrentValue,
          persistStatus: snapshot.persistStatus,
        } satisfies Address24hBalanceSnapshot;
      });
    }, [snapshots]);
  };

  initStore = async () => {
    balance24hMMKV.getAllKeys().forEach(key => {
      const lowerAddress = this.normalizeAddress(key);
      if (!lowerAddress) {
        return;
      }

      const localTargets = build24hBalanceLocalTargets(lowerAddress);
      const cacheData = getBalance24hCache(lowerAddress);
      if (!cacheData?.data) {
        return;
      }

      this.markHydrateStarted(lowerAddress, {
        localTargets,
        detail: {
          source: 'initStore',
          isExpired: cacheData.isExpired,
          updateTime: cacheData.updateTime,
        },
      });
      this.applyHydratedValue(
        lowerAddress,
        {
          ...cacheData.data,
          updateTime: cacheData.updateTime,
        },
        {
          localTargets,
          detail: {
            source: 'initStore',
            isExpired: cacheData.isExpired,
            updateTime: cacheData.updateTime,
          },
        },
      );
    });
  };

  hydrateAddress24hBalanceFromCache = (address: string) => {
    const lowerAddress = this.normalizeAddress(address);
    if (!lowerAddress) {
      return null;
    }

    const localTargets = build24hBalanceLocalTargets(lowerAddress);
    const cacheData = getBalance24hCache(lowerAddress);
    const existedData = this.getAddress24hBalance(lowerAddress);
    const shouldHydrateFromCache =
      !!cacheData?.data && (!existedData || !cacheData.isExpired);

    this.markHydrateStarted(lowerAddress, {
      localTargets,
      detail: {
        source: 'hydrateAddress24hBalanceFromCache',
        hasMemoryValue: !!existedData,
        hasCache: !!cacheData?.data,
        isExpired: !!cacheData?.isExpired,
      },
    });

    if (shouldHydrateFromCache) {
      this.applyHydratedValue(
        lowerAddress,
        {
          ...cacheData.data,
          updateTime: cacheData.updateTime,
        },
        {
          localTargets,
          detail: {
            source: 'hydrateAddress24hBalanceFromCache',
            updateTime: cacheData.updateTime,
          },
        },
      );
    } else {
      this.markHydrateSkipped(lowerAddress, {
        localTargets,
        detail: {
          source: 'hydrateAddress24hBalanceFromCache',
          hasMemoryValue: !!existedData,
          hasCache: !!cacheData?.data,
          isExpired: !!cacheData?.isExpired,
        },
      });
    }

    return cacheData;
  };

  refreshAddress24hBalance = makeSWRKeyAsyncFunc(
    async (address: string, force = false, trace?: Balance24hTraceContext) => {
      const lowerAddress = this.normalizeAddress(address);
      if (!lowerAddress) {
        return undefined;
      }

      const localTargets = build24hBalanceLocalTargets(lowerAddress);
      let requestId: string | undefined;

      try {
        const cacheData = this.hydrateAddress24hBalanceFromCache(lowerAddress);

        if (cacheData?.data && !force && !cacheData.isExpired) {
          return {
            ...cacheData.data,
            updateTime: cacheData.updateTime,
          };
        }

        requestId = this.startRemoteFetch(lowerAddress, {
          localTargets,
          detail: build24hTraceDetail(
            {
              source: 'refreshAddress24hBalance',
              force,
            },
            trace,
          ),
        });
        const nextData = await fetch24hBalance(lowerAddress);
        const normalizedData = {
          ...nextData.data,
          updateTime: nextData.updateTime,
        };
        const applied = this.applyRemoteValue(
          lowerAddress,
          requestId,
          normalizedData,
          {
            localTargets,
            detail: build24hTraceDetail(
              {
                source: 'refreshAddress24hBalance',
                force,
                totalUsdValue: normalizedData.total_usd_value,
                updateTime: normalizedData.updateTime,
              },
              trace,
            ),
          },
        );

        if (applied) {
          this.persistInBackground(
            lowerAddress,
            () =>
              setBalance24hCache(lowerAddress, {
                data: {
                  total_usd_value: normalizedData.total_usd_value,
                },
                updateTime: normalizedData.updateTime,
              }),
            {
              requestId,
              localTargets,
              detail: build24hTraceDetail(
                {
                  source: 'refreshAddress24hBalance',
                  force,
                  totalUsdValue: normalizedData.total_usd_value,
                  updateTime: normalizedData.updateTime,
                },
                trace,
              ),
            },
          );
        }

        return normalizedData;
      } catch (error) {
        this.markError(lowerAddress, requestId ? 'remote' : 'hydrate', error, {
          requestId,
          localTargets,
          detail: build24hTraceDetail(
            {
              source: 'refreshAddress24hBalance',
              force,
            },
            trace,
          ),
        });
        throw error;
      }
    },
    ctx => {
      const address = ctx.args[0]?.toLowerCase?.() || '';
      const force = !!ctx.args[1];
      return `refreshAddress24hBalance-${address}-${
        force ? 'force' : 'noforce'
      }`;
    },
  );
}

export const balance24hStore = new Address24hBalanceStore();

function buildAddress24hChangeFlowState(
  address: string,
  flow: ResourceFlowState,
  isComputing: boolean,
): Address24hChangeFlowState {
  const isResourceLoading = flow.isLoading;
  const isLoading = isResourceLoading || isComputing;

  return {
    address,
    hasValue: flow.hasValue,
    isHydrating: flow.isHydrating,
    isFetchingRemote: flow.isFetchingRemote,
    isResourceLoading,
    isComputing,
    isLoading,
    isLoadingWithoutValue: !flow.hasValue && isLoading,
    persistStatus: flow.persistStatus,
    lastError: flow.lastError,
  };
}

export function useAddress24hChangeFlowState(
  address?: string,
  options?: {
    isComputing?: boolean;
  },
) {
  const normalizedAddress = address?.toLowerCase() || '';
  const flow = balance24hStore.useAddress24hBalanceFlowState(normalizedAddress);

  return useMemo(() => {
    return buildAddress24hChangeFlowState(
      normalizedAddress,
      flow,
      !!options?.isComputing,
    );
  }, [flow, normalizedAddress, options?.isComputing]);
}

export function useAddresses24hChangeFlowState(
  addresses: string[],
  options?: {
    computingAddresses?: string[];
  },
) {
  const normalizedAddresses = useMemo(
    () => Array.from(new Set(addresses.map(address => address.toLowerCase()))),
    [addresses],
  );
  const computingAddressSet = useMemo(
    () =>
      new Set(
        (options?.computingAddresses || []).map(address =>
          address.toLowerCase(),
        ),
      ),
    [options?.computingAddresses],
  );
  const snapshots =
    balance24hStore.useAddresses24hBalanceSnapshots(normalizedAddresses);

  return useMemo(() => {
    const summary = snapshots.reduce(
      (acc, snapshot) => {
        const state = buildAddress24hChangeFlowState(
          snapshot.address,
          snapshot.flow,
          computingAddressSet.has(snapshot.address),
        );

        if (state.isLoading) {
          acc.loadingAddresses.push(state.address);
        }
        if (!state.hasValue) {
          acc.missingAddresses.push(state.address);
        } else {
          acc.hasAnyValue = true;
        }
        if (state.isComputing) {
          acc.computingAddresses.push(state.address);
        }
        if (state.isLoadingWithoutValue) {
          acc.isAnyLoadingWithoutValue = true;
        }

        return acc;
      },
      {
        loadingAddresses: [] as string[],
        missingAddresses: [] as string[],
        computingAddresses: [] as string[],
        hasAnyValue: false,
        isAnyLoadingWithoutValue: false,
      },
    );

    return {
      addresses: normalizedAddresses,
      loadingAddresses: summary.loadingAddresses,
      missingAddresses: summary.missingAddresses,
      computingAddresses: summary.computingAddresses,
      hasAnyValue: summary.hasAnyValue,
      isAnyLoading: summary.loadingAddresses.length > 0,
      isAnyLoadingWithoutValue: summary.isAnyLoadingWithoutValue,
      hasAllValues:
        normalizedAddresses.length > 0 && summary.missingAddresses.length === 0,
    } satisfies Addresses24hChangeFlowState;
  }, [computingAddressSet, normalizedAddresses, snapshots]);
}

export type Addresses24hChangeSummary = {
  addresses: string[];
  combinedData: Combined24hBalanceData;
  flow: Addresses24hChangeFlowState;
  hasAnyComparableValue: boolean;
};

export type Multi24hBalance = Address24hBalanceMap;
export type BalanceScene = 'Home';

export type Combined24hBalanceData = ReturnType<
  typeof computeCombined24hBalanceData
>;

export type Multi24hBalanceState = {
  addresses: Record<BalanceScene, string[]>;
  combinedData: Record<BalanceScene, Combined24hBalanceData>;
  sceneLoading: Record<BalanceScene, boolean>;
  sceneComputing: Record<BalanceScene, boolean>;
  sceneAddrLoading: Record<`${BalanceScene}-${string}`, boolean>;
};

export function useAddresses24hChangeSummary(
  addresses: string[],
): Addresses24hChangeSummary {
  const normalizedAddresses = useMemo(
    () => Array.from(new Set(addresses.map(address => address.toLowerCase()))),
    [addresses],
  );
  const balanceSnapshots =
    addressBalanceStore.useAddressesSnapshot(normalizedAddresses);
  const balance24hSnapshots =
    balance24hStore.useAddresses24hBalanceSnapshots(normalizedAddresses);
  const flow = useAddresses24hChangeFlowState(normalizedAddresses);

  const combinedData = useMemo(() => {
    return computeCombined24hBalanceData({
      addresses: normalizedAddresses,
      multi24hBalance:
        buildAddress24hBalanceMapFromSnapshots(balance24hSnapshots),
      balanceMap: buildCurrentBalanceMapFromSnapshots(balanceSnapshots),
      totalEvmBalance: 0,
      totalBalance: 0,
    });
  }, [balance24hSnapshots, balanceSnapshots, normalizedAddresses]);

  return useMemo(() => {
    return {
      addresses: normalizedAddresses,
      combinedData,
      flow,
      hasAnyComparableValue: combinedData.list.length > 0,
    } satisfies Addresses24hChangeSummary;
  }, [combinedData, flow, normalizedAddresses]);
}

const TEN_MINUTES = 10 * 60 * 1000;

const normalizeAddressesForCompare = (addresses: string[]) =>
  Array.from(new Set(addresses.map(addr => addr.toLowerCase()))).sort();

class Scene24hBalanceStore extends BaseStore<Multi24hBalanceState> {
  private readonly queues: Record<BalanceScene, PQueue> = {
    Home: new PQueue({ intervalCap: 10, concurrency: 10, interval: 1000 }),
  };

  private readonly sceneLastLoadingRef: Record<BalanceScene, number> = {
    Home: 0,
  };

  private readonly lastTop10AddressesRef = {
    current: null as null | string[],
  };

  private hasStartedLifecycle = false;

  private readonly debouncedSceneCombinedDataUpdaters: Record<
    BalanceScene,
    () => void
  > = {
    Home: debounce(() => {
      this.commitSceneCombinedData('Home');
    }, 200),
  };

  constructor() {
    super({
      addresses: {
        Home: [],
      },
      sceneLoading: {
        Home: false,
      },
      sceneComputing: {
        Home: false,
      },
      sceneAddrLoading: {},
      combinedData: {
        Home: computeCombined24hBalanceData({
          addresses: [],
          multi24hBalance: {},
          balanceMap: {},
          totalEvmBalance: 0,
          totalBalance: 0,
        }),
      },
    });
  }

  private setSceneAddresses<T extends BalanceScene>(
    scene: T,
    addresses: string[],
  ) {
    const normalizedAddresses = normalizeAddressesForCompare(addresses);

    this.setState(prev => {
      const prevAddresses = prev.addresses[scene] || [];
      if (isEqual(prevAddresses, normalizedAddresses)) {
        return prev;
      }

      return {
        addresses: {
          ...prev.addresses,
          [scene]: normalizedAddresses,
        },
      };
    });
  }

  private setSceneLoading<T extends BalanceScene>(
    scene: T,
    isLoading: boolean,
  ) {
    this.setState(prev => {
      if (prev.sceneLoading[scene] === isLoading) {
        return prev;
      }

      return {
        sceneLoading: {
          ...prev.sceneLoading,
          [scene]: isLoading,
        },
      };
    });
  }

  private setSceneComputing<T extends BalanceScene>(
    scene: T,
    isComputing: boolean,
  ) {
    this.setState(prev => {
      if (prev.sceneComputing[scene] === isComputing) {
        return prev;
      }

      return {
        sceneComputing: {
          ...prev.sceneComputing,
          [scene]: isComputing,
        },
      };
    });
  }

  private setSceneAddrLoading(
    scene: BalanceScene,
    addr: string | string[],
    isLoading: boolean,
  ) {
    const addrs = Array.isArray(addr) ? addr : [addr];
    const normalizedAddrs = addrs.map(item => item.toLowerCase());

    this.setState(prev => {
      let changed = false;
      const nextSceneAddrLoading = { ...prev.sceneAddrLoading };

      normalizedAddrs.forEach(address => {
        const key = `${scene}-${address}` as `${BalanceScene}-${string}`;
        if (nextSceneAddrLoading[key] !== isLoading) {
          nextSceneAddrLoading[key] = isLoading;
          changed = true;
        }
      });

      if (!changed) {
        return prev;
      }

      return {
        sceneAddrLoading: nextSceneAddrLoading,
      };
    });
  }

  private commitSceneCombinedData<T extends BalanceScene>(scene: T) {
    const states = this.getState();
    const addresses = states.addresses[scene];
    const multi24hBalance = balance24hStore.getAddress24hBalanceMap();
    const balanceValueMap = addressBalanceStore.getAddressValueMap();

    const combinedData = computeCombined24hBalanceData({
      addresses,
      multi24hBalance,
      balanceMap: balanceValueMap,
      totalEvmBalance: 0,
      totalBalance: 0,
    });

    this.setState(prev => ({
      combinedData: {
        ...prev.combinedData,
        [scene]: combinedData,
      },
    }));
    this.setSceneComputing(scene, false);

    perfEvents.emit('SCENE_24H_BALANCE_UPDATED', {
      scene,
      combinedData,
    });
  }

  private scheduleSceneCombinedDataUpdate<T extends BalanceScene>(scene: T) {
    this.setSceneComputing(scene, true);
    this.debouncedSceneCombinedDataUpdaters[scene]();
  }

  hydrateSceneCombinedDataFromCache = (
    scene: BalanceScene,
    addresses: string[],
  ) => {
    const normalizedAddresses = normalizeAddressesForCompare(addresses);
    if (!normalizedAddresses.length) {
      return;
    }

    this.setSceneAddresses(scene, normalizedAddresses);
    this.setSceneLoading(scene, false);
    this.scheduleSceneCombinedDataUpdate(scene);
  };

  private waitQueueFinished = (queue: PQueue) => queue.onIdle();

  refreshCombinedDataForScene = makeSWRKeyAsyncFunc(
    async (scene: BalanceScene, options?: FetchTotalBalanceOptions) => {
      let { addresses, force = false, reason } = options || {};
      if (!addresses?.length) {
        addresses = (await getTop10MyAccounts()).top10Addresses;
      }

      const normalizedAddresses = normalizeAddressesForCompare(
        Array.isArray(addresses) ? addresses : [addresses],
      );
      const prevAddresses = this.getState().addresses[scene];
      const hasAddressSelectionChanged = !isEqual(
        normalizeAddressesForCompare(prevAddresses),
        normalizedAddresses,
      );

      this.setSceneAddresses(scene, normalizedAddresses);

      const beforeReturn = () => {
        addressBalanceStore.computeTotalBalance(
          normalizedAddresses,
          balanceAccountsStore.getState().balance,
        );
        this.scheduleSceneCombinedDataUpdate(scene);
      };

      try {
        if (!normalizedAddresses.length) {
          this.setSceneLoading(scene, false);
          this.setSceneComputing(scene, false);
          return;
        }

        if (!force) {
          const now = Date.now();
          if (
            !hasAddressSelectionChanged &&
            reason !== 'selection_changed' &&
            now - this.sceneLastLoadingRef[scene] < TEN_MINUTES
          ) {
            beforeReturn();
            return;
          }
          this.sceneLastLoadingRef[scene] = now;
        } else {
          this.sceneLastLoadingRef[scene] = Date.now();
        }

        this.setSceneLoading(scene, !!force);
        const nextCheckAddress = new Set([...normalizedAddresses]);

        normalizedAddresses.forEach(address => {
          this.setSceneAddrLoading(scene, address, true);
          const cacheData =
            balance24hStore.hydrateAddress24hBalanceFromCache(address);
          if (cacheData?.data && !cacheData.isExpired) {
            nextCheckAddress.delete(address);
            this.setSceneAddrLoading(scene, address, false);
          }
        });

        this.setSceneLoading(scene, force || nextCheckAddress.size > 0);
        beforeReturn();

        const queue = this.queues[scene];
        queue.clear();
        Array.from(nextCheckAddress).forEach(address => {
          queue.add(async () => {
            this.setSceneAddrLoading(scene, address, true);
            try {
              await balance24hStore.refreshAddress24hBalance(address, force, {
                scene,
                requester: 'Scene24hBalanceStore.refreshCombinedDataForScene',
                endpoint: 'openapi.get24hTotalBalance',
              });
            } catch (error) {
              console.error('Fetch curve error', error);
            } finally {
              this.setSceneAddrLoading(scene, address, false);
            }
          });
        });

        await this.waitQueueFinished(queue);
        this.setSceneLoading(scene, false);
      } catch (error) {
        console.error('Fetch curve error', error);
        this.setSceneLoading(scene, false);
      } finally {
        beforeReturn();
      }
    },
    ctx => {
      const scene = ctx.args[0];
      const { addresses: addrList, force } = ctx.args[1] || {};
      const addresses = normalizeAddressesForCompare(
        Array.isArray(addrList) ? addrList : addrList ? [addrList] : [],
      );

      return `refreshCombinedDataForScene-${scene}-${addresses.join(',')}-${
        force ? 'force' : 'noforce'
      }`;
    },
  );

  refresh24hAssets = async ({
    addresses,
    force = false,
    balanceAccounts,
    reason,
  }: {
    addresses?: string[];
    force?: boolean;
    balanceAccounts?: AccountsBalanceState['balance'];
    reason?: 'selection_changed' | 'balance_changed' | 'manual_refresh';
  } = {}) => {
    const top10Addresses =
      addresses ||
      (balanceAccounts && Object.keys(balanceAccounts).length
        ? Object.keys(balanceAccounts)
        : (await getTop10MyAccounts()).top10Addresses);

    const lastTop10Addresses = this.lastTop10AddressesRef.current;
    this.lastTop10AddressesRef.current =
      normalizeAddressesForCompare(top10Addresses);
    const lastTop10Changed = !isEqual(
      this.lastTop10AddressesRef.current,
      lastTop10Addresses,
    );
    const finalTop10Addresses = lastTop10Changed
      ? this.lastTop10AddressesRef.current
      : top10Addresses;

    return this.refreshCombinedDataForScene('Home', {
      addresses: finalTop10Addresses,
      force: force || lastTop10Changed,
      reason,
    });
  };

  startProcessScene24hBalanceEvents = () => {
    if (this.hasStartedLifecycle) {
      return;
    }
    this.hasStartedLifecycle = true;

    keyringService.on('removedAccount', async account => {
      const lowerAddress = account.address.toLowerCase();
      const addresses = await keyringService.getAllAddresses();
      const stillExists = addresses.some(item => {
        return item.address.toLowerCase() === lowerAddress;
      });

      if (stillExists) {
        return;
      }

      balance24hStore.removeAddress24hBalance(lowerAddress, {
        source: 'keyringService.removedAccount',
        reason: 'address_deleted',
      });
    });

    balance24hStore.subscribe(() => {
      const addresses = this.getState().addresses.Home;
      if (!addresses.length) {
        return;
      }

      addressBalanceStore.computeTotalBalance(
        addresses,
        balanceAccountsStore.getState().balance,
      );
      this.scheduleSceneCombinedDataUpdate('Home');
    });

    accountsBalanceEvents.on(
      'SELECTION_CHANGED',
      ({ nextAddresses, balance }) => {
        this.refresh24hAssets({
          addresses: nextAddresses,
          balanceAccounts: balance,
          reason: 'selection_changed',
        });
      },
    );

    accountsBalanceEvents.on('BALANCE_CHANGED', ({ addresses, balance }) => {
      if (this.getState().addresses.Home.length) {
        this.scheduleSceneCombinedDataUpdate('Home');
      }
      this.refresh24hAssets({
        addresses,
        balanceAccounts: balance,
        reason: 'balance_changed',
      });
    });
  };

  useScene24hBalanceCombinedData = (scene: BalanceScene) => {
    const { addresses: sceneAddresses, combinedData: persistedCombinedData } =
      this.useStore(
        useShallow(s => ({
          addresses: s.addresses[scene],
          combinedData: s.combinedData[scene],
        })),
      );
    const summary = useAddresses24hChangeSummary(sceneAddresses);
    const combinedData = sceneAddresses.length
      ? summary.combinedData
      : persistedCombinedData;

    return { combinedData };
  };

  useMultiHome24hBalanceCurveChart = () => {
    const homeState = this.useStore(
      useShallow(s => {
        const homeData = s.combinedData.Home;

        return {
          addresses: s.addresses.Home,
          rawNetWorth: homeData.rawNetWorth,
          rawChange: homeData.rawChange,
          changePercent: homeData.changePercent,
          isLoss: homeData.isLoss,
        };
      }),
    );
    const summary = useAddresses24hChangeSummary(homeState.addresses);

    const combinedData = homeState.addresses.length
      ? {
          rawNetWorth: summary.combinedData.rawNetWorth,
          rawChange: summary.combinedData.rawChange,
          changePercent: summary.combinedData.changePercent,
          isLoss: summary.combinedData.isLoss,
        }
      : {
          rawNetWorth: homeState.rawNetWorth,
          rawChange: homeState.rawChange,
          changePercent: homeState.changePercent,
          isLoss: homeState.isLoss,
        };

    return { combinedData };
  };

  useScene24hBalanceMulti24hBalance = (scene: BalanceScene) => {
    const addresses = this.useStore(s => s.addresses[scene]);
    const balance24hSnapshots =
      balance24hStore.useAddresses24hBalanceSnapshots(addresses);

    const filteredMulti24hBalance = useMemo(() => {
      return buildAddress24hBalanceMapFromSnapshots(balance24hSnapshots);
    }, [balance24hSnapshots]);

    return { multi24hBalance: filteredMulti24hBalance };
  };

  useSceneIsLoading = (scene: BalanceScene) => {
    const isLoading = this.useStore(
      useShallow(s => {
        return s.sceneLoading[scene] || s.sceneComputing[scene];
      }),
    );

    return { isLoading };
  };

  useSceneIsLoadingNew = (scene: BalanceScene) => {
    const { addresses, sceneLoading, sceneAddrLoading } = this.useStore(
      useShallow(s => ({
        addresses: s.addresses[scene],
        sceneLoading: s.sceneLoading[scene],
        sceneAddrLoading: s.sceneAddrLoading,
      })),
    );
    const balance24hSnapshots =
      balance24hStore.useAddresses24hBalanceSnapshots(addresses);
    const balanceSnapshots =
      addressBalanceStore.useAddressesSnapshot(addresses);

    const isLoadingNew = useMemo(() => {
      if (addresses.length === 0) {
        return sceneLoading;
      }

      const multi24hBalance =
        buildAddress24hBalanceMapFromSnapshots(balance24hSnapshots);
      const balanceMap = buildCurrentBalanceMapFromSnapshots(balanceSnapshots);

      const hasAnyCurrentBalance = addresses.some(address => {
        return !!balanceMap[address.toLowerCase()];
      });
      const hasAnyComparableBalance = addresses.some(address => {
        const lowerAddress = address.toLowerCase();
        return !!multi24hBalance[lowerAddress] && !!balanceMap[lowerAddress];
      });
      const hasAnyAddressLoading = addresses.some(address => {
        return !!sceneAddrLoading[`${scene}-${address.toLowerCase()}`];
      });

      return (
        !hasAnyCurrentBalance &&
        !hasAnyComparableBalance &&
        (sceneLoading || hasAnyAddressLoading)
      );
    }, [
      addresses,
      balance24hSnapshots,
      balanceSnapshots,
      scene,
      sceneAddrLoading,
      sceneLoading,
    ]);

    return { isLoadingNew };
  };

  useSceneChangeFlowState = (
    scene: BalanceScene,
    addresses: string[],
  ): Scene24hChangeFlowState => {
    const normalizedAddresses = useMemo(
      () =>
        Array.from(new Set(addresses.map(address => address.toLowerCase()))),
      [addresses],
    );
    const { sceneAddresses, sceneComputing } = this.useStore(
      useShallow(s => ({
        sceneAddresses: s.addresses[scene],
        sceneComputing: s.sceneComputing[scene],
      })),
    );
    const changeFlow = useAddresses24hChangeFlowState(normalizedAddresses, {
      computingAddresses: sceneComputing ? sceneAddresses : [],
    });

    return useMemo(
      () => ({
        ...changeFlow,
        isSceneComputing: sceneComputing,
      }),
      [changeFlow, sceneComputing],
    );
  };

  useScene24hBalanceLightWeightData = (scene: BalanceScene) => {
    const sceneState = this.useStore(
      useShallow(s => {
        const currentSceneData = s.combinedData[scene];

        return {
          addresses: s.addresses[scene],
          netWorth: currentSceneData.netWorth,
          isLoss: currentSceneData.isLoss,
        };
      }),
    );
    const summary = useAddresses24hChangeSummary(sceneState.addresses);

    const lightweightData = sceneState.addresses.length
      ? {
          netWorth: summary.combinedData.netWorth,
          isLoss: summary.combinedData.isLoss,
        }
      : {
          netWorth: sceneState.netWorth,
          isLoss: sceneState.isLoss,
        };

    return lightweightData;
  };
}

export const scene24hBalanceStore = new Scene24hBalanceStore();

export function hydrateCachedHome24hBalanceScene() {
  const cachedAddresses = balanceAccountsStore.getState().selectedAddresses;
  scene24hBalanceStore.hydrateSceneCombinedDataFromCache(
    'Home',
    cachedAddresses,
  );
}

export type FetchTotalBalanceOptions = {
  addresses?: string | string[];
  force?: boolean;
  reason?: 'selection_changed' | 'balance_changed' | 'manual_refresh';
};

function computeCombined24hBalanceData(input: {
  addresses: string[];
  multi24hBalance: Multi24hBalance;
  balanceMap: Record<
    string,
    {
      evmBalance: number;
      totalBalance: number;
    }
  >;
  totalEvmBalance: number;
  totalBalance: number;
}) {
  const { addresses, multi24hBalance, balanceMap } = input;

  const availableCurrentAddresses = addresses.filter(address => {
    return !!balanceMap[address.toLowerCase()];
  });
  const comparableAddresses = addresses.filter(address => {
    const lowerAddress = address.toLowerCase();
    return !!multi24hBalance[lowerAddress] && !!balanceMap[lowerAddress];
  });
  const list = comparableAddresses.map(address => {
    return multi24hBalance[address.toLowerCase()];
  });
  const totalCurrentBalance = availableCurrentAddresses.reduce(
    (result, address) => {
      return result + (balanceMap[address.toLowerCase()]?.totalBalance || 0);
    },
    0,
  );
  const totalComparableEvmBalance = comparableAddresses.reduce(
    (result, address) => {
      return result + (balanceMap[address.toLowerCase()]?.evmBalance || 0);
    },
    0,
  );
  const total24hBalance = list.reduce((result, item) => {
    return result + (item?.total_usd_value || 0);
  }, 0);
  const canShowCurrentBalance = availableCurrentAddresses.length > 0;
  const canShowChange = comparableAddresses.length > 0;
  const assetsChange = canShowChange
    ? totalComparableEvmBalance - total24hBalance
    : 0;
  const rawNetWorth = canShowCurrentBalance ? totalCurrentBalance : 0;

  return {
    list,
    rawNetWorth,
    netWorth: formatSmallUsdValue(totalCurrentBalance || 0),
    rawChange: assetsChange,
    change: `${formatUsdValue(Math.abs(assetsChange))}`,
    changePercent: canShowChange
      ? total24hBalance !== 0
        ? `${Math.abs((assetsChange * 100) / total24hBalance).toFixed(2)}%`
        : `${totalComparableEvmBalance === 0 ? '0' : '100.00'}%`
      : '',
    isLoss: canShowChange ? assetsChange < 0 : false,
    isEmptyAssets:
      canShowCurrentBalance &&
      totalCurrentBalance === 0 &&
      (!canShowChange || total24hBalance === 0),
  };
}
