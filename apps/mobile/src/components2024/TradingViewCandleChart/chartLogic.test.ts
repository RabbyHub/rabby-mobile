jest.mock(
  'lightweight-charts/standalone',
  () => ({
    createSeriesMarkers: jest.fn(),
  }),
  { virtual: true },
);

const {
  calculateSimpleMovingAverage,
  clampPerpsProCrosshairCoordinate,
  constrainPerpsProFutureLogicalRange,
  formatPerpsProCrosshairChange,
  formatPerpsProCrosshairPrice,
  formatProCompactNumber,
  formatProPrice,
  formatProTooltipTime,
  getInitialVisibleLogicalRange,
  getPrependedCandleCount,
  getPerpsProLatestCandleClose,
  getPerpsProTooltipPlacement,
  getPerpsProTooltipMetrics,
  shiftLogicalRangeForPrependedCandles,
} =
  require('../../../../mobile-local-pages/src/pages/tradingview-candle-chart/chart-logic') as typeof import('../../../../mobile-local-pages/src/pages/tradingview-candle-chart/chart-logic');

const candle = (time: number, close: number) => ({
  close,
  high: close + 2,
  low: close - 2,
  open: close - 1,
  quoteTurnover: null,
  time,
  trades: 1,
  volume: 2,
});

describe('Perps Pro local chart calculations', () => {
  it('calculates close SMA only after a complete window', () => {
    const candles = [1, 2, 3, 4, 5].map((close, index) => candle(index, close));

    expect(calculateSimpleMovingAverage(candles, 7)).toEqual([]);
    expect(calculateSimpleMovingAverage(candles, 3)).toEqual([
      { time: 2, value: 2 },
      { time: 3, value: 3 },
      { time: 4, value: 4 },
    ]);
    expect(
      calculateSimpleMovingAverage([...candles, candle(5, 8)], 3).at(-1),
    ).toEqual({ time: 5, value: 17 / 3 });
  });

  it.each([7, 25, 99] as const)(
    'calculates every approved MA(%s) period and replaces the realtime tail',
    period => {
      const candles = Array.from({ length: 100 }, (_, index) =>
        candle(index, index + 1),
      );
      const points = calculateSimpleMovingAverage(candles, period);

      expect(points).toHaveLength(candles.length - period + 1);
      expect(points[0]).toEqual({
        time: period - 1,
        value: (period + 1) / 2,
      });

      const updatedCandles = [...candles.slice(0, -1), candle(99, 200)];
      expect(
        calculateSimpleMovingAverage(updatedCandles, period).at(-1),
      ).toEqual({
        time: 99,
        value:
          points.at(-1)!.value + (updatedCandles.at(-1)!.close - 100) / period,
      });
    },
  );

  it('calculates change and range safely with zero classified as green', () => {
    expect(
      getPerpsProTooltipMetrics({
        close: 110,
        high: 120,
        low: 90,
        open: 100,
      }),
    ).toEqual({
      change: 10,
      changePercent: 10,
      isPositive: true,
      rangePercent: 30,
    });
    expect(
      getPerpsProTooltipMetrics({
        close: 100,
        high: 100,
        low: 100,
        open: 100,
      }),
    ).toMatchObject({
      change: 0,
      changePercent: 0,
      isPositive: true,
      rangePercent: 0,
    });
    expect(
      getPerpsProTooltipMetrics({
        close: 1,
        high: 1,
        low: 1,
        open: 0,
      }),
    ).toEqual({
      change: null,
      changePercent: null,
      isPositive: true,
      rangePercent: null,
    });
  });

  it('formats approved price precision and compact units', () => {
    expect(formatProPrice(12.6, 0)).toBe('13');
    expect(formatProPrice(-0, 2)).toBe('0.00');
    expect(formatProPrice(66107.71, 2)).toBe('66,107.71');
    expect(formatProPrice(-66107.71, 2)).toBe('-66,107.71');
    expect(formatProCompactNumber(1_250)).toBe('1.25K');
    expect(formatProCompactNumber(2_500_000)).toBe('2.50M');
    expect(formatProCompactNumber(3_750_000_000)).toBe('3.75B');
    expect(formatProCompactNumber(null)).toBe('--');
  });

  it('formats the crosshair ordinate and change against the latest price', () => {
    expect(formatPerpsProCrosshairPrice(66107.71, 2)).toBe('66,107.71');
    expect(formatPerpsProCrosshairChange(105, 100)).toBe('+5.00%');
    expect(formatPerpsProCrosshairChange(95, 100)).toBe('-5.00%');
    expect(formatPerpsProCrosshairChange(100, 100)).toBe('+0.00%');
    expect(formatPerpsProCrosshairChange(99.999999, 100)).toBe('+0.00%');
  });

  it('fails closed when the newest candle cannot provide a latest price', () => {
    expect(getPerpsProLatestCandleClose([{ close: 100 }, { close: 120 }])).toBe(
      120,
    );
    expect(
      getPerpsProLatestCandleClose([{ close: 100 }, { close: Number.NaN }]),
    ).toBeNull();
    expect(
      getPerpsProLatestCandleClose([{ close: 100 }, { close: 0 }]),
    ).toBeNull();
    expect(getPerpsProLatestCandleClose([])).toBeNull();
    expect(formatPerpsProCrosshairChange(100, null)).toBeNull();
    expect(formatPerpsProCrosshairChange(100, 0)).toBeNull();
  });

  it.each([320, 360, 393, 430])(
    'keeps the Pro tooltip outside the right price scale at %spx',
    width => {
      const plotWidth = width - 66;
      expect(getPerpsProTooltipPlacement(plotWidth / 2 - 1, width)).toEqual({
        left: null,
        right: 74,
      });
      expect(getPerpsProTooltipPlacement(plotWidth / 2, width)).toEqual({
        left: 8,
        right: null,
      });
    },
  );

  it('uses device-local time and the approved day-level format', () => {
    const time = Date.UTC(2026, 6, 30, 1, 2) / 1000;
    const localDate = new Date(time * 1000);
    const month = String(localDate.getMonth() + 1).padStart(2, '0');
    const day = String(localDate.getDate()).padStart(2, '0');
    const hours = String(localDate.getHours()).padStart(2, '0');
    const minutes = String(localDate.getMinutes()).padStart(2, '0');
    const year = String(localDate.getFullYear());

    expect(formatProTooltipTime(time, '15m')).toBe(
      `${year}-${month}-${day} ${hours}:${minutes}`,
    );
    expect(formatProTooltipTime(time, '1d')).toBe(`${year}-${month}-${day}`);
    expect(formatProTooltipTime(time, '1M')).toBe(`${year}-${month}-${day}`);
  });

  it('opens the initial logical range on at most the latest 40 candles', () => {
    expect(getInitialVisibleLogicalRange(500, 40)).toEqual({
      from: 460,
      to: 500,
    });
    expect(getInitialVisibleLogicalRange(12, 40)).toEqual({
      from: 0,
      to: 12,
    });
  });

  it('keeps the Pro crosshair inside the approved price-scale margins', () => {
    expect(clampPerpsProCrosshairCoordinate(-100, 200)).toBe(24);
    expect(clampPerpsProCrosshairCoordinate(100, 200)).toBe(100);
    expect(clampPerpsProCrosshairCoordinate(300, 200)).toBe(168);
  });

  it('allows future whitespace while keeping at least five candles visible', () => {
    expect(
      constrainPerpsProFutureLogicalRange({ from: 80, to: 120 }, 100),
    ).toEqual({ from: 80, to: 120 });
    expect(
      constrainPerpsProFutureLogicalRange({ from: 110, to: 150 }, 100),
    ).toEqual({ from: 95, to: 135 });
    expect(
      constrainPerpsProFutureLogicalRange({ from: 110, to: 112 }, 100),
    ).toEqual({ from: 95, to: 100 });
    expect(constrainPerpsProFutureLogicalRange({ from: 3, to: 43 }, 3)).toEqual(
      { from: 0, to: 40 },
    );
  });

  it('counts prepended candles so a history merge can preserve the viewport', () => {
    expect(
      getPrependedCandleCount(
        [{ time: 3 }, { time: 4 }],
        [{ time: 1 }, { time: 2 }, { time: 3 }, { time: 4 }],
      ),
    ).toBe(2);
    expect(
      getPrependedCandleCount([{ time: 3 }], [{ time: 3 }, { time: 4 }]),
    ).toBe(0);
  });

  it('keeps the viewport when the official last page only extends an aggregate', () => {
    expect(
      shiftLogicalRangeForPrependedCandles({ from: 4, to: 44 }, 0),
    ).toEqual({ from: 4, to: 44 });
    expect(
      shiftLogicalRangeForPrependedCandles({ from: 4, to: 44 }, 10),
    ).toEqual({ from: 14, to: 54 });
  });
});
