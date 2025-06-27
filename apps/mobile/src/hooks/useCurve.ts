import { getNetCurve } from '@/utils/24balanceCurveCache';
import { patchCurveData } from '@/utils/curve';
import { CurveDayType } from '@/utils/curveDayType';
import { formatUsdValue, splitNumberByStep } from '@/utils/number';
import dayjs from 'dayjs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { atom, useAtom } from 'jotai';

type CurveList = Array<{ timestamp: number; usd_value: number }>;

export type CurvePoint = {
  value: number;
  netWorth: string;
  change: string;
  isLoss: boolean;
  changePercent: string;
  timestamp: number;
  dateString: string;
  clockTimeString: string;
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
  return formatUsdValue(value, value > 1000000 ? 2 : 0);
};

export const formChartData = (
  data: CurveList,
  realtimeNetWorth = 0,
  realtimeTimestamp?: number,
  type = CurveDayType.DAY,
) => {
  const startData = data[0] || { value: 0, timestamp: 0, usd_value: 0 };
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
        const change = x.usd_value - startData.usd_value;

        return {
          value: x.usd_value || 0,
          netWorth: formatSmallUsdValue(x.usd_value),
          change: `${formatUsdValue(Math.abs(change))}`,
          isLoss: change < 0,
          changePercent:
            startData.usd_value === 0
              ? `${x.usd_value === 0 ? '0' : '100.00'}%`
              : `${(Math.abs(change * 100) / startData.usd_value).toFixed(2)}%`,
          timestamp: x.timestamp,
          dateString: dayjs.unix(x.timestamp).format('MM DD, HH:mm'),
          clockTimeString: dayjs.unix(x.timestamp).format('HH:mm'),
        };
      }) || [];

  // patch realtime newworth
  if (realtimeTimestamp) {
    const realtimeChange = realtimeNetWorth - startData.usd_value;

    list.push({
      value: realtimeNetWorth || 0,
      netWorth: formatSmallUsdValue(realtimeNetWorth),
      change: `${formatUsdValue(Math.abs(realtimeChange))}`,
      isLoss: realtimeChange < 0,
      changePercent:
        startData.usd_value === 0
          ? `${realtimeNetWorth === 0 ? '0' : '100.00'}%`
          : `${(Math.abs(realtimeChange * 100) / startData.usd_value).toFixed(
              2,
            )}%`,
      timestamp: Math.floor(realtimeTimestamp / 1000),
      dateString: dayjs.unix(realtimeTimestamp / 1000).format('MM DD, HH:mm'),
      clockTimeString: dayjs.unix(realtimeTimestamp / 1000).format('HH:mm'),
    });
  }

  const endNetWorth = list?.length ? list[list.length - 1]?.value : 0;
  const assetsChange = endNetWorth - startData.usd_value;
  const isEmptyAssets = endNetWorth === 0 && startData.usd_value === 0;

  return {
    list,
    netWorth: formatSmallUsdValue(endNetWorth),
    change: `${formatUsdValue(Math.abs(assetsChange))}`,
    changePercent:
      startData.usd_value !== 0
        ? `${Math.abs((assetsChange * 100) / startData.usd_value).toFixed(2)}%`
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
export const loadingCurveAtom = atom(true);
export const useCurve = (
  address: string | undefined,
  nonce: number,
  realtimeNetWorth: number | null,
  days: CurveDayType = CurveDayType.DAY,
) => {
  const [data, setData] = useState<
    {
      timestamp: number;
      usd_value: number;
    }[]
  >([]);
  const [isLoading, setIsLoading] = useAtom(loadingCurveAtom);
  const select = useMemo(() => {
    return formChartData(
      data,
      realtimeNetWorth ?? 0,
      new Date().getTime(),
      days,
    );
  }, [data, realtimeNetWorth, days]);

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
        setData(
          result.map(item => {
            return {
              timestamp: dayjs(item.timestamp).unix(),
              usd_value: item.price,
            };
          }),
        );
      } catch (error) {
      } finally {
        setIsLoading(false);
      }
    },
    [days, setIsLoading],
  );

  const refresh = useCallback(
    async (ignoreLoading?: boolean) => {
      if (!address) {
        return;
      }
      if (!ignoreLoading) {
        setIsLoading(true);
      }
      await fetch(address, true);
    },
    [address, fetch, setIsLoading],
  );

  useEffect(() => {
    setIsLoading(true);
    setData([]);
  }, [address, setIsLoading]);

  useEffect(() => {
    if (!address) {
      return;
    }
    setIsLoading(true);
    fetch(address);
  }, [address, fetch, nonce, setIsLoading]);

  return {
    result: isLoading ? undefined : select,
    isLoading,
    refresh,
    hasNoData: !data.length && !isLoading,
  };
};
