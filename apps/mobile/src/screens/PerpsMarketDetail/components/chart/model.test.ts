import {
  projectSimpleFills,
  simplePriceChange,
  simplePriceText,
  simpleSelectionTime,
  toSimpleChartCandle,
} from './model';

describe('Simple chart price semantics', () => {
  it('uses the design date order and twelve-hour clock in local display time', () => {
    const now = new Date(2026, 9, 14);
    const at = (hour: number, minute = 0) =>
      new Date(2026, 8, 14, hour, minute).getTime() / 1000;
    expect(simpleSelectionTime(at(23), now)).toBe('Mon,Sep 14 at 11:00PM');
    expect(simpleSelectionTime(at(0, 5), now)).toBe('Mon,Sep 14 at 12:05AM');
    expect(simpleSelectionTime(at(12), now)).toBe('Mon,Sep 14 at 12:00PM');
    expect(
      simpleSelectionTime(new Date(2026, 0, 1, 9, 7).getTime() / 1000, now),
    ).toBe('Thu,Jan 1 at 9:07AM');
  });
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
  it('replaces only the weekday with the local calendar year outside the current year', () => {
    const time = new Date(2025, 4, 8, 7, 56).getTime() / 1000;
    expect(simpleSelectionTime(time, new Date(2025, 11, 31))).toBe(
      'Thu,May 8 at 7:56AM',
    );
    expect(simpleSelectionTime(time, new Date(2026, 0, 1))).toBe(
      '2025,May 8 at 7:56AM',
    );
    const midnight = new Date(2025, 0, 1, 0, 5).getTime() / 1000;
    expect(simpleSelectionTime(midnight, new Date(2026, 0, 1))).toBe(
      '2025,Jan 1 at 12:05AM',
    );
    // A local Dec 31 can belong to the following ISO week-year.
    const boundary = new Date(2024, 11, 31, 23, 59).getTime() / 1000;
    expect(simpleSelectionTime(boundary, new Date(2025, 0, 1))).toBe(
      '2024,Dec 31 at 11:59PM',
    );
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
