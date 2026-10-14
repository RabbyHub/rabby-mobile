import type { CandleStick, SimpleChartConfig, SimpleChartFill } from './types';

const DAY = 86400;

const DURATIONS: Record<string, number> = {
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '30m': 1800,
  '1h': 3600,
  '4h': 14400,
  '8h': 28800,
  '12h': 43200,
  '1d': DAY,
  '3d': 3 * DAY,
  '1w': 7 * DAY,
};

export function candleEnd(time: number, interval: string) {
  if (interval !== '1M') return time + DURATIONS[interval];
  const date = new Date(time * 1000);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1) / 1000;
}

function subtractCalendar(time: number, months: number) {
  const date = new Date(time * 1000);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() - months);
  const daysInMonth = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  ).getUTCDate();
  date.setUTCDate(Math.min(day, daysInMonth));
  return date.getTime() / 1000;
}

/** One window for the default viewport and its price-change reference. */
function simpleRangeWindow(
  candles: readonly CandleStick[],
  config: Pick<SimpleChartConfig, 'range' | 'interval'>,
) {
  if (!candles.length || config.range === null) return null;
  const last = candles.length - 1;
  const end = candleEnd(candles[last].time, config.interval);
  const start =
    config.range === '1D'
      ? end - DAY
      : config.range === '1W'
      ? end - 7 * DAY
      : subtractCalendar(
          end,
          config.range === '1M' ? 1 : config.range === '3M' ? 3 : 12,
        );
  const first = candles.findIndex(
    candle => candleEnd(candle.time, config.interval) > start,
  );
  return { start, first };
}

/** Rolling range ending at the current candle. Month/year use calendar arithmetic. */
export function simpleDefaultRange(
  candles: readonly CandleStick[],
  config: Pick<SimpleChartConfig, 'range' | 'interval'>,
  width: number,
) {
  if (!candles.length) return null;
  const last = candles.length - 1;
  const window = simpleRangeWindow(candles, config);
  return {
    from: window
      ? Math.max(0, window.first) - 0.5
      : last + 0.5 - Math.max(2, width / 10),
    to: last + 0.5,
  };
}

/** Daily/manual change uses asset-context prevDayPx in RN, not a candle approximation. */
export function simpleRangeReference(
  candles: readonly CandleStick[],
  config: Pick<SimpleChartConfig, 'range' | 'interval'>,
) {
  if (config.range === null || config.range === '1D') return null;
  const window = simpleRangeWindow(candles, config);
  if (!window || candles[0].time > window.start || window.first < 0)
    return null;
  const first = candles[window.first];
  // A gap or a newly listed market must not masquerade as a full range.
  return first.time <= window.start &&
    Number.isFinite(first.open) &&
    first.open > 0
    ? first.open
    : null;
}

export function visibleLastCandle(
  candles: readonly CandleStick[],
  range: { from: number; to: number } | null,
) {
  if (!range || !candles.length) return null;
  const index = Math.min(candles.length - 1, Math.floor(range.to));
  return index >= Math.max(0, Math.ceil(range.from)) ? candles[index] : null;
}

/** Translate logical indices when history is prepended or the feed trims its cache. */
export function simpleHistoryShift(
  previous: readonly CandleStick[],
  next: readonly CandleStick[],
) {
  if (!previous.length || !next.length) return 0;
  const added = next.findIndex(candle => candle.time === previous[0].time);
  if (added >= 0) return added;
  const removed = previous.findIndex(candle => candle.time === next[0].time);
  return removed >= 0 ? -removed : 0;
}

/** Return label centers, leaving a gap while keeping the real price coordinates unchanged. */
export function avoidSimpleLabelOverlap(
  values: readonly number[],
  height: number,
  labelHeight = 14,
  gap = 3,
) {
  const spacing = labelHeight + gap;
  const sorted = values
    .map((y, index) => ({ y, index }))
    .sort((a, b) => a.y - b.y || a.index - b.index);
  const result: number[] = [];
  const top = labelHeight / 2;
  const bottom = Math.max(top, height - top);
  sorted.forEach((item, index) => {
    result[index] = Math.max(
      top,
      Math.min(bottom, item.y),
      index ? result[index - 1] + spacing : top,
    );
  });
  for (let i = result.length - 1; i >= 0; i--) {
    result[i] = Math.min(
      result[i],
      i === result.length - 1 ? bottom : result[i + 1] - spacing,
    );
  }
  const ordered: number[] = [];
  sorted.forEach((item, index) => {
    ordered[item.index] = result[index];
  });
  return ordered;
}

export function simpleFillMarkers(
  candles: readonly CandleStick[],
  fills: readonly SimpleChartFill[],
  interval: string,
) {
  const result = new Map<string, { time: number; side: 'B' | 'A' }>();
  for (const fill of fills) {
    if (fill.side !== 'B' && fill.side !== 'A') continue;
    let low = 0,
      high = candles.length - 1,
      found = -1;
    while (low <= high) {
      const middle = (low + high) >>> 1;
      if (candles[middle].time <= fill.time) {
        found = middle;
        low = middle + 1;
      } else high = middle - 1;
    }
    if (found < 0 || fill.time >= candleEnd(candles[found].time, interval))
      continue;
    const time = candles[found].time;
    result.set(`${time}:${fill.side}`, { time, side: fill.side });
  }
  return [...result.values()];
}
