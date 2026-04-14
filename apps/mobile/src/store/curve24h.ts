import { openapi } from '@/core/request';
import { MMKV_FILE_NAMES } from '@/core/storage/mmkvConstants';
import { dayCurveMMKV } from '@/core/storage/mmkvInstances';
import { makeSWRKeyAsyncFunc } from '@/core/utils/concurrency';
import { CurveDayType } from '@/utils/curveDayType';
import {
  getCurveCache,
  ITIME_STEP_ITEM,
  setCurveCache,
} from '@/utils/24balanceCurveCache';
import { patchCurveData } from '@/utils/curve';
import { debounce } from 'lodash';
import dayjs from 'dayjs';
import PQueue from 'p-queue';
import { useMemo } from 'react';
import { useAccountInfo } from '@/screens/Address/components/MultiAssets/hooks';
import addressBalanceStore, {
  accountsBalanceEvents,
  balanceAccountsStore,
} from '@/store/balance';
import { BaseStore } from './_base';
import { ResourceBaseStore } from './_resourceBase';
import { ResourceLocalTarget } from './_resourceFlowDebug';
import { combineMultiCurve, CurveList, formChartData } from './curveShared';

export type AddressCurveValue = CurveList;
export type AddressCurveTraceContext = {
  scene?: string;
  requester?: string;
  endpoint?: string;
};

type CurveScene = 'Home';

type SceneCurveState = {
  addresses: Record<CurveScene, string[]>;
  combinedData: Record<CurveScene, ReturnType<typeof formChartData>>;
  sceneLoading: Record<CurveScene, boolean>;
  sceneComputing: Record<CurveScene, boolean>;
};

const buildCurveLocalTargets = (address: string): ResourceLocalTarget[] => [
  {
    kind: 'mmkv',
    file: MMKV_FILE_NAMES.DAYCURVE,
    key: address,
  },
];

const buildCurveTraceDetail = (
  detail: Record<string, unknown>,
  trace?: AddressCurveTraceContext,
) => {
  return {
    ...detail,
    scene: trace?.scene,
    requester: trace?.requester,
    endpoint: trace?.endpoint,
  };
};

const normalizeAddress = (address?: string) => address?.toLowerCase() || '';

const normalizeAddresses = (addresses: string[]) =>
  Array.from(new Set(addresses.map(address => address.toLowerCase())));

function normalizeCurveData(curve: ITIME_STEP_ITEM[]) {
  const start = dayjs().add(-24, 'hours').add(10, 'minutes').valueOf();
  const step = 5 * 60 * 1000;
  const result = patchCurveData(
    curve.map(item => {
      return {
        timestamp: item.timestamp * 1000,
        price: item.usd_value,
      };
    }),
    start,
    step,
  );

  return result.map(item => {
    return {
      timestamp: dayjs(item.timestamp).unix(),
      usd_value: item.price,
    };
  });
}

class AddressCurve24hStore extends ResourceBaseStore<AddressCurveValue> {
  constructor() {
    super('addressCurve24h');
  }

  getAddressCurve = (address?: string) => {
    return this.getValue(normalizeAddress(address));
  };

  getAddressCurveMap = () => this.getValueMap();

  getAddressResourceState = (address?: string) => {
    return this.getMeta(normalizeAddress(address));
  };

  getAddressCurveFlowState = (address?: string) => {
    return this.getFlowState(normalizeAddress(address));
  };

  useAddressCurve = (address?: string) => {
    return this.useValue(normalizeAddress(address));
  };

  useAddressCurveMap = () => this.useValueMap();

  useAddressResourceState = (address?: string) => {
    return this.useMeta(normalizeAddress(address));
  };

  useAddressCurveFlowState = (address?: string) => {
    return this.useFlowState(normalizeAddress(address));
  };

  initStore = async () => {
    dayCurveMMKV.getAllKeys().forEach(key => {
      const lowerAddress = normalizeAddress(key);
      const cacheData = getCurveCache(lowerAddress);
      if (!cacheData?.data?.length) {
        return;
      }

      const localTargets = buildCurveLocalTargets(lowerAddress);
      this.markHydrateStarted(lowerAddress, {
        localTargets,
        detail: {
          source: 'initStore',
          updateTime: cacheData.updateTime,
          isExpired: cacheData.isExpired,
        },
      });
      this.applyHydratedValue(
        lowerAddress,
        normalizeCurveData(cacheData.data),
        {
          localTargets,
          detail: {
            source: 'initStore',
            updateTime: cacheData.updateTime,
            isExpired: cacheData.isExpired,
          },
        },
      );
    });
  };

  hydrateAddressCurveFromCache = (address: string) => {
    const lowerAddress = normalizeAddress(address);
    if (!lowerAddress) {
      return null;
    }

    const localTargets = buildCurveLocalTargets(lowerAddress);
    const cacheData = getCurveCache(lowerAddress);
    const existedData = this.getAddressCurve(lowerAddress);
    const shouldHydrate =
      !!cacheData?.data?.length &&
      (!existedData?.length || !cacheData.isExpired);

    this.markHydrateStarted(lowerAddress, {
      localTargets,
      detail: {
        source: 'hydrateAddressCurveFromCache',
        hasMemoryValue: !!existedData?.length,
        hasCache: !!cacheData?.data?.length,
        isExpired: !!cacheData?.isExpired,
      },
    });

    if (shouldHydrate && cacheData?.data) {
      this.applyHydratedValue(
        lowerAddress,
        normalizeCurveData(cacheData.data),
        {
          localTargets,
          detail: {
            source: 'hydrateAddressCurveFromCache',
            updateTime: cacheData.updateTime,
          },
        },
      );
    } else {
      this.markHydrateSkipped(lowerAddress, {
        localTargets,
        detail: {
          source: 'hydrateAddressCurveFromCache',
          hasMemoryValue: !!existedData?.length,
          hasCache: !!cacheData?.data?.length,
          isExpired: !!cacheData?.isExpired,
        },
      });
    }

    return cacheData;
  };

  refreshAddressCurve = makeSWRKeyAsyncFunc(
    async (
      address: string,
      force = false,
      trace?: AddressCurveTraceContext,
    ) => {
      const lowerAddress = normalizeAddress(address);
      if (!lowerAddress) {
        return undefined;
      }

      const localTargets = buildCurveLocalTargets(lowerAddress);
      let requestId: string | undefined;

      try {
        const cacheData = this.hydrateAddressCurveFromCache(lowerAddress);

        if (cacheData?.data?.length && !force && !cacheData.isExpired) {
          return normalizeCurveData(cacheData.data);
        }

        requestId = this.startRemoteFetch(lowerAddress, {
          localTargets,
          detail: buildCurveTraceDetail(
            {
              source: 'refreshAddressCurve',
              force,
            },
            trace,
          ),
        });

        const curve = await openapi.getNetCurve(lowerAddress, 1);
        const normalizedCurve = normalizeCurveData(curve);
        const updateTime = Date.now();
        const applied = this.applyRemoteValue(
          lowerAddress,
          requestId,
          normalizedCurve,
          {
            localTargets,
            detail: buildCurveTraceDetail(
              {
                source: 'refreshAddressCurve',
                force,
                pointCount: curve.length,
              },
              trace,
            ),
          },
        );

        if (!applied) {
          return normalizedCurve;
        }

        this.persistInBackground(
          lowerAddress,
          () =>
            setCurveCache(lowerAddress, {
              data: curve,
              updateTime,
            }),
          {
            requestId,
            localTargets,
            detail: buildCurveTraceDetail(
              {
                source: 'refreshAddressCurve',
                force,
                pointCount: curve.length,
              },
              trace,
            ),
          },
        );

        return normalizedCurve;
      } catch (error) {
        this.markError(lowerAddress, requestId ? 'remote' : 'hydrate', error, {
          requestId,
          localTargets,
          detail: buildCurveTraceDetail(
            {
              source: 'refreshAddressCurve',
              force,
            },
            trace,
          ),
        });
        throw error;
      }
    },
    ctx => {
      const address = normalizeAddress(ctx.args[0]);
      const force = !!ctx.args[1];
      return `refreshAddressCurve-${address}-${force ? 'force' : 'noforce'}`;
    },
  );

  warmupAddressCurve = (
    address: string,
    options?: {
      force?: boolean;
      trace?: AddressCurveTraceContext;
    },
  ) => {
    this.hydrateAddressCurveFromCache(address);

    return this.refreshAddressCurve(
      address,
      options?.force ?? true,
      options?.trace,
    );
  };
}

const sceneQueues: Record<CurveScene, PQueue> = {
  Home: new PQueue({ intervalCap: 10, concurrency: 10, interval: 1000 }),
};

const getDefaultCombinedCurveData = () =>
  formChartData([], {
    realtimeNetWorth: 0,
    realtimeTimestamp: 0,
    type: CurveDayType.DAY,
    staticBalance: 0,
  });

class SceneCurve24hStore extends BaseStore<SceneCurveState> {
  private hasStartedLifecycle = false;

  private readonly debouncedCommitters: Record<CurveScene, () => void> = {
    Home: debounce(() => {
      this.commitSceneCombinedData('Home');
    }, 200),
  };

  constructor() {
    super({
      addresses: {
        Home: [],
      },
      combinedData: {
        Home: getDefaultCombinedCurveData(),
      },
      sceneLoading: {
        Home: false,
      },
      sceneComputing: {
        Home: false,
      },
    });
  }

  private setSceneAddresses(scene: CurveScene, addresses: string[]) {
    const normalized = normalizeAddresses(addresses);
    this.setState(prev => {
      const prevAddresses = prev.addresses[scene] || [];
      const isSame =
        prevAddresses.length === normalized.length &&
        prevAddresses.every((item, index) => item === normalized[index]);

      if (isSame) {
        return prev;
      }

      return {
        addresses: {
          ...prev.addresses,
          [scene]: normalized,
        },
      };
    });
  }

  private setSceneLoading(scene: CurveScene, loading: boolean) {
    this.setState(prev => {
      if (prev.sceneLoading[scene] === loading) {
        return prev;
      }

      return {
        sceneLoading: {
          ...prev.sceneLoading,
          [scene]: loading,
        },
      };
    });
  }

  private setSceneComputing(scene: CurveScene, computing: boolean) {
    this.setState(prev => {
      if (prev.sceneComputing[scene] === computing) {
        return prev;
      }

      return {
        sceneComputing: {
          ...prev.sceneComputing,
          [scene]: computing,
        },
      };
    });
  }

  private commitSceneCombinedData(scene: CurveScene) {
    const addresses = this.getState().addresses[scene];
    const curveMap = addressCurve24hStore.getAddressCurveMap();
    const balanceMap = addressBalanceStore.getAddressValueMap();
    const curveList = addresses
      .map(address => curveMap[address.toLowerCase()])
      .filter((curve): curve is CurveList => !!curve?.length);
    const hasAllCurves =
      addresses.length > 0 &&
      addresses.every(address => !!curveMap[address.toLowerCase()]?.length);
    const totals = addresses.reduce(
      (acc, address) => {
        const balance = balanceMap[address.toLowerCase()];
        acc.total += balance?.totalBalance || 0;
        acc.totalEvm += balance?.evmBalance || 0;
        return acc;
      },
      { total: 0, totalEvm: 0 },
    );

    const combinedData = formChartData(combineMultiCurve(curveList), {
      realtimeNetWorth: hasAllCurves ? totals.totalEvm : 0,
      realtimeTimestamp: hasAllCurves ? Date.now() : 0,
      type: CurveDayType.DAY,
      staticBalance: hasAllCurves ? totals.total : 0,
    });

    this.setState(prev => ({
      combinedData: {
        ...prev.combinedData,
        [scene]: combinedData,
      },
    }));
    this.setSceneComputing(scene, false);
  }

  private scheduleCommit(scene: CurveScene) {
    this.setSceneComputing(scene, true);
    this.debouncedCommitters[scene]();
  }

  hydrateSceneDayCurveFromCache = (scene: CurveScene, addresses: string[]) => {
    const normalized = normalizeAddresses(addresses);
    if (!normalized.length) {
      return;
    }

    this.setSceneAddresses(scene, normalized);
    this.setSceneLoading(scene, false);
    this.scheduleCommit(scene);
  };

  refreshSceneDayCurve = makeSWRKeyAsyncFunc(
    async (
      scene: CurveScene,
      {
        addresses = [],
        force = false,
        reason,
      }: {
        addresses?: string[];
        force?: boolean;
        reason?: 'selection_changed' | 'balance_changed' | 'manual_refresh';
      } = {},
    ) => {
      const normalized = normalizeAddresses(addresses);
      this.setSceneAddresses(scene, normalized);

      if (!normalized.length) {
        this.setSceneLoading(scene, false);
        this.setSceneComputing(scene, false);
        return;
      }

      if (reason === 'balance_changed' && !force) {
        this.scheduleCommit(scene);
        return;
      }

      this.setSceneLoading(scene, true);

      normalized.forEach(address => {
        addressCurve24hStore.hydrateAddressCurveFromCache(address);
      });
      this.scheduleCommit(scene);

      const queue = sceneQueues[scene];
      queue.clear();
      normalized.forEach(address => {
        queue.add(async () => {
          try {
            await addressCurve24hStore.refreshAddressCurve(address, force, {
              scene,
              requester: 'SceneCurve24hStore.refreshSceneDayCurve',
              endpoint: 'openapi.getNetCurve',
            });
          } catch (error) {
            console.error('refreshSceneDayCurve error', error);
          }
        });
      });

      await queue.onIdle();
      this.setSceneLoading(scene, false);
      this.scheduleCommit(scene);
    },
    ctx => {
      const scene = ctx.args[0];
      const addresses = normalizeAddresses(ctx.args[1]?.addresses || []);
      const force = !!ctx.args[1]?.force;
      return `refreshSceneDayCurve-${scene}-${addresses.join(',')}-${
        force ? 'force' : 'noforce'
      }`;
    },
  );

  useSceneDayCurveData = (scene: CurveScene) => {
    const dayCurveData = this.useStore(s => s.combinedData[scene]);

    return { dayCurveData };
  };

  useSceneIsAnyAddrLoading = (scene: CurveScene, addresses: string[]) => {
    const normalized = useMemo(
      () => normalizeAddresses(addresses),
      [addresses],
    );
    const flow = addressCurve24hStore.useFamilyFlowState(normalized);
    const sceneLoading = this.useStore(s => s.sceneLoading[scene]);

    return useMemo(
      () => ({
        isAnyAddrLoading: flow.isAnyLoading || sceneLoading,
      }),
      [flow.isAnyLoading, sceneLoading],
    );
  };

  startLifecycle = () => {
    if (this.hasStartedLifecycle) {
      return;
    }
    this.hasStartedLifecycle = true;

    addressCurve24hStore.subscribe(() => {
      const addresses = this.getState().addresses.Home;
      if (!addresses.length) {
        return;
      }
      this.scheduleCommit('Home');
    });

    addressBalanceStore.subscribe(() => {
      const addresses = this.getState().addresses.Home;
      if (!addresses.length) {
        return;
      }
      this.scheduleCommit('Home');
    });

    accountsBalanceEvents.on('SELECTION_CHANGED', ({ nextAddresses }) => {
      refreshDayCurve({
        addresses: nextAddresses,
        reason: 'selection_changed',
      });
    });
  };
}

export const addressCurve24hStore = new AddressCurve24hStore();
export const sceneCurve24hStore = new SceneCurve24hStore();

const curve24hInitStateRef = {
  promise: null as Promise<void> | null,
};

export async function initCurve24hStore() {
  if (curve24hInitStateRef.promise) {
    return curve24hInitStateRef.promise;
  }

  const promise = addressCurve24hStore.initStore();
  curve24hInitStateRef.promise = promise;
  await promise;
}

export const refreshDayCurve = makeSWRKeyAsyncFunc(
  async ({
    addresses,
    force = false,
    balanceAccounts,
    reason,
  }: {
    addresses?: string[];
    force?: boolean;
    balanceAccounts?: Record<string, unknown>;
    reason?: 'selection_changed' | 'balance_changed' | 'manual_refresh';
  } = {}) => {
    const finalAddresses =
      addresses ||
      (balanceAccounts ? Object.keys(balanceAccounts) : undefined) ||
      balanceAccountsStore.getState().selectedAddresses ||
      [];

    return sceneCurve24hStore.refreshSceneDayCurve('Home', {
      addresses: finalAddresses,
      force,
      reason,
    });
  },
  ctx => {
    const force = !!ctx.args[0]?.force;
    const addresses = normalizeAddresses(ctx.args[0]?.addresses || []);
    return `refreshDayCurve-${addresses.join(',')}-${
      force ? 'force' : 'noforce'
    }`;
  },
);

export function hydrateCachedHomeDayCurve() {
  const cachedAddresses = balanceAccountsStore.getState().selectedAddresses;

  sceneCurve24hStore.hydrateSceneDayCurveFromCache('Home', cachedAddresses);
}

export function startProcessMultiCurveEvents() {
  sceneCurve24hStore.startLifecycle();

  const cachedAddresses = balanceAccountsStore.getState().selectedAddresses;
  if (cachedAddresses.length) {
    sceneCurve24hStore.hydrateSceneDayCurveFromCache('Home', cachedAddresses);
  }
}

export const useMultiDayCurve = () => {
  return sceneCurve24hStore.useSceneDayCurveData('Home');
};

export const useMultiCurveIsAnyAddrLoading = () => {
  const { myTop10Addresses } = useAccountInfo();
  const selectedAddresses = balanceAccountsStore(s => s.selectedAddresses);
  const displayAddresses = useMemo(() => {
    return selectedAddresses.length ? selectedAddresses : myTop10Addresses;
  }, [myTop10Addresses, selectedAddresses]);

  return sceneCurve24hStore.useSceneIsAnyAddrLoading('Home', displayAddresses);
};
