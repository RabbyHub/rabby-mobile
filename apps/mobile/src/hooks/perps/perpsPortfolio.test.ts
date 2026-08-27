import {
  compute24hChange,
  formatPortfolioTooltipTime,
  getLatestPortfolioValue,
  isPortfolioAllZero,
  parsePortfolioResponse,
  parsePortfolioResponseStrict,
  toChartPoints,
  type PortfolioData,
  type PortfolioSeries,
} from './perpsPortfolio';

const series = (
  points: [number, string][],
  pnl?: [number, string][],
): PortfolioSeries => ({
  accountValueHistory: points,
  pnlHistory: pnl ?? points.map(([t]) => [t, '0.0'] as [number, string]),
  vlm: '0.0',
});

const rawEntry = (period: string, s: PortfolioSeries) => [period, s];

describe('parsePortfolioResponse', () => {
  it('keeps the 4 combined periods and drops perp-prefixed ones', () => {
    const day = series([[1000, '194.42']]);
    const week = series([[1000, '190.0']]);
    const raw = [
      rawEntry('day', day),
      rawEntry('week', week),
      rawEntry('month', series([[1000, '1']])),
      rawEntry('allTime', series([[1000, '2']])),
      rawEntry('perpDay', series([[1000, '37.17']])),
      rawEntry('perpWeek', series([[1000, '3']])),
      rawEntry('perpMonth', series([[1000, '4']])),
      rawEntry('perpAllTime', series([[1000, '5']])),
    ];
    const parsed = parsePortfolioResponse(raw);
    expect(Object.keys(parsed).sort()).toEqual([
      'allTime',
      'day',
      'month',
      'week',
    ]);
    expect(parsed.day?.accountValueHistory).toEqual([[1000, '194.42']]);
  });

  it('returns {} for malformed input', () => {
    expect(parsePortfolioResponse(null)).toEqual({});
    expect(parsePortfolioResponse(undefined)).toEqual({});
    expect(parsePortfolioResponse('oops')).toEqual({});
    expect(parsePortfolioResponse({})).toEqual({});
    expect(parsePortfolioResponse([['day', null]])).toEqual({});
    expect(parsePortfolioResponse([['day', { vlm: '0' }]])).toEqual({});
  });

  it('tolerates missing pnlHistory by defaulting to empty arrays', () => {
    const parsed = parsePortfolioResponse([
      ['day', { accountValueHistory: [[1000, '1.0']] }],
    ]);
    expect(parsed.day?.accountValueHistory).toEqual([[1000, '1.0']]);
    expect(parsed.day?.pnlHistory).toEqual([]);
  });
});

describe('isPortfolioAllZero', () => {
  it('is true for an empty-account response (all-zero points, non-empty arrays)', () => {
    const zeros: [number, string][] = Array.from({ length: 11 }, (_, i) => [
      i * 1000,
      '0.0',
    ]);
    const data: PortfolioData = {
      day: series(zeros),
      week: series(zeros),
      month: series(zeros),
      allTime: series(zeros),
    };
    expect(isPortfolioAllZero(data)).toBe(true);
  });

  it('is false when any point is non-zero', () => {
    const data: PortfolioData = {
      day: series([
        [0, '0.0'],
        [1000, '0.01'],
      ]),
    };
    expect(isPortfolioAllZero(data)).toBe(false);
  });

  it('is true for empty data', () => {
    expect(isPortfolioAllZero({})).toBe(true);
  });
});

describe('getLatestPortfolioValue', () => {
  it('returns the last point of the day series', () => {
    const data: PortfolioData = {
      day: series([
        [1000, '100.0'],
        [2000, '194.42'],
      ]),
    };
    expect(getLatestPortfolioValue(data)).toBe(194.42);
  });

  it('falls back to week/month/allTime when day is missing or empty', () => {
    expect(
      getLatestPortfolioValue({
        day: series([]),
        week: series([[1000, '190.5']]),
      }),
    ).toBe(190.5);
    expect(getLatestPortfolioValue({ allTime: series([[1000, '7.7']]) })).toBe(
      7.7,
    );
  });

  it('returns null when nothing is available', () => {
    expect(getLatestPortfolioValue({})).toBeNull();
    expect(getLatestPortfolioValue({ day: series([]) })).toBeNull();
  });
});

describe('compute24hChange', () => {
  it('uses pnlHistory last minus first, not accountValueHistory', () => {
    // Real-world shape from 2026-08-11: AV collapsed 80.92 -> 26.69 due to a
    // transfer while pnl only moved -0.44. The change must follow pnl.
    const data: PortfolioData = {
      day: {
        accountValueHistory: [
          [1000, '80.92'],
          [2000, '26.69'],
        ],
        pnlHistory: [
          [1000, '0.14'],
          [2000, '-0.30'],
        ],
        vlm: '0.0',
      },
    };
    const { pnl, percent } = compute24hChange(data);
    expect(pnl).toBeCloseTo(-0.44, 6);
    // denominator = current PV - pnl = 26.69 - (-0.44) = 27.13
    expect(percent).toBeCloseTo(-0.44 / 27.13, 6);
  });

  it('returns percent null when the denominator is not positive', () => {
    const data: PortfolioData = {
      day: {
        accountValueHistory: [
          [1000, '0.0'],
          [2000, '5.0'],
        ],
        pnlHistory: [
          [1000, '0.0'],
          [2000, '5.0'],
        ],
        vlm: '0.0',
      },
    };
    // denominator = 5 - 5 = 0
    expect(compute24hChange(data)).toEqual({ pnl: 5, percent: null });
  });

  it('returns zero change when the day series is missing or too short', () => {
    expect(compute24hChange({})).toEqual({ pnl: 0, percent: null });
    expect(
      compute24hChange({
        day: {
          accountValueHistory: [[1000, '10.0']],
          pnlHistory: [[1000, '1.0']],
          vlm: '0',
        },
      }),
    ).toEqual({ pnl: 0, percent: 0 });
  });
});

describe('toChartPoints', () => {
  it('maps [ts, value] tuples to chart points', () => {
    expect(
      toChartPoints(
        series([
          [1000, '1.5'],
          [2000, '2.5'],
        ]),
      ),
    ).toEqual([
      { timestamp: 1000, value: 1.5 },
      { timestamp: 2000, value: 2.5 },
    ]);
  });

  it('returns [] for undefined series', () => {
    expect(toChartPoints(undefined)).toEqual([]);
  });
});

describe('formatPortfolioTooltipTime', () => {
  // Timestamps are built through the local-time Date constructor so the
  // expected strings hold in any timezone the test machine runs in.
  const now = new Date(2026, 7, 27);

  it('formats current-year points as "MMM D, HH:mm"', () => {
    expect(
      formatPortfolioTooltipTime(new Date(2026, 7, 13, 8, 5).getTime(), now),
    ).toBe('Aug 13, 08:05');
  });

  it('leads with the year for points from previous years', () => {
    expect(
      formatPortfolioTooltipTime(new Date(2025, 0, 5, 14, 0).getTime(), now),
    ).toBe('2025 Jan 5, 14:00');
  });
});

describe('parsePortfolioResponseStrict', () => {
  it('returns parsed data for a well-formed response', () => {
    const raw = [rawEntry('day', series([[1000, '1.0']]))];
    expect(parsePortfolioResponseStrict(raw).day?.accountValueHistory).toEqual([
      [1000, '1.0'],
    ]);
  });

  it('throws on a malformed body instead of faking an empty account', () => {
    expect(() => parsePortfolioResponseStrict({ unexpected: true })).toThrow(
      'malformed',
    );
    expect(() => parsePortfolioResponseStrict(null)).toThrow('malformed');
  });
});
