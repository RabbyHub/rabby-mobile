import assert from 'node:assert/strict';
import test from 'node:test';
import { simpleDraggedPriceRange } from './perps-simple-axis.ts';

test('axis dragging scales around the original midpoint without cumulative drift', () => {
  const original = { from: 90, to: 110 };
  assert.deepEqual(simpleDraggedPriceRange(original, 0, 200), original);
  const wider = simpleDraggedPriceRange(original, 50, 200);
  const tighter = simpleDraggedPriceRange(original, -50, 200);
  assert.equal((wider.from + wider.to) / 2, 100);
  assert.ok(wider.from < 90 && wider.to > 110);
  assert.ok(tighter.from > 90 && tighter.to < 110);
  assert.deepEqual(simpleDraggedPriceRange(original, 0, 200), original);
});
test('zero height, invalid prices and extreme drags cannot create an invalid axis', () => {
  for (const [range, delta, height] of [
    [{ from: 1, to: 1 }, 5, 200],
    [{ from: 1, to: 2 }, 5, 0],
    [{ from: NaN, to: 2 }, 5, 200],
    [{ from: 1, to: 2 }, Infinity, 200],
  ])
    assert.equal(simpleDraggedPriceRange(range, delta, height), null);
  for (const delta of [-1e20, 1e20]) {
    const next = simpleDraggedPriceRange(
      { from: 0.0001, to: 0.0002 },
      delta,
      200,
    );
    assert.ok(
      Number.isFinite(next.from) &&
        Number.isFinite(next.to) &&
        next.to > next.from,
    );
  }
});
