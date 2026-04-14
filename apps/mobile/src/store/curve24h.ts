import {
  getCurveCache,
  getNetCurve,
  ITIME_STEP_ITEM,
} from '@/utils/24balanceCurveCache';
import { patchCurveData } from '@/utils/curve';
import dayjs from 'dayjs';
import PQueue from 'p-queue';
import { CurveDayType } from '@/utils/curveDayType';
import { zCreate, zMutative } from '@/core/utils/reexports';
import { useAccountInfo } from '@/screens/Address/components/MultiAssets/hooks';
import {
  AccountsBalanceState,
  accountsBalanceEvents,
  balanceAccountsStore,
} from '@/store/balance';
import addressBalanceStore from '@/store/balance';
import { debounce } from 'lodash';
import { getTop10MyAccounts } from '@/core/apis/account';
import { makeSWRKeyAsyncFunc } from '@/core/utils/concurrency';
import { formChartData } from '@/hooks/useCurve';
import { dayCurveMMKV } from '@/core/storage/mmkvInstances';
import { useMemo } from 'react';

const queue = new PQueue({ intervalCap: 10, concurrency: 10, interval: 1000 });

type MultiCurveState = {
  timestamps: Record<string, ITIME_STEP_ITEM[]>;
  addrLoading: Record<string, boolean>;
  loading: boolean;
};

const multiCurveStore = zCreate(
  zMutative<MultiCurveState>(() => ({
    timestamps: {},
    addrLoading: {},
    loading: true,
  })),
);

const curve24hInitStateRef = {
  promise: null as Promise<void> | null,
};

/** @deprecated */
function setLoading(loading: boolean) {
  multiCurveStore.setState(state => {
    state.loading = loading;
  });
}

function setAddrLoading(address: string, loading: boolean) {
  const lcAddress = address.toLowerCase();
  multiCurveStore.setState(state => {
    state.addrLoading[lcAddress] = loading;
  });
}

function setMultiTimeStamp(address: string, data: ITIME_STEP_ITEM[]) {
  const lcAddress = address.toLowerCase();
  multiCurveStore.setState(state => {
    state.timestamps[lcAddress] = data;
  });
}

function getMultiTimeStamp() {
  return multiCurveStore.getState().timestamps;
}

const waitQueueFinished = (q: PQueue) => q.onIdle();

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

const combineMulitCurve = (timeStamps: ITIME_STEP_ITEM[][]) => {
  if (!timeStamps.length) {
    return [];
  }

  const startTime = timeStamps[0]?.[0]?.timestamp ?? 0;
  const interval = 30 * 60;
  const windows: ITIME_STEP_ITEM[] = Array(48)
    .fill(null)
    .map((_, index) => ({
      timestamp: startTime + index * interval,
      usd_value: 0,
    }));

  const result = windows.map(window => {
    const windowStart = window.timestamp;
    const windowEnd = windowStart + interval;
    let sum = 0;
    let count = 0;

    timeStamps.forEach(addressData => {
      const pointsInWindow = addressData.filter(
        point => point.timestamp >= windowStart && point.timestamp < windowEnd,
      );

      if (pointsInWindow.length > 0) {
        const latestPoint = pointsInWindow.reduce((latest, current) =>
          current.timestamp > latest.timestamp ? current : latest,
        );
        sum += latestPoint.usd_value;
        count++;
      }
    });

    return {
      timestamp: windowEnd,
      usd_value: count > 0 ? sum : 0,
    };
  });

  const firstPoints = timeStamps.map(data => data[0]);
  const lastPoints = timeStamps.map(data => data[data.length - 1]);

  const firstSum = firstPoints.reduce(
    (sum, point) => sum + (point?.usd_value ?? 0),
    0,
  );
  const lastSum = lastPoints.reduce(
    (sum, point) => sum + (point?.usd_value ?? 0),
    0,
  );

  result[0] = {
    timestamp: startTime,
    usd_value: firstSum,
  };

  result[result.length - 1] = {
    timestamp: startTime + (48 - 1) * interval,
    usd_value: lastSum,
  };

  return result;
};

const loadingMapRef: Record<string, boolean> = {};

const fetchData = makeSWRKeyAsyncFunc(
  async (addresses: string[], force = false) => {
    try {
      if (!addresses.length) {
        setLoading(false);
        return;
      }
      setLoading(!!force);
      const nextCheckAddress = new Set([...addresses]);
      if (!force) {
        addresses.forEach(address => {
          const addr = address.toLowerCase();
          setAddrLoading(addr, true);
          const cacheData = getCurveCache(addr);
          if (!cacheData?.data || cacheData?.isExpired) {
            return;
          }
          nextCheckAddress.delete(addr);
          setAddrLoading(addr, false);
          setMultiTimeStamp(addr, normalizeCurveData(cacheData.data));
        });
      }
      queue.clear();
      Array.from(nextCheckAddress).forEach(address => {
        const addr = address.toLowerCase();
        queue.add(async () => {
          setAddrLoading(addr, true);
          try {
            const curve = await getNetCurve(addr, CurveDayType.DAY, force);
            setMultiTimeStamp(addr, normalizeCurveData(curve));
          } catch (error) {
            console.error('Fetch curve error', error);
          } finally {
            setAddrLoading(addr, false);
            loadingMapRef[addr] = false;
          }
        });
      });
      if (nextCheckAddress.size) {
        await waitQueueFinished(queue);
      }
      setLoading(false);
    } catch (error) {
      console.error('Fetch curve error', error);
      setLoading(false);
    }

    return getMultiTimeStamp();
  },
  ctx => {
    const addresses: string[] = ctx.args[0];
    const force: boolean = ctx.args[1] || false;
    return `fetch-multi-curve-${addresses.sort().join(',')}-force-${force}`;
  },
);

function getDefaultCombineData() {
  return formChartData([], {
    realtimeNetWorth: 0,
    realtimeTimestamp: 0,
    type: CurveDayType.DAY,
    staticBalance: 0,
  });
}

const computedStore = zCreate<{
  combinedData: ReturnType<typeof formChartData>;
}>(() => ({
  combinedData: getDefaultCombineData(),
}));

const onComputeCombineData = debounce(
  (input: {
    addresses: string[];
    multiTimeStamp: Record<string, ITIME_STEP_ITEM[]>;
    totalEvmBalance?: number;
    totalBalance?: number;
  }) => {
    const { addresses, multiTimeStamp, totalEvmBalance, totalBalance } = input;
    const list: ITIME_STEP_ITEM[][] = [];
    addresses.forEach(address => {
      const data = multiTimeStamp[address.toLowerCase()];

      if (data && data.length > 0) {
        list.push(data);
      }
    });
    const isAllGet = list.length === addresses.length;
    const result = formChartData(combineMulitCurve(list), {
      realtimeNetWorth: isAllGet ? totalEvmBalance || 0 : 0,
      realtimeTimestamp: isAllGet ? new Date().getTime() : 0,
      type: CurveDayType.DAY,
      staticBalance: isAllGet ? totalBalance || 0 : 0,
    });

    computedStore.setState(prev => {
      return {
        ...prev,
        combinedData: result,
      };
    });
  },
  200,
);

export async function initCurve24hStore() {
  if (curve24hInitStateRef.promise) {
    return curve24hInitStateRef.promise;
  }

  const promise = Promise.resolve().then(() => {
    dayCurveMMKV.getAllKeys().forEach(key => {
      const cacheData = getCurveCache(key);
      if (!cacheData?.data?.length) {
        return;
      }
      setMultiTimeStamp(key, normalizeCurveData(cacheData.data));
    });
    setLoading(false);
  });

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
    balanceAccounts?: AccountsBalanceState['balance'];
    reason?: 'selection_changed' | 'balance_changed' | 'manual_refresh';
  } = {}) => {
    const top10Addresses =
      addresses ||
      (balanceAccounts && Object.keys(balanceAccounts).length
        ? Object.keys(balanceAccounts)
        : (await getTop10MyAccounts()).top10Addresses);
    if (reason !== 'balance_changed' || force) {
      try {
        await fetchData(top10Addresses, force);
      } catch (error) {
        console.error('refreshDayCurve fetchData error', error);
      }
    }

    const multiTimeStamp = getMultiTimeStamp();
    const totals = addressBalanceStore.computeTotalBalance(
      top10Addresses,
      balanceAccountsStore.getState().balance,
    );

    onComputeCombineData({
      addresses: top10Addresses,
      multiTimeStamp,
      totalBalance: totals.total,
      totalEvmBalance: totals.totalEvm,
    });
  },
  ctx => {
    const force: boolean = ctx.args[0]?.force || false;
    const addresses = (ctx.args[0]?.addresses ||
      Object.keys(ctx.args[0]?.balanceAccounts || {})) as string[];
    return `refresh-multi-day-curve-force-${force}-addrs-${addresses
      .sort()
      .join(',')}`;
  },
);

export function startProcessMultiCurveEvents() {
  accountsBalanceEvents.on(
    'SELECTION_CHANGED',
    ({ nextAddresses, balance }) => {
      refreshDayCurve({
        addresses: nextAddresses,
        balanceAccounts: balance,
        reason: 'selection_changed',
      });
    },
  );

  accountsBalanceEvents.on('BALANCE_CHANGED', ({ addresses, balance }) => {
    refreshDayCurve({
      addresses,
      balanceAccounts: balance,
      reason: 'balance_changed',
    });
  });
}

export const useMultiDayCurve = () => {
  const dayCurveData = computedStore(state => state.combinedData);

  return {
    dayCurveData,
  };
};

export const useMultiCurveIsAnyAddrLoading = () => {
  const { myTop10Addresses } = useAccountInfo();
  const selectedAddresses = balanceAccountsStore(s => s.selectedAddresses);
  const displayAddresses = useMemo(() => {
    return selectedAddresses.length ? selectedAddresses : myTop10Addresses;
  }, [myTop10Addresses, selectedAddresses]);

  const isAnyAddrLoading = multiCurveStore(s => {
    return displayAddresses.some(
      address => s.addrLoading[address.toLowerCase()],
    );
  });

  return { isAnyAddrLoading };
};
