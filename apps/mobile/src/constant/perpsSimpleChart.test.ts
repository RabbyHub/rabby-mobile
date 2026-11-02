import { isPerpsCandleInterval, normalizePerpsCandleInterval } from './perps';
import {
  DEFAULT_SIMPLE_CHART_PREFERENCE,
  normalizeSimpleChartPreference,
  SIMPLE_RANGE_INTERVAL,
} from './perpsSimpleChart';
import {
  getPerpsCandleSource,
  PERPS_PRO_CANDLE_INTERVAL_OPTIONS,
} from '@/hooks/perps/candles/interval';

describe('Simple chart preference boundary', () => {
  it('does not migrate the shared Pro interval or accept inconsistent range/interval pairs', () => {
    for (const value of [
      '4h',
      undefined,
      { version: 2 },
      { version: 3, style: 'area', range: null, interval: '1M' },
      { version: 1, style: 'area', range: '1D', interval: '1h' },
    ]) {
      expect(normalizeSimpleChartPreference(value)).toEqual(
        DEFAULT_SIMPLE_CHART_PREFERENCE,
      );
    }
  });
  it.each([
    ['1D', '15m', '1D', '30m'],
    ['ALL', '1M', '1D', '30m'],
    [null, '3d', null, '3d'],
    [null, '1M', null, '1M'],
    [null, '1m', null, '1m'],
  ])(
    'migrates v1 %s without losing the chart style',
    (range, interval, nextRange, nextInterval) => {
      expect(
        normalizeSimpleChartPreference({
          version: 1,
          style: 'area',
          range,
          interval,
        }),
      ).toEqual({
        version: 2,
        style: 'area',
        range: nextRange,
        interval: nextInterval,
      });
    },
  );
  it('accepts independent manual 3d without widening the Pro preference or menu', () => {
    const preference = {
      version: 2,
      style: 'area',
      range: null,
      interval: '3d',
    } as const;
    expect(normalizeSimpleChartPreference(preference)).toEqual(preference);
    expect(getPerpsCandleSource('3d')).toMatchObject({
      sourceInterval: '3d',
      sourceIntervalMs: 259200000,
    });
    expect(isPerpsCandleInterval('3d')).toBe(false);
    expect(normalizePerpsCandleInterval('3d')).toBe('15m');
    expect(
      PERPS_PRO_CANDLE_INTERVAL_OPTIONS.some(
        item => String(item.value) === '3d',
      ),
    ).toBe(false);
  });
  it('uses the five new range mappings and keeps month and minute distinct', () => {
    expect(SIMPLE_RANGE_INTERVAL).toEqual({
      '1D': '30m',
      '1W': '4h',
      '1M': '12h',
      '3M': '1d',
      '1Y': '1w',
    });
  });
});
