import assert from 'node:assert/strict';
import test from 'node:test';
import {
  layoutSimplePriceLabels,
  simpleDefaultRange,
  simpleRangeReference,
  simpleRangeCoverage,
} from './perps-simple-logic.ts';

const candle = time => ({ time, open: 100, high: 110, low: 90, close: 105 });
test('latest badge is pinned while other labels keep price order and gaps at every edge', () => {
  for (const anchor of [0, 1, 7, 100, 267, 273, 274]) {
    const values = [
      anchor,
      anchor - 1,
      anchor + 1,
      anchor,
      anchor + 2,
      anchor - 2,
    ];
    const result = layoutSimplePriceLabels(values, 274, 0);
    assert.equal(result[0], Math.max(7, Math.min(267, anchor)));
    const sorted = [...result].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++)
      assert.ok(sorted[i] - sorted[i - 1] >= 17);
    assert.ok(result[5] < result[1] && result[1] < result[0]);
    assert.ok(result[0] < result[3] && result[3] < result[2]);
    assert.ok(result[2] < result[4]);
  }
  assert.deepEqual(
    layoutSimplePriceLabels([100, 99, 101, 102, 103], 274, 0),
    [100, 83, 117, 134, 151],
  );
  assert.deepEqual(
    layoutSimplePriceLabels([260, 261, 262, 263], 274, 0),
    [260, 277, 294, 311],
  );
  assert.deepEqual(
    layoutSimplePriceLabels([10, 9, 8, 7], 274, 0),
    [10, -7, -24, -41],
  );
});
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
