import { CANDLE_MENU_KEY_V2, type PerpsCandleInterval } from '@/constant/perps';

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const DIRECT_HISTORY_CANDLE_COUNT = 500;
const MAX_SOURCE_CANDLE_COUNT = 5000;
const HISTORY_PAGE_CANDLE_COUNT = 1000;
const MONTHLY_INITIAL_SOURCE_CANDLE_COUNT = 1240;

const INTERVAL_DURATION_MS: Record<
  Exclude<PerpsCandleInterval, '1w' | '1M'>,
  number
> = {
  '1m': MINUTE_MS,
  '5m': 5 * MINUTE_MS,
  '15m': 15 * MINUTE_MS,
  '30m': 30 * MINUTE_MS,
  '1h': 60 * MINUTE_MS,
  '4h': 4 * 60 * MINUTE_MS,
  '8h': 8 * 60 * MINUTE_MS,
  '12h': 12 * 60 * MINUTE_MS,
  '1d': DAY_MS,
};

export const PERPS_PRO_CANDLE_INTERVAL_OPTIONS: ReadonlyArray<{
  label: string;
  value: PerpsCandleInterval;
}> = [
  { label: '1m', value: '1m' },
  { label: '5m', value: '5m' },
  { label: '15m', value: '15m' },
  { label: '30m', value: '30m' },
  { label: '1H', value: '1h' },
  { label: '4H', value: '4h' },
  { label: '8H', value: '8h' },
  { label: '12H', value: '12h' },
  { label: '1D', value: '1d' },
  { label: '1W', value: '1w' },
  { label: '1M', value: '1M' },
];

export const getPerpsCandleSource = (
  interval: PerpsCandleInterval,
): {
  sourceCandleCount: number;
  maximumSourceCandleCount: number;
  historyPageCandleCount: number;
  sourceInterval: Exclude<PerpsCandleInterval, '1w' | '1M'>;
  sourceIntervalMs: number;
} => {
  if (interval === '1w') {
    return {
      sourceCandleCount: DIRECT_HISTORY_CANDLE_COUNT,
      maximumSourceCandleCount: MAX_SOURCE_CANDLE_COUNT,
      historyPageCandleCount: HISTORY_PAGE_CANDLE_COUNT,
      sourceInterval: '1d',
      sourceIntervalMs: DAY_MS,
    };
  }
  if (interval === '1M') {
    return {
      sourceCandleCount: MONTHLY_INITIAL_SOURCE_CANDLE_COUNT,
      maximumSourceCandleCount: MAX_SOURCE_CANDLE_COUNT,
      historyPageCandleCount: HISTORY_PAGE_CANDLE_COUNT,
      sourceInterval: '1d',
      sourceIntervalMs: DAY_MS,
    };
  }
  return {
    sourceCandleCount: DIRECT_HISTORY_CANDLE_COUNT,
    maximumSourceCandleCount: MAX_SOURCE_CANDLE_COUNT,
    historyPageCandleCount: HISTORY_PAGE_CANDLE_COUNT,
    sourceInterval: interval,
    sourceIntervalMs: INTERVAL_DURATION_MS[interval],
  };
};

export const getPerpsCandleHistoryStartTime = (
  interval: PerpsCandleInterval,
  endTime: number,
) => {
  const { sourceCandleCount, sourceIntervalMs } =
    getPerpsCandleSource(interval);
  return Math.max(0, endTime - sourceCandleCount * sourceIntervalMs);
};

export const getUtcWeekStart = (time: number) => {
  const date = new Date(time);
  const day = date.getUTCDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  return Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() - daysSinceMonday,
  );
};

export const getUtcMonthStart = (time: number) => {
  const date = new Date(time);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
};

const SIMPLE_TO_CANONICAL: Record<CANDLE_MENU_KEY_V2, PerpsCandleInterval> = {
  [CANDLE_MENU_KEY_V2.FIVE_MINUTES]: '5m',
  [CANDLE_MENU_KEY_V2.FIFTEEN_MINUTES]: '15m',
  [CANDLE_MENU_KEY_V2.ONE_HOUR]: '1h',
  [CANDLE_MENU_KEY_V2.FOUR_HOURS]: '4h',
  [CANDLE_MENU_KEY_V2.ONE_DAY]: '1d',
  [CANDLE_MENU_KEY_V2.ONE_WEEK]: '1w',
};

const CANONICAL_TO_SIMPLE: Partial<
  Record<PerpsCandleInterval, CANDLE_MENU_KEY_V2>
> = Object.fromEntries(
  Object.entries(SIMPLE_TO_CANONICAL).map(([simple, canonical]) => [
    canonical,
    simple,
  ]),
) as Partial<Record<PerpsCandleInterval, CANDLE_MENU_KEY_V2>>;

export const toCanonicalPerpsCandleInterval = (interval: CANDLE_MENU_KEY_V2) =>
  SIMPLE_TO_CANONICAL[interval];

export const toSimplePerpsCandleInterval = (interval: PerpsCandleInterval) =>
  CANONICAL_TO_SIMPLE[interval] ?? CANDLE_MENU_KEY_V2.FIFTEEN_MINUTES;

export const isSimplePerpsCandleInterval = (interval: PerpsCandleInterval) =>
  CANONICAL_TO_SIMPLE[interval] != null;
