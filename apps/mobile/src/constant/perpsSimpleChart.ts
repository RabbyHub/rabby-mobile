import { PERPS_CANDLE_INTERVALS, type PerpsCandleDataInterval } from './perps';

export const SIMPLE_CHART_RANGES = ['1D', '1W', '1M', '3M', '1Y'] as const;
export type SimpleChartRange = (typeof SIMPLE_CHART_RANGES)[number];
export const SIMPLE_RANGE_INTERVAL: Record<
  SimpleChartRange,
  PerpsCandleDataInterval
> = {
  '1D': '30m',
  '1W': '4h',
  '1M': '12h',
  '3M': '1d',
  '1Y': '1w',
};
const LEGACY_RANGE_INTERVAL: Record<string, string> = {
  '1D': '15m',
  '1W': '1h',
  '1M': '1d',
  '1Y': '1w',
  ALL: '1M',
};
export type SimpleChartPreference = {
  version: 2;
  style: 'candle' | 'area';
  range: SimpleChartRange | null;
  interval: PerpsCandleDataInterval;
};
export const DEFAULT_SIMPLE_CHART_PREFERENCE: SimpleChartPreference = {
  version: 2,
  style: 'candle',
  range: '1D',
  interval: '30m',
};
export const SIMPLE_INTERVAL_GROUPS = [
  { key: 'minutes', values: ['1m', '5m', '15m', '30m'] },
  { key: 'hours', values: ['1h', '4h', '8h', '12h'] },
  { key: 'days', values: ['1d', '3d', '1w', '1M'] },
] as const;

export function normalizeSimpleChartPreference(
  value: unknown,
): SimpleChartPreference {
  if (!value || typeof value !== 'object')
    return { ...DEFAULT_SIMPLE_CHART_PREFERENCE };
  const v = value as Record<string, unknown>;
  if (
    (v.version !== 1 && v.version !== 2) ||
    (v.style !== 'candle' && v.style !== 'area') ||
    ![...PERPS_CANDLE_INTERVALS, '3d'].includes(v.interval as string)
  ) {
    return { ...DEFAULT_SIMPLE_CHART_PREFERENCE };
  }
  if (v.range === null)
    return {
      version: 2,
      style: v.style,
      range: null,
      interval: v.interval as PerpsCandleDataInterval,
    };
  const mapping =
    v.version === 1 ? LEGACY_RANGE_INTERVAL : SIMPLE_RANGE_INTERVAL;
  if (
    typeof v.range !== 'string' ||
    !Object.prototype.hasOwnProperty.call(mapping, v.range) ||
    mapping[v.range as keyof typeof mapping] !== v.interval
  )
    return { ...DEFAULT_SIMPLE_CHART_PREFERENCE };
  const range = (v.range === 'ALL' ? '1D' : v.range) as SimpleChartRange;
  return {
    version: 2,
    style: v.style,
    range,
    interval: SIMPLE_RANGE_INTERVAL[range],
  };
}
