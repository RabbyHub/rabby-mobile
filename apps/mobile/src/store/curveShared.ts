import { USD_CURRENCY } from '@/constant/currency';
import { CurveDayType } from '@/utils/curveDayType';
import {
  coerceFloat,
  formatCurrency,
  formatUsdValue,
  splitNumberByStep,
} from '@/utils/number';
import { CurrencyItem } from '@rabby-wallet/rabby-api/dist/types';
import BigNumber from 'bignumber.js';
import dayjs from 'dayjs';

export type CurveList = Array<{ timestamp: number; usd_value: number }>;

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

export function computeCurveBalanceChange(
  realtimeValue: number,
  baseValue: number,
) {
  const assetsChange = realtimeValue - baseValue;

  const changePercent =
    baseValue !== 0
      ? `${Math.abs((assetsChange * 100) / baseValue).toFixed(2)}%`
      : `${realtimeValue === 0 ? '0' : '100.00'}%`;

  return {
    assetsChange,
    changePercent,
  };
}

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

export const formChartData = (
  data: CurveList,
  options: {
    realtimeNetWorth: number;
    realtimeTimestamp?: number;
    type?: CurveDayType;
    staticBalance?: number | null;
    baseUsdValue?: number | null;
  },
) => {
  const {
    realtimeNetWorth = 0,
    realtimeTimestamp,
    type = CurveDayType.DAY,
    staticBalance = null,
    baseUsdValue = null,
  } = options;
  const startData = data[0] || { value: 0, timestamp: 0, usd_value: 0 };
  const startUsdValue =
    typeof baseUsdValue === 'number'
      ? coerceFloat(baseUsdValue, 0)
      : coerceFloat(startData.usd_value, 0);
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
        const { assetsChange: change, changePercent } =
          computeCurveBalanceChange(x.usd_value, startUsdValue);

        return {
          value: x.usd_value || 0,
          netWorth: formatSmallUsdValue(x.usd_value),
          change: `${formatUsdValue(Math.abs(change))}`,
          rawChange: Math.abs(change),
          isLoss: change < 0,
          changePercent,
          timestamp: x.timestamp,
          dateString: dayjs.unix(x.timestamp).format('MM DD, HH:mm'),
          clockTimeString: dayjs.unix(x.timestamp).format('HH:mm'),
          dateTimeString: dayjs.unix(x.timestamp).format('MM DD, HH:mm'),
        };
      }) || [];

  if (realtimeTimestamp) {
    const {
      assetsChange: realtimeChange,
      changePercent: realtimeChangePercent,
    } = computeCurveBalanceChange(realtimeNetWorth, startUsdValue);

    list.push({
      value: realtimeNetWorth || 0,
      netWorth: formatSmallUsdValue(realtimeNetWorth),
      change: `${formatUsdValue(Math.abs(realtimeChange))}`,
      rawChange: Math.abs(realtimeChange),
      isLoss: realtimeChange < 0,
      changePercent: realtimeChangePercent,
      timestamp: Math.floor(realtimeTimestamp / 1000),
      dateString: dayjs.unix(realtimeTimestamp / 1000).format('MM DD, HH:mm'),
      clockTimeString: dayjs.unix(realtimeTimestamp / 1000).format('HH:mm'),
      dateTimeString: dayjs
        .unix(realtimeTimestamp / 1000)
        .format('MM DD, HH:mm'),
    });
  }

  const endNetWorth = list?.length ? list[list.length - 1]?.value || 0 : 0;
  const isEmptyAssets = endNetWorth === 0 && startUsdValue === 0;
  const { assetsChange, changePercent } = computeCurveBalanceChange(
    endNetWorth,
    startUsdValue,
  );

  return {
    list,
    rawNetWorth: staticBalance || endNetWorth,
    netWorth: formatSmallUsdValue(staticBalance || endNetWorth),
    rawChange: assetsChange,
    change: `${formatUsdValue(Math.abs(assetsChange))}`,
    changePercent: changePercent,
    isLoss: assetsChange < 0,
    isEmptyAssets,
  };
};

export function makeDefaultSelectData(): ReturnType<typeof formChartData> {
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

export function combineMultiCurve(curves: CurveList[]) {
  if (!curves.length) {
    return [];
  }

  const startTime = curves[0]?.[0]?.timestamp ?? 0;
  const interval = 30 * 60;
  const windows: CurveList = Array(48)
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

    curves.forEach(addressData => {
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

  const firstPoints = curves.map(data => data[0]);
  const lastPoints = curves.map(data => data[data.length - 1]);

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
}
