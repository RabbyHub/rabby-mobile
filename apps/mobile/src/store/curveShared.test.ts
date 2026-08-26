jest.mock('@/constant/currency', () => ({
  USD_CURRENCY: {
    symbol: '$',
    usd_rate: 1,
  },
}));
jest.mock('@/utils/curveDayType', () => ({
  CurveDayType: {
    DAY: 'DAY',
  },
}));
jest.mock('@/utils/number', () => ({
  coerceFloat: (value: unknown, fallback: number) =>
    typeof value === 'number' ? value : fallback,
  formatCurrency: (value: number) => String(value),
  formatUsdValue: (value: number) => String(value),
  splitNumberByStep: (value: string) => value,
}));

import { combineMultiCurve, type CurveList } from './curveShared';

function combineMultiCurveReference(curves: CurveList[]) {
  if (!curves.length) {
    return [];
  }

  const startTime = curves[0]?.[0]?.timestamp ?? 0;
  const interval = 30 * 60;
  const result: CurveList = Array.from({ length: 48 }, (_, index) => {
    const windowStart = startTime + index * interval;
    const windowEnd = windowStart + interval;
    let sum = 0;
    let count = 0;

    curves.forEach(addressData => {
      const points = addressData.filter(
        point => point.timestamp >= windowStart && point.timestamp < windowEnd,
      );
      if (!points.length) {
        return;
      }

      const latest = points.reduce((currentLatest, point) =>
        point.timestamp > currentLatest.timestamp ? point : currentLatest,
      );
      sum += latest.usd_value;
      count += 1;
    });

    return {
      timestamp: windowEnd,
      usd_value: count ? sum : 0,
    };
  });

  result[0] = {
    timestamp: startTime,
    usd_value: curves.reduce(
      (sum, curve) => sum + (curve[0]?.usd_value ?? 0),
      0,
    ),
  };
  result[result.length - 1] = {
    timestamp: startTime + 47 * interval,
    usd_value: curves.reduce(
      (sum, curve) => sum + (curve[curve.length - 1]?.usd_value ?? 0),
      0,
    ),
  };

  return result;
}

function createRandom(seed: number) {
  const modulus = 0x100000000;
  let state = seed % modulus;
  return () => {
    state = (state * 1664525 + 1013904223) % modulus;
    return state / modulus;
  };
}

describe('combineMultiCurve', () => {
  it('preserves window-boundary and out-of-order point semantics', () => {
    const interval = 30 * 60;
    const start = 1_700_000_000;
    const curves: CurveList[] = [
      [
        { timestamp: start, usd_value: 1 },
        { timestamp: start + interval - 1, usd_value: 2 },
        { timestamp: start + 1, usd_value: 3 },
        { timestamp: start + interval, usd_value: 4 },
      ],
      [
        { timestamp: start - 1, usd_value: 10 },
        { timestamp: start + interval + 5, usd_value: 20 },
        { timestamp: start + interval + 2, usd_value: 30 },
        { timestamp: start + 48 * interval, usd_value: 40 },
      ],
      [],
    ];

    expect(combineMultiCurve(curves)).toEqual(
      combineMultiCurveReference(curves),
    );
  });

  it('matches the previous algorithm for high-cardinality curve fixtures', () => {
    const random = createRandom(0x5eed);
    const start = 1_700_000_000;
    const interval = 30 * 60;
    const curves: CurveList[] = Array.from(
      { length: 100 },
      (_curve, curveIndex) => {
        const points: CurveList = Array.from(
          { length: 96 },
          (_point, pointIndex) => ({
            timestamp:
              start +
              Math.floor((random() * 52 - 2) * interval) +
              (pointIndex % 3),
            usd_value: curveIndex * 100 + random() * 100,
          }),
        );

        return points.sort(() => random() - 0.5);
      },
    );

    curves[0].unshift({ timestamp: start, usd_value: 123 });

    expect(combineMultiCurve(curves)).toEqual(
      combineMultiCurveReference(curves),
    );
  });

  it('returns an empty list when there are no curves', () => {
    expect(combineMultiCurve([])).toEqual([]);
  });
});
