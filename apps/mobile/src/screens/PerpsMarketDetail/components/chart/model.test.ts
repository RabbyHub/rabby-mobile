import {
  projectSimpleFills,
  simplePriceChange,
  simplePriceText,
  toSimpleChartCandle,
} from './model';

describe('Simple chart price semantics', () => {
  it('converts feed milliseconds exactly once at the native/Web boundary', () => {
    expect(
      toSimpleChartCandle({
        time: 1728000000000,
        open: 10,
        close: 12,
        low: 9,
        high: 13,
        volume: 1,
        quoteTurnover: null,
        trades: 2,
      }).time,
    ).toBe(1728000000);
  });
  it('uses candle open for a selected Area point and guards missing references', () => {
    expect(simplePriceChange(12, 10)).toEqual({ delta: 2, percent: 0.2 });
    expect(simplePriceChange(12, 0)).toBeNull();
    expect(simplePriceChange(null, 10)).toBeNull();
    expect(simplePriceText(NaN, 2)).toBe('—');
    expect(simplePriceText(1234.5, 2)).toBe('1,234.50');
  });
  it('projects only real fill directions without inventing prices or orders', () => {
    expect(
      projectSimpleFills([
        { time: 1000, side: 'B' },
        { time: 2000, side: 'A' },
        { time: 3000, side: 'unknown' },
      ]),
    ).toEqual([
      { time: 1, side: 'B' },
      { time: 2, side: 'A' },
    ]);
  });
});
