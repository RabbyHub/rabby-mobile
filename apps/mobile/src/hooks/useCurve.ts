import { getNetCurve } from '@/utils/24balanceCurveCache';
import { patchCurveData } from '@/utils/curve';
import { CurveDayType } from '@/utils/curveDayType';
import {
  coerceFloat,
  formatCurrency,
  formatUsdValue,
  isMeaningfulNumber,
  splitNumberByStep,
} from '@/utils/number';
import dayjs from 'dayjs';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import { USD_CURRENCY } from '@/constant/currency';
import BigNumber from 'bignumber.js';
import { CurrencyItem } from '@rabby-wallet/rabby-api/dist/types';
import { zCreate } from '@/core/utils/reexports';
import { resolveValFromUpdater, UpdaterOrPartials } from '@/core/utils/store';
import useCachedValue from '@/hooks/common/useCachedValue';
import { perfEvents } from '@/core/utils/perf';

type CurveList = Array<{ timestamp: number; usd_value: number }>;

export type CurvePoint = {
  value: number;
  netWorth: string;
  change: string;
  rawChange: number;
  isLoss: boolean;
  changePercent: string;
  timestamp: number;
  dateString: string;
  clockTimeString: string;
  dateTimeString: string;
};

export const formatSmallUsdValue = (value: number) => {
  if (!value) {
    return '$0';
  }
  if (value < 0.01) {
    return '<$0.01';
  }
  if (value <= 10) {
    return `$${splitNumberByStep(value.toFixed(2))}`;
  }
  return formatUsdValue(value, value > 1000000 ? 2 : 0, true);
};

export const formatSmallCurrencyValue = (
  value: number,
  options?: {
    currency?: CurrencyItem;
  },
) => {
  const { currency = USD_CURRENCY } = options || {};
  const val = new BigNumber(value).times(currency.usd_rate);
  if (val.isZero() || val.isNaN()) {
    return `${currency.symbol}0`;
  }

  if (val.isLessThan(0.01)) {
    return `<${currency.symbol}0.01`;
  }
  if (val.isLessThanOrEqualTo(10)) {
    return `${currency.symbol}${splitNumberByStep(val.toFixed(2))}`;
  }
  return formatCurrency(value, {
    decimal: val.isGreaterThan(1000000) ? 2 : 0,
    formatMillion: true,
    currency,
  });
};

const EXPECTED_CHECK_DIFF = 600;

export const formChartData = (
  data: CurveList,
  realtimeNetWorth = 0,
  realtimeTimestamp?: number,
  type = CurveDayType.DAY,
  staticBalance?: number | null,
) => {
  const startData = data[0] || { value: 0, timestamp: 0, usd_value: 0 };
  const startUsdValue = coerceFloat(startData.usd_value, 0);
  const step = type === CurveDayType.DAY ? 30 * 60 : 3 * 60 * 60;
  const list =
    data
      ?.reduce((acc: CurveList, curr) => {
        if (acc.length === 0) {
          return [curr];
        }
        const lastItem = acc[acc.length - 1];
        if (lastItem) {
          if (curr.timestamp - lastItem.timestamp >= step) {
            acc.push(curr);
          }
        } else {
          acc.push(curr);
        }
        return acc;
      }, [])
      .map(x => {
        const change = x.usd_value - startUsdValue;

        return {
          value: x.usd_value || 0,
          netWorth: formatSmallUsdValue(x.usd_value),
          change: `${formatUsdValue(Math.abs(change))}`,
          rawChange: Math.abs(change),
          isLoss: change < 0,
          changePercent:
            startUsdValue === 0
              ? `${x.usd_value === 0 ? '0' : '100.00'}%`
              : `${(Math.abs(change * 100) / startUsdValue).toFixed(2)}%`,
          timestamp: x.timestamp,
          dateString: dayjs.unix(x.timestamp).format('MM DD, HH:mm'),
          clockTimeString: dayjs.unix(x.timestamp).format('HH:mm'),
          dateTimeString: dayjs.unix(x.timestamp).format('MM DD, HH:mm'),
        };
      }) || [];

  // patch realtime newworth
  if (realtimeTimestamp) {
    const realtimeChange = realtimeNetWorth - startUsdValue;

    list.push({
      value: realtimeNetWorth || 0,
      netWorth: formatSmallUsdValue(realtimeNetWorth),
      change: `${formatUsdValue(Math.abs(realtimeChange))}`,
      rawChange: Math.abs(realtimeChange),
      isLoss: realtimeChange < 0,
      changePercent:
        startUsdValue === 0
          ? `${realtimeNetWorth === 0 ? '0' : '100.00'}%`
          : `${(Math.abs(realtimeChange * 100) / startUsdValue).toFixed(2)}%`,
      timestamp: Math.floor(realtimeTimestamp / 1000),
      dateString: dayjs.unix(realtimeTimestamp / 1000).format('MM DD, HH:mm'),
      clockTimeString: dayjs.unix(realtimeTimestamp / 1000).format('HH:mm'),
      dateTimeString: dayjs
        .unix(realtimeTimestamp / 1000)
        .format('MM DD, HH:mm'),
    });
  }

  const endNetWorth = list?.length ? list[list.length - 1]?.value : 0;
  const assetsChange = endNetWorth - startUsdValue;
  const isEmptyAssets = endNetWorth === 0 && startUsdValue === 0;

  return {
    list,
    rawNetWorth: staticBalance || endNetWorth,
    netWorth: formatSmallUsdValue(staticBalance || endNetWorth),
    rawChange: assetsChange,
    change: `${formatUsdValue(Math.abs(assetsChange))}`,
    changePercent:
      startUsdValue !== 0
        ? `${Math.abs((assetsChange * 100) / startUsdValue).toFixed(2)}%`
        : `${endNetWorth === 0 ? '0' : '100.00'}%`,
    isLoss: assetsChange < 0,
    isEmptyAssets,
  };
};

export const getChangeData = (
  data: CurveList,
  realtimeNetWorth = 0,
  realtimeTimestamp?: number,
) => {
  const startData = data[0] || { value: 0, timestamp: 0, usd_value: 0 };
  const endNetWorth = realtimeTimestamp
    ? realtimeNetWorth || 0
    : data?.length
    ? data[data.length - 1]?.usd_value || 0
    : 0;
  const assetsChange = endNetWorth - startData.usd_value;

  return {
    changePercent:
      startData.usd_value !== 0
        ? `${Math.abs((assetsChange * 100) / startData.usd_value).toFixed(2)}%`
        : `${endNetWorth === 0 ? '0' : '100.00'}%`,
    isLoss: assetsChange < 0,
  };
};

type CurveState = {
  curveList: CurveList;
  loadingCurve: boolean;
  selectData: ReturnType<typeof formChartData>;
  isDecrease: boolean;
};
// type LoadingCurveState = {
//   [addr: string]: CurveState;
// }
const loadingCurveState = zCreate<CurveState>(() => ({
  curveList: [],
  loadingCurve: true,
  selectData: makeDefaultSelectData(),
  isDecrease: false,
}));

function makeDefaultSelectData(): ReturnType<typeof formChartData> {
  return {
    list: [],
    rawNetWorth: 0,
    rawChange: 0,
    netWorth: '',
    change: '',
    changePercent: '',
    isLoss: false,
    isEmptyAssets: false,
  };
}

export function useIsLoadingCurve() {
  return {
    isLoadingCurve: loadingCurveState(s => s.loadingCurve),
  };
}

function setIsLoading(
  valOrFunc: UpdaterOrPartials<CurveState['loadingCurve']>,
) {
  loadingCurveState.setState(prev => {
    const { newVal, changed } = resolveValFromUpdater(
      prev.loadingCurve,
      valOrFunc,
      {
        strict: true,
      },
    );
    if (!changed) return prev;
    return { ...prev, loadingCurve: newVal };
  });
}

export function setCurveData(
  valOrFunc: UpdaterOrPartials<CurveState['curveList']>,
  totals: {
    days?: CurveDayType;
    totalEvmBalance?: number;
    totalBalance: number | null;
  },
) {
  loadingCurveState.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev.curveList, valOrFunc);

    const selectData = formChartData(
      newVal,
      totals.totalEvmBalance ?? 0,
      new Date().getTime(),
      totals.days ?? CurveDayType.DAY,
      totals.totalBalance ?? 0,
    );

    return {
      ...prev,
      curveList: newVal,
      selectData,
      isDecrease: selectData.isLoss,
    };
  });
}

export function useSingleHomeHasNoData() {
  const hasNoData = loadingCurveState(s => {
    return !s.curveList.length && !s.loadingCurve;
  });

  return { hasNoData };
}
export function useSingleHomeHomeTopChart() {
  const isLoading = loadingCurveState(s => s.loadingCurve);
  const selectData = loadingCurveState(s => s.selectData);

  return {
    isLoading,
    selectData,
  };
}

export function useSingleHomeIsDecrease() {
  const isDecrease = loadingCurveState(s => s.isDecrease);
  return { isDecrease };
}

export function useSingleHomeIsLoss() {
  const isLoss = loadingCurveState(s => !!s.selectData?.isLoss);
  return { isLoss };
}

export const useSingleHomeCurveRefresh = (
  address: string | undefined,
  realtimeNetWorth: number | null,
  days: CurveDayType = CurveDayType.DAY,
  staticBalance: number | null,
) => {
  const fetch = useCallback(
    async (addr: string, force = false) => {
      try {
        const curve = await getNetCurve(addr, days, force);
        const start =
          days === CurveDayType.DAY
            ? dayjs().add(-24, 'hours').add(10, 'minutes').valueOf()
            : dayjs().add(-7, 'days').add(1, 'hours').valueOf();
        const step = days === CurveDayType.DAY ? 5 * 60 * 1000 : 60 * 60 * 1000;
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
        setCurveData(
          result.map(item => {
            return {
              timestamp: dayjs(item.timestamp).unix(),
              usd_value: item.price,
            };
          }),
          {
            days,
            totalEvmBalance: realtimeNetWorth || 0,
            totalBalance: staticBalance,
          },
        );
      } catch (error) {
      } finally {
        setIsLoading(false);
      }
    },
    [days, realtimeNetWorth, staticBalance],
  );

  const refresh = useCallback(
    async (ignoreLoading?: boolean) => {
      if (!address) return;
      if (!ignoreLoading) {
        setIsLoading(true);
      }
      await fetch(address, true);
    },
    [address, fetch],
  );

  return {
    refresh,
  };
};
