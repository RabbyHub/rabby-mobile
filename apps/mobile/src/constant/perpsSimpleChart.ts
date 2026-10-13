import { PERPS_CANDLE_INTERVALS, type PerpsCandleDataInterval } from './perps';

export const SIMPLE_CHART_RANGES = ['1D', '1W', '1M', '1Y', 'ALL'] as const;
export type SimpleChartRange = (typeof SIMPLE_CHART_RANGES)[number];
export const SIMPLE_RANGE_INTERVAL: Record<
  SimpleChartRange,
  PerpsCandleDataInterval
> = {
  '1D': '15m',
  '1W': '1h',
  '1M': '1d',
  '1Y': '1w',
  ALL: '1M',
};
export type SimpleChartPreference = {
  version: 1;
  style: 'candle' | 'area';
  range: SimpleChartRange | null;
  interval: PerpsCandleDataInterval;
};
export const DEFAULT_SIMPLE_CHART_PREFERENCE: SimpleChartPreference = {
  version: 1,
  style: 'candle',
  range: '1D',
  interval: '15m',
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
  const v = value as Partial<SimpleChartPreference>;
  if (
    v.version !== 1 ||
    (v.style !== 'candle' && v.style !== 'area') ||
    ![...PERPS_CANDLE_INTERVALS, '3d'].includes(v.interval as string) ||
    (v.range !== null &&
      (!SIMPLE_CHART_RANGES.includes(v.range as SimpleChartRange) ||
        SIMPLE_RANGE_INTERVAL[v.range as SimpleChartRange] !== v.interval))
  ) {
    return { ...DEFAULT_SIMPLE_CHART_PREFERENCE };
  }
  return { version: 1, style: v.style, range: v.range!, interval: v.interval! };
}
