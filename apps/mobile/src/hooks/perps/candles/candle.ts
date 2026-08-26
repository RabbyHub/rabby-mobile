import type { Candle } from '@rabby-wallet/hyperliquid-sdk';

import type { PerpsCandleInterval } from '@/constant/perps';

import { getUtcMonthStart, getUtcWeekStart } from './interval';

export type PerpsCandle = {
  close: number;
  high: number;
  low: number;
  open: number;
  quoteTurnover: number | null;
  time: number;
  trades: number | null;
  volume: number;
};

const isFinitePositive = (value: number) => Number.isFinite(value) && value > 0;

export const parsePerpsCandle = (
  candle: Candle | null | undefined,
): PerpsCandle | null => {
  if (!candle) {
    return null;
  }
  const time = Number(candle.t);
  const open = Number(candle.o);
  const high = Number(candle.h);
  const low = Number(candle.l);
  const close = Number(candle.c);
  const volume = Number(candle.v);
  const trades = Number(candle.n);

  if (
    !Number.isFinite(time) ||
    time < 0 ||
    !isFinitePositive(open) ||
    !isFinitePositive(high) ||
    !isFinitePositive(low) ||
    !isFinitePositive(close) ||
    !Number.isFinite(volume) ||
    volume < 0 ||
    high < Math.max(open, close, low) ||
    low > Math.min(open, close, high)
  ) {
    return null;
  }

  return {
    close,
    high,
    low,
    open,
    quoteTurnover: null,
    time,
    trades: Number.isFinite(trades) && trades >= 0 ? trades : null,
    volume,
  };
};

export const parsePerpsCandles = (
  candles: ReadonlyArray<Candle> | null | undefined,
) =>
  mergePerpsCandles(
    (candles ?? [])
      .map(parsePerpsCandle)
      .filter((candle): candle is PerpsCandle => candle != null),
  );

export const mergePerpsCandles = (
  ...sources: ReadonlyArray<ReadonlyArray<PerpsCandle>>
) => {
  const byTime = new Map<number, PerpsCandle>();
  sources.forEach(source => {
    source.forEach(candle => {
      if (Number.isFinite(candle.time)) {
        byTime.set(candle.time, { ...candle });
      }
    });
  });
  return Array.from(byTime.values()).sort((a, b) => a.time - b.time);
};

export const upsertPerpsCandle = (
  candles: ReadonlyArray<PerpsCandle>,
  candle: PerpsCandle,
) => mergePerpsCandles(candles, [candle]);

const getAggregationBucket = (
  interval: Extract<PerpsCandleInterval, '1w' | '1M'>,
  time: number,
) => (interval === '1w' ? getUtcWeekStart(time) : getUtcMonthStart(time));

export const aggregateDailyPerpsCandles = (
  dailyCandles: ReadonlyArray<PerpsCandle>,
  interval: Extract<PerpsCandleInterval, '1w' | '1M'>,
) => {
  const buckets = new Map<number, PerpsCandle>();

  mergePerpsCandles(dailyCandles).forEach(candle => {
    const bucketTime = getAggregationBucket(interval, candle.time);
    const current = buckets.get(bucketTime);
    if (!current) {
      buckets.set(bucketTime, {
        ...candle,
        time: bucketTime,
      });
      return;
    }

    current.high = Math.max(current.high, candle.high);
    current.low = Math.min(current.low, candle.low);
    current.close = candle.close;
    current.volume += candle.volume;
    current.trades =
      current.trades != null && candle.trades != null
        ? current.trades + candle.trades
        : null;
    current.quoteTurnover =
      current.quoteTurnover != null && candle.quoteTurnover != null
        ? current.quoteTurnover + candle.quoteTurnover
        : null;
  });

  return Array.from(buckets.values()).sort((a, b) => a.time - b.time);
};

export const selectPerpsDisplayCandles = (
  sourceCandles: ReadonlyArray<PerpsCandle>,
  interval: PerpsCandleInterval,
) =>
  interval === '1w' || interval === '1M'
    ? aggregateDailyPerpsCandles(sourceCandles, interval)
    : mergePerpsCandles(sourceCandles);
