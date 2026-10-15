import assert from 'node:assert/strict';
import test from 'node:test';
import {
  avoidSimpleLabelOverlap,
  candleEnd,
  simpleDefaultRange,
  simpleFillMarkers,
  simpleHistoryShift,
  simpleRangeReference,
  simpleRangeCoverage,
  visibleLastCandle,
} from './perps-simple-logic.ts';

const candle = time => ({ time, open: 100, high: 110, low: 90, close: 105 });
test('coverage distinguishes short history from gaps and retains the pre-aggregation boundary', () => {
  const day = 86400;
  const config = { range: '1W', interval: '1d' };
  const full = Array.from({ length: 10 }, (_, i) => candle(i * day));
  assert.deepEqual(simpleRangeCoverage(full, config, 0), {
    kind: 'complete',
    start: 3 * day,
  });
  assert.equal(
    simpleRangeCoverage(full.slice(5), config, 5 * day).kind,
    'short',
  );
  assert.equal(
    simpleRangeCoverage(
      full.filter(c => c.time !== 3 * day),
      config,
      0,
    ).kind,
    'gap',
  );
  assert.equal(
    simpleRangeCoverage(full, config, undefined).kind,
    'unavailable',
  );
  const weekly = [0, 7, 14, 21, 28].map(d => candle(d * day));
  assert.equal(
    simpleRangeReference(weekly, { range: '1M', interval: '1w' }),
    100,
  );
  // The first week's Monday predates its actual first daily candle.
  assert.equal(
    simpleRangeCoverage(weekly, { range: '1M', interval: '1w' }, 6 * day).kind,
    'short',
  );
  const partial = [candle(10 * day)];
  assert.equal(
    simpleRangeCoverage(partial, { range: '1D', interval: '30m' }, 10 * day)
      .kind,
    'short',
  );
  assert.equal(
    simpleRangeCoverage(full, { range: '1D', interval: '1d' }, 0).kind,
    'daily',
  );
  assert.equal(
    simpleRangeCoverage(full, { range: null, interval: '1d' }, 0).kind,
    'unavailable',
  );
});
test('outside title strokes retain the minimum gap', () => {
  const centers = avoidSimpleLabelOverlap([40, 40, 40, 40], 280, 18);
  for (let i = 1; i < centers.length; i++)
    assert.ok(centers[i] - centers[i - 1] >= 21);
});
test('3M clamps month ends and its change reference matches the default window', () => {
  const candles = Array.from({ length: 130 }, (_, i) => ({
    ...candle(Date.UTC(2024, 1, 1 + i) / 1000),
    open: i + 100,
  })).filter(c => c.time < Date.UTC(2024, 4, 31) / 1000);
  const config = { range: '3M', interval: '1d' };
  const range = simpleDefaultRange(candles, config, 325);
  const first = candles[range.from + 0.5];
  assert.equal(first.time, Date.UTC(2024, 1, 29) / 1000);
  assert.equal(simpleRangeReference(candles, config), first.open);
  assert.equal(simpleRangeReference(candles.slice(29), config), null);
});
test('references follow the range, not viewport width, and refuse missing history or invalid prices', () => {
  const candles = Array.from({ length: 400 }, (_, i) => ({
    ...candle(i * 86400),
    open: i + 1,
  }));
  for (const range of ['1W', '1M', '3M', '1Y']) {
    const config = { range, interval: '1d' };
    const small = simpleDefaultRange(candles, config, 220);
    assert.deepEqual(small, simpleDefaultRange(candles, config, 600));
    assert.equal(
      simpleRangeReference(candles, config),
      candles[small.from + 0.5].open,
    );
    assert.equal(simpleRangeReference(candles.slice(-2), config), null);
  }
  assert.equal(
    simpleRangeReference(candles, { range: '1D', interval: '1d' }),
    null,
  );
  assert.equal(
    simpleRangeReference(candles, { range: null, interval: '1d' }),
    null,
  );
  assert.equal(
    simpleRangeReference(
      candles.map(c => ({ ...c, open: NaN })),
      { range: '1W', interval: '1d' },
    ),
    null,
  );
});
test('history prepends and bounded cache trims retain the same visible candles', () => {
  const previous = [candle(60), candle(120), candle(180)];
  assert.equal(simpleHistoryShift(previous, [candle(0), ...previous]), 1);
  assert.equal(
    simpleHistoryShift(previous, [candle(120), candle(180), candle(240)]),
    -1,
  );
});
test('1D and 1W show the requested window, not all 500 loaded candles', () => {
  const candles = Array.from({ length: 500 }, (_, i) =>
    candle(1700000000 + i * 900),
  );
  assert.deepEqual(
    simpleDefaultRange(candles, { range: '1D', interval: '15m' }, 325),
    { from: 403.5, to: 499.5 },
  );
  const hourly = Array.from({ length: 500 }, (_, i) =>
    candle(1700000000 + i * 3600),
  );
  assert.deepEqual(
    simpleDefaultRange(hourly, { range: '1W', interval: '1h' }, 325),
    { from: 331.5, to: 499.5 },
  );
});
test('calendar months include leap day and use the real next month boundary', () => {
  const feb = Date.UTC(2024, 1, 1) / 1000;
  assert.equal(candleEnd(feb, '1M'), Date.UTC(2024, 2, 1) / 1000);
  const candles = Array.from({ length: 60 }, (_, i) =>
    candle(Date.UTC(2024, 0, 1 + i) / 1000),
  );
  assert.deepEqual(
    simpleDefaultRange(candles, { range: '1M', interval: '1d' }, 325),
    { from: 30.5, to: 59.5 },
  );
});
test('visible rightmost close is independent of the globally latest candle', () => {
  const candles = [candle(0), candle(60), candle(120)];
  assert.equal(visibleLastCandle(candles, { from: 0, to: 1.9 }), candles[1]);
  assert.equal(visibleLastCandle(candles, { from: -2, to: -1 }), null);
});
test('markers use returned 3d bucket boundaries, deduplicate each direction, and skip gaps', () => {
  const candles = [candle(86400), candle(864000)];
  assert.deepEqual(
    simpleFillMarkers(
      candles,
      [
        { time: 86401, side: 'B' },
        { time: 86402, side: 'B' },
        { time: 86403, side: 'A' },
        { time: 345600, side: 'B' },
        { time: 500000, side: 'B' },
      ],
      '3d',
    ),
    [
      { time: 86400, side: 'B' },
      { time: 86400, side: 'A' },
    ],
  );
});
test('labels separate at both edges without changing their underlying price values', () => {
  const values = [205, 203, 1, 2, 100, 100];
  const result = avoidSimpleLabelOverlap(values, 208).sort((a, b) => a - b);
  assert.ok(result[0] >= 7 && result.at(-1) <= 201);
  for (let i = 1; i < result.length; i++)
    assert.ok(result[i] - result[i - 1] >= 17);
  assert.deepEqual(values, [205, 203, 1, 2, 100, 100]);
});
test('entry, TP, SL and liquidation titles retain stable order and 3px gaps when crowded', () => {
  for (const values of [
    [0, 0, 0, 0],
    [208, 208, 208, 208],
    [100, 100, 100, 100],
    [95.5, 94.56, 96.42, 97.34],
  ]) {
    const result = avoidSimpleLabelOverlap(values, 208, 16);
    const order = values
      .map((y, index) => ({ y, index }))
      .sort((a, b) => a.y - b.y || a.index - b.index);
    assert.ok(result.every(y => y >= 8 && y <= 200));
    for (let i = 1; i < order.length; i++)
      assert.ok(result[order[i].index] - result[order[i - 1].index] >= 19);
  }
});
