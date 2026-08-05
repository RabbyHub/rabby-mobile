import {
  CANDLE_MENU_KEY_V2,
  normalizePerpsCandleInterval,
  PERPS_CANDLE_INTERVALS,
  type PerpsCandleInterval,
} from '@/constant/perps';

import {
  getPerpsCandleHistoryStartTime,
  getPerpsCandleSource,
  getUtcMonthStart,
  getUtcWeekStart,
  isSimplePerpsCandleInterval,
  toCanonicalPerpsCandleInterval,
  toSimplePerpsCandleInterval,
} from './interval';

describe('Perps candle intervals', () => {
  it.each([
    '1m',
    '5m',
    '15m',
    '30m',
    '1h',
    '4h',
    '8h',
    '12h',
    '1d',
  ] satisfies PerpsCandleInterval[])(
    'uses the direct Hyperliquid interval for %s',
    interval => {
      expect(getPerpsCandleSource(interval).sourceInterval).toBe(interval);
    },
  );

  it('maps weekly and natural-month products to daily source candles', () => {
    expect(getPerpsCandleSource('1w')).toMatchObject({
      sourceCandleCount: 3500,
      sourceInterval: '1d',
    });
    expect(getPerpsCandleSource('1M')).toMatchObject({
      sourceCandleCount: 5000,
      sourceInterval: '1d',
    });
    expect(getPerpsCandleSource('15m')).toMatchObject({
      sourceCandleCount: 500,
      sourceInterval: '15m',
    });
  });

  it('builds a bounded source history window', () => {
    const end = Date.UTC(2026, 6, 30);
    expect(getPerpsCandleHistoryStartTime('1m', end)).toBe(
      end - 500 * 60 * 1000,
    );
    expect(getPerpsCandleHistoryStartTime('1M', end)).toBe(
      Math.max(0, end - 5000 * 24 * 60 * 60 * 1000),
    );
  });

  it('uses UTC Monday and UTC natural-month boundaries', () => {
    expect(getUtcWeekStart(Date.UTC(2026, 7, 2, 23, 59))).toBe(
      Date.UTC(2026, 6, 27),
    );
    expect(getUtcWeekStart(Date.UTC(2026, 7, 3, 0, 1))).toBe(
      Date.UTC(2026, 7, 3),
    );
    expect(getUtcMonthStart(Date.UTC(2027, 0, 31, 23, 59))).toBe(
      Date.UTC(2027, 0, 1),
    );
    expect(getUtcWeekStart(Date.UTC(2027, 0, 3, 23, 59))).toBe(
      Date.UTC(2026, 11, 28),
    );
  });

  it('preserves every canonical value, including case-sensitive 1M', () => {
    PERPS_CANDLE_INTERVALS.forEach(interval => {
      expect(normalizePerpsCandleInterval(interval)).toBe(interval);
    });
    expect(normalizePerpsCandleInterval('1m')).toBe('1m');
    expect(normalizePerpsCandleInterval('1M')).toBe('1M');
    expect(normalizePerpsCandleInterval('1month')).toBe('15m');
  });

  it('adapts Simple values without overwriting unsupported Pro values', () => {
    expect(
      toCanonicalPerpsCandleInterval(CANDLE_MENU_KEY_V2.FIVE_MINUTES),
    ).toBe('5m');
    expect(toSimplePerpsCandleInterval('1w')).toBe(CANDLE_MENU_KEY_V2.ONE_WEEK);
    expect(toSimplePerpsCandleInterval('1M')).toBe(
      CANDLE_MENU_KEY_V2.FIFTEEN_MINUTES,
    );
    expect(isSimplePerpsCandleInterval('1M')).toBe(false);
  });
});
