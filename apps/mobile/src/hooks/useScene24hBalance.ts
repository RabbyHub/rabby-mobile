import {
  getBalance24hCache,
  get24hBalance,
  IBalance24hData,
} from '@/utils/24hBalanceCache';
import { useMemo } from 'react';
import { formatSmallUsdValue } from '@/hooks/useCurve';
import PQueue from 'p-queue';
import { formatUsdValue } from '@/utils/number';
import { zCreate } from '@/core/utils/reexports';
import {
  resolveValFromUpdater,
  runIIFEFunc,
  UpdaterOrPartials,
} from '@/core/utils/store';
import {
  AccountsBalanceState,
  apisAccountsBalance,
  BalanceAccountType,
  fetchTotalBalance,
} from '@/hooks/useAccountsBalance';
import { makeSWRKeyAsyncFunc } from '@/core/utils/concurrency';
import { useShallow } from 'zustand/react/shallow';
import { perfEvents } from '@/core/utils/perf';
import { accountEvents, getTop10MyAccounts } from '@/core/apis/account';
import { keyringService } from '@/core/services';
import { debounce } from 'lodash';

const queues: Record<BalanceScene, PQueue> = {
  Home: new PQueue({ intervalCap: 10, concurrency: 10, interval: 1000 }),
};
const TEN_MINUTES = 10 * 60 * 1000;

type Multi24hBalance = {
  [P: string]: IBalance24hData['data'] & {
    updateTime: IBalance24hData['updateTime'];
  };
};
type BalanceScene = 'Home';
export type Multi24hBalanceState = {
  addresses: Record<BalanceScene, string[]>;
  combinedData: Record<
    BalanceScene,
    ReturnType<typeof computeCombined24hBalanceData>
  >;
  multi24hBalance: Multi24hBalance;
  sceneLoading: Record<BalanceScene, boolean>;
  sceneAddrLoading: Record<`${BalanceScene}-${string}`, boolean>;
};

const scene24hBalanceStore = zCreate<Multi24hBalanceState>(() => ({
  addresses: {
    Home: [],
  },
  sceneLoading: {
    Home: false,
  },
  sceneAddrLoading: {},
  multi24hBalance: {},
  combinedData: {
    Home: computeCombined24hBalanceData({
      addresses: [],
      multi24hBalance: {},
      totalEvmBalance: 0,
      totalBalance: 0,
    }),
  },
}));

function setSceneAddresses<T extends BalanceScene>(
  scene: T,
  valOrFunc: UpdaterOrPartials<Multi24hBalanceState['addresses'][T]>,
) {
  scene24hBalanceStore.setState(prev => {
    const { newVal, changed } = resolveValFromUpdater(
      prev.addresses[scene],
      valOrFunc,
      { strict: true },
    );
    if (!changed) return prev;

    newVal.sort();

    return { ...prev, addresses: { ...prev.addresses, [scene]: newVal } };
  });
}

function setSceneLoading<T extends BalanceScene>(
  scene: T,
  valOrFunc: UpdaterOrPartials<boolean>,
) {
  scene24hBalanceStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(
      prev.sceneLoading[scene],
      valOrFunc,
    );

    return {
      ...prev,
      sceneLoading: { ...prev.sceneLoading, [scene]: newVal },
    };
  });
}

function setSceneAddrLoading<T extends BalanceScene>(
  scene: T,
  addr: string | string[],
  valOrFunc: UpdaterOrPartials<boolean>,
) {
  const addrs = Array.isArray(addr) ? addr : [addr];
  scene24hBalanceStore.setState(prev => {
    const newVal = { ...prev.sceneAddrLoading };
    addrs.forEach(a => {
      const key = `${scene}-${a}`;
      const { newVal: loadingVal } = resolveValFromUpdater(
        prev.sceneAddrLoading[key] as boolean,
        valOrFunc,
      );
      newVal[key] = loadingVal;
    });

    return newVal;
  });
}

function setMulti24hBalance(
  address: string,
  valOrFunc: UpdaterOrPartials<
    Multi24hBalanceState['multi24hBalance'][string] | undefined
  >,
) {
  scene24hBalanceStore.setState(prev => {
    const { newVal, changed } = resolveValFromUpdater(
      prev.multi24hBalance[address],
      valOrFunc,
      { strict: true },
    );

    if (!changed || !newVal) {
      return prev;
    }

    return {
      ...prev,
      multi24hBalance: { ...prev.multi24hBalance, [address]: newVal },
    };
  });
}

export function getMulti24hBalanceBy(address: string) {
  return scene24hBalanceStore.getState().multi24hBalance[address];
}

function onComputedSceneCombinedData<T extends BalanceScene>(
  scene: T,
  input: {
    totalEvmBalance: number;
    totalBalance: number;
  },
) {
  const states = scene24hBalanceStore.getState();
  const addresses = states.addresses[scene];
  const multi24hBalance = states.multi24hBalance;

  const combinedData = computeCombined24hBalanceData({
    addresses,
    multi24hBalance,
    totalEvmBalance: input.totalEvmBalance,
    totalBalance: input.totalBalance,
  });

  scene24hBalanceStore.setState(prev => ({
    ...prev,
    combinedData: {
      ...prev.combinedData,
      [scene]: combinedData,
    },
  }));

  perfEvents.emit('SCENE_24H_BALANCE_UPDATED', {
    scene: scene,
    combinedData: combinedData,
  });
}

const waitQueueFinished = (q: PQueue) => {
  return new Promise(resolve => {
    q.on('idle', () => {
      resolve(null);
    });
  });
};

const sceneLastLoadingRef: Record<BalanceScene, number> = {
  Home: 0,
};

export type FetchTotalBalanceOptions = {
  addresses?: string | string[];
  force?: boolean;
  totals?: ReturnType<typeof apisAccountsBalance.getLatestTotalBalance>;
};
const refreshCombinedDataForScene = makeSWRKeyAsyncFunc(
  async (scene: BalanceScene, options?: FetchTotalBalanceOptions) => {
    let { addresses, force = false } = options || {};
    if (!addresses?.length) {
      addresses = (await getTop10MyAccounts()).top10Addresses;
    }
    const address = Array.isArray(addresses) ? addresses : [addresses];
    setSceneAddresses(scene, address);

    const totals =
      options?.totals || apisAccountsBalance.getLatestTotalBalance(address);
    const queue = queues[scene];

    function beforeReturn() {
      onComputedSceneCombinedData(scene, {
        totalEvmBalance: totals.totalEvm,
        totalBalance: totals.total,
      });
    }

    try {
      if (!address.length) {
        setSceneLoading(scene, false);
        return;
      }
      if (!force) {
        const now = Date.now();
        if (now - sceneLastLoadingRef[scene] < TEN_MINUTES) {
          beforeReturn();
          return;
        }
        sceneLastLoadingRef[scene] = now;
      } else {
        sceneLastLoadingRef[scene] = Date.now();
      }
      setSceneLoading(scene, !!force);
      beforeReturn();
      const nextCheckAddress = new Set([...address]);
      !force &&
        address.forEach(_addr => {
          const addr = _addr.toLowerCase();
          setSceneAddrLoading(scene, addr, true);
          const cacheData = getBalance24hCache(addr);
          const existedData = !!getMulti24hBalanceBy(addr);
          if (!existedData && cacheData?.data)
            setMulti24hBalance(addr, {
              ...cacheData.data,
              updateTime: cacheData.updateTime,
            });
          if (!cacheData?.data || cacheData?.isExpired) {
            return;
          }
          nextCheckAddress.delete(addr);
          setMulti24hBalance(addr, {
            ...cacheData.data,
            updateTime: cacheData.updateTime,
          });
        });
      beforeReturn();
      queue.clear();
      Array.from(nextCheckAddress).forEach(_addr => {
        const addr = _addr.toLowerCase();
        queue.add(async () => {
          setSceneAddrLoading(scene, addr, true);
          try {
            const address24hBalance = await get24hBalance(addr, force);
            setMulti24hBalance(addr, {
              ...address24hBalance.data,
              updateTime: address24hBalance.updateTime,
            });
          } catch (error) {
            console.error('Fetch curve error', error);
          } finally {
            sceneLastLoadingRef[scene][addr] = false;
            setSceneAddrLoading(scene, addr, false);
          }
        });
      });
      await waitQueueFinished(queue);
      setSceneLoading(scene, false);
    } catch (error) {
      console.error('Fetch curve error', error);
      setSceneLoading(scene, false);
    } finally {
      beforeReturn();
    }
  },
  ctx => {
    const scene = ctx.args[0];
    const { addresses: addrList, force } = ctx.args[1] || {};
    const addresses = Array.isArray(addrList) ? addrList : [addrList];
    addresses.sort();
    return `refreshCombinedDataForScene-${scene}-${addresses.join(',')}-${
      force ? 'force' : 'noforce'
    }`;
  },
);

export const refresh24hAssets = async ({
  force = false,
  balanceAccounts,
}: {
  force?: boolean;
  balanceAccounts?: AccountsBalanceState['balance'];
} = {}) => {
  const { top10Addresses } = await getTop10MyAccounts();

  refreshCombinedDataForScene('Home', {
    addresses: top10Addresses,
    force,
    ...(balanceAccounts?.length && {
      totals: apisAccountsBalance.computeTotalBalance(
        top10Addresses,
        balanceAccounts || {},
      ),
    }),
  });
};

export function startProcessScene24hBalanceEvents() {
  perfEvents.subscribe('USER_MANUALLY_UNLOCK', async () => {
    const balanceAccounts = await fetchTotalBalance('from_cache');
    await refresh24hAssets({ balanceAccounts });
  });

  perfEvents.subscribe('ACCOUNTS_BALANCE_UPDATE', async data => {
    await refresh24hAssets({
      balanceAccounts: data.nextState,
    });
  });

  accountEvents.on(
    'ACCOUNT_ADDED',
    debounce(async ({ accounts, scene }) => {
      const balanceAccounts = await fetchTotalBalance('from_cache');
      await refresh24hAssets({ balanceAccounts, force: true });
    }, 500),
  );

  accountEvents.on(
    'ACCOUNT_REMOVED',
    debounce(async ({ removedAccounts }) => {
      const balanceAccounts = await fetchTotalBalance('from_cache');
      await refresh24hAssets({ balanceAccounts, force: true });
    }, 500),
  );
}

export function useScene24hBalanceCombinedData(scene: BalanceScene) {
  const combinedData = scene24hBalanceStore(s => s.combinedData[scene]);

  return { combinedData };
}

export function useMultiHome24hBalanceCurveChart() {
  const combinedData = scene24hBalanceStore(
    useShallow(s => {
      const sceneData = s.combinedData['Home'];

      return {
        rawNetWorth: sceneData.rawNetWorth,
        rawChange: sceneData.rawChange,
        changePercent: sceneData.changePercent,
        isLoss: sceneData.isLoss,
      };
    }),
  );

  return { combinedData };
}

export function useScene24hBalanceMulti24hBalance(scene: BalanceScene) {
  const addresses = scene24hBalanceStore(s => s.addresses[scene]);
  const multi24hBalance = scene24hBalanceStore(s => s.multi24hBalance);

  const filteredMulti24hBalance = useMemo(() => {
    const res: Multi24hBalance = {};
    addresses.forEach(address => {
      const addr = address.toLowerCase();
      if (multi24hBalance[addr]) {
        res[addr] = multi24hBalance[addr];
      }
    });
    return res;
  }, [addresses, multi24hBalance]);

  return { multi24hBalance: filteredMulti24hBalance };
}

export function useSceneIsLoading(scene: BalanceScene) {
  const isLoading = scene24hBalanceStore(s => s.sceneLoading[scene]);

  return { isLoading };
}

export function useSceneIsLoadingNew(scene: BalanceScene) {
  const addresses = scene24hBalanceStore(s => s.addresses[scene]);
  const multi24hBalance = scene24hBalanceStore(s => s.multi24hBalance);

  const isLoadingNew = useMemo(() => {
    if (addresses.length === 0) {
      return false;
    }
    return !!addresses?.every(address => {
      return !multi24hBalance[address.toLowerCase()];
    });
  }, [addresses, multi24hBalance]);

  return { isLoadingNew };
}

export function useScene24hBalanceLightWeightData(scene: BalanceScene) {
  const sceneData = scene24hBalanceStore(
    useShallow(s => {
      const sceneData = s.combinedData[scene];

      return {
        netWorth: sceneData.netWorth,
        isLoss: sceneData.isLoss,
      };
    }),
  );

  return sceneData;
}

function computeCombined24hBalanceData(input: {
  addresses: string[];
  multi24hBalance: Multi24hBalance;
  totalEvmBalance: number;
  totalBalance: number;
}) {
  const { addresses, multi24hBalance, totalEvmBalance, totalBalance } = input;

  const list = addresses.map(address => {
    const data = multi24hBalance[address.toLowerCase()];
    return data;
  });
  const isAllGet = list.length === addresses.length;
  const total24hBalance = list.reduce((res, item) => {
    return res + (item?.total_usd_value || 0);
  }, 0);
  const assetsChange = (totalEvmBalance || 0) - total24hBalance;
  const rawNetWorth = isAllGet ? totalBalance || 0 : 0;

  return {
    list,
    rawNetWorth,
    netWorth: formatSmallUsdValue(totalBalance || 0),
    rawChange: assetsChange,
    change: `${formatUsdValue(Math.abs(assetsChange))}`,
    changePercent:
      total24hBalance !== 0
        ? `${Math.abs((assetsChange * 100) / total24hBalance).toFixed(2)}%`
        : `${totalEvmBalance === 0 ? '0' : '100.00'}%`,
    isLoss: assetsChange < 0,
    isEmptyAssets: total24hBalance === 0 && totalEvmBalance === 0,
  };
}
