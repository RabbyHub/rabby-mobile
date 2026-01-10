import {
  getCurveCache,
  getNetCurve,
  ITIME_STEP_ITEM,
} from '@/utils/24balanceCurveCache';
import { patchCurveData } from '@/utils/curve';
import dayjs from 'dayjs';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { formChartData } from './useCurve';
import PQueue from 'p-queue';
// import { atom, useAtom } from 'jotai';
import { CurveDayType } from '@/utils/curveDayType';
import { useCreationWithShallowCompare } from './common/useMemozied';
import { zCreate, zMutative } from '@/core/utils/reexports';
import { useAccountInfo } from '@/screens/Address/components/MultiAssets/hooks';
import useAccountsBalance, {
  AccountsBalanceState,
  apisAccountsBalance,
  fetchTotalBalance,
} from './useAccountsBalance';
import { debounce } from 'lodash';
import { runIIFEFunc } from '@/core/utils/store';
import { accountEvents, getTop10MyAccounts } from '@/core/apis/account';
import { perfEvents } from '@/core/utils/perf';
import { keyringService } from '@/core/services';
import { makeSWRKeyAsyncFunc } from '@/core/utils/concurrency';

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
  const state = multiCurveStore.getState();
  return state.timestamps;
}

const waitQueueFinished = (q: PQueue) => {
  return new Promise(resolve => {
    q.on('idle', () => {
      resolve(null);
    });
  });
};

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
          const curve = cacheData.data;
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
          nextCheckAddress.delete(addr);
          setAddrLoading(addr, false);
          setMultiTimeStamp(
            addr,
            result.map(item => {
              return {
                timestamp: dayjs(item.timestamp).unix(),
                usd_value: item.price,
              };
            }),
          );
        });
      }
      queue.clear();
      Array.from(nextCheckAddress).forEach(address => {
        const addr = address.toLowerCase();
        queue.add(async () => {
          setAddrLoading(addr, true);
          try {
            const curve = await getNetCurve(addr, CurveDayType.DAY, force);
            const start = dayjs()
              .add(-24, 'hours')
              .add(10, 'minutes')
              .valueOf();
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
            setAddrLoading(addr, false);
            setMultiTimeStamp(
              addr,
              result.map(item => {
                return {
                  timestamp: dayjs(item.timestamp).unix(),
                  usd_value: item.price,
                };
              }),
            );
          } catch (error) {
            console.error('Fetch curve error', error);
          } finally {
            loadingMapRef[addr] = false;
          }
        });
      });
      if (queue.size) await waitQueueFinished(queue);
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

      if (data && data?.length > 0) {
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

export const refreshDayCurve = makeSWRKeyAsyncFunc(
  async ({
    force = false,
    balanceAccounts,
  }: {
    force?: boolean;
    balanceAccounts?: AccountsBalanceState['balance'];
  } = {}) => {
    const { top10Addresses } = await getTop10MyAccounts();

    try {
      await fetchData(top10Addresses, force);
    } catch (error) {
      console.error('refreshDayCurve fetchData error', error);
    }

    const multiTimeStamp = getMultiTimeStamp();
    const totals = apisAccountsBalance.computeTotalBalance(
      top10Addresses,
      balanceAccounts,
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
    const addresses = Object.keys(ctx.args[0]?.balanceAccounts || {});
    return `refresh-multi-day-curve-force-${force}-addrs-${addresses
      .sort()
      .join(',')}`;
  },
);

export function startProcessMultiCurveEvents() {
  perfEvents.subscribe('USER_MANUALLY_UNLOCK', async () => {
    const balanceAccounts = await fetchTotalBalance('from_cache');
    await refreshDayCurve({ balanceAccounts });
  });

  perfEvents.subscribe('ACCOUNTS_BALANCE_UPDATE', async data => {
    await refreshDayCurve({
      balanceAccounts: data.nextState,
    });
  });

  accountEvents.on(
    'ACCOUNT_ADDED',
    debounce(async ({ accounts, scene }) => {
      const balanceAccounts = await fetchTotalBalance('from_cache');
      await refreshDayCurve({ balanceAccounts, force: true });
    }, 500),
  );

  accountEvents.on(
    'ACCOUNT_REMOVED',
    debounce(async ({ removedAccounts }) => {
      const balanceAccounts = await fetchTotalBalance('from_cache');
      await refreshDayCurve({ balanceAccounts, force: true });
    }, 500),
  );
}

export const useMultiDayCurve = () => {
  const dayCurveData = computedStore(state => state.combinedData);

  return {
    dayCurveData,
  };
};

export const useMultiCurveIsAnyAddrLoading = () => {
  const { myTop10Addresses } = useAccountInfo();

  const isAnyAddrLoading = multiCurveStore(s => {
    return myTop10Addresses.some(
      address => s.addrLoading[address.toLowerCase()],
    );
  });

  return { isAnyAddrLoading };
};
