import type { Candle } from '@rabby-wallet/hyperliquid-sdk';

import {
  aggregateDailyPerpsCandles,
  mergePerpsCandles,
  parsePerpsCandle,
  parsePerpsCandles,
  type PerpsCandle,
} from './candle';

const rawCandle = (time: number, overrides: Partial<Candle> = {}): Candle => ({
  T: time + 24 * 60 * 60 * 1000 - 1,
  c: '12',
  h: '13',
  i: '1d',
  l: '9',
  n: 2,
  o: '10',
  s: 'BTC',
  t: time,
  v: '3',
  ...overrides,
});

const candle = (
  time: number,
  overrides: Partial<PerpsCandle> = {},
): PerpsCandle => ({
  close: 12,
  high: 13,
  low: 9,
  open: 10,
  quoteTurnover: null,
  time,
  trades: 2,
  volume: 3,
  ...overrides,
});

describe('Perps candles', () => {
  it('parses finite Candle fields and keeps Txn unavailable', () => {
    expect(parsePerpsCandle(rawCandle(1000))).toEqual(candle(1000));
    expect(parsePerpsCandle(rawCandle(1000, { o: '0' }))).toBeNull();
    expect(parsePerpsCandle(rawCandle(1000, { h: '8' }))).toBeNull();
  });

  it('sorts, deduplicates and lets later realtime data win', () => {
    expect(
      parsePerpsCandles([
        rawCandle(2000),
        rawCandle(1000),
        rawCandle(2000, { c: '12.5', h: '13.5' }),
      ]),
    ).toEqual([candle(1000), candle(2000, { close: 12.5, high: 13.5 })]);

    expect(
      mergePerpsCandles(
        [candle(1000), candle(2000)],
        [candle(2000, { close: 14, high: 14 })],
      ),
    ).toEqual([candle(1000), candle(2000, { close: 14, high: 14 })]);
  });

  it('aggregates UTC weeks without double-counting a replaced day', () => {
    const monday = Date.UTC(2026, 6, 27);
    const tuesday = Date.UTC(2026, 6, 28);
    const result = aggregateDailyPerpsCandles(
      [
        candle(monday, { close: 11, high: 12, volume: 2 }),
        candle(tuesday, { close: 13, high: 14, low: 8, volume: 4 }),
        candle(tuesday, { close: 14, high: 15, low: 7, volume: 5 }),
      ],
      '1w',
    );

    expect(result).toEqual([
      candle(monday, {
        close: 14,
        high: 15,
        low: 7,
        trades: 4,
        volume: 7,
      }),
    ]);
  });

  it('aggregates UTC natural months across a fixed-30-day boundary', () => {
    const july31 = Date.UTC(2026, 6, 31);
    const august1 = Date.UTC(2026, 7, 1);
    const result = aggregateDailyPerpsCandles(
      [candle(july31), candle(august1, { open: 20 })],
      '1M',
    );

    expect(result.map(item => item.time)).toEqual([
      Date.UTC(2026, 6, 1),
      Date.UTC(2026, 7, 1),
    ]);
  });

  it('only sums quote turnover when every source candle is complete', () => {
    const start = Date.UTC(2026, 6, 1);
    const incomplete = aggregateDailyPerpsCandles(
      [
        candle(start, { quoteTurnover: 10 }),
        candle(start + 24 * 60 * 60 * 1000),
      ],
      '1M',
    );
    const complete = aggregateDailyPerpsCandles(
      [
        candle(start, { quoteTurnover: 10 }),
        candle(start + 24 * 60 * 60 * 1000, { quoteTurnover: 20 }),
      ],
      '1M',
    );

    expect(incomplete[0]?.quoteTurnover).toBeNull();
    expect(complete[0]?.quoteTurnover).toBe(30);
  });
});
