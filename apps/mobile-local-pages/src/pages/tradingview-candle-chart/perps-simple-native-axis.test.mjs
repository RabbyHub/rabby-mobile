import assert from 'node:assert/strict';
import test from 'node:test';
import { createSimpleNativePriceAxis } from './perps-simple-native-axis.ts';
import { simpleDraggedPriceRange } from './perps-simple-axis.ts';

function setup() {
  const state = {
    active: true,
    range: { from: 90, to: 110 },
    height: 200,
    starts: 0,
    updates: [],
  };
  const axis = createSimpleNativePriceAxis({
    isActive: () => state.active,
    getRange: () => state.range,
    getHeight: () => state.height,
    setRange: range => {
      state.range = range;
      state.updates.push(range);
    },
    onStart: () => {
      state.starts++;
    },
  });
  const command = (phase, deltaY = 0, extra = {}) => ({
    type: 'PERPS_SIMPLE_CHART',
    identity: 'BTC',
    sequence: 1,
    action: 'priceAxis',
    phase,
    deltaY,
    session: axis.session,
    gestureId: 1,
    ...extra,
  });
  return { axis, state, command };
}

test('native axis uses the Android formula with the original range and height', () => {
  const { axis, state, command } = setup();
  const original = { ...state.range };
  axis.handle(command('start'));
  axis.handle(command('move', 50));
  assert.deepEqual(state.range, simpleDraggedPriceRange(original, 50, 200));
  state.height = 300;
  axis.handle(command('move', -20));
  assert.deepEqual(state.range, simpleDraggedPriceRange(original, -20, 200));
  axis.handle(command('end', 0));
  assert.deepEqual(state.range, original);
  assert.equal(axis.dragging, false);
  assert.equal(axis.handle(command('move', 30)), false);
  assert.equal(state.starts, 1);
});

test('invalidated sessions and completed or cancelled gesture IDs cannot resume', () => {
  const { axis, state, command } = setup();
  const previousSession = axis.session;
  axis.handle(command('start'));
  axis.cancel();
  assert.equal(
    axis.handle(command('move', 30, { session: previousSession })),
    false,
  );
  assert.equal(
    axis.handle(
      command('start', 0, { session: previousSession, gestureId: 2 }),
    ),
    false,
  );
  assert.equal(axis.handle(command('start')), false);
  assert.equal(axis.handle(command('start', 0, { gestureId: 2 })), true);
  axis.handle(command('cancel', 0, { gestureId: 2 }));
  assert.equal(axis.handle(command('end', 30, { gestureId: 2 })), false);
  assert.equal(state.updates.length, 0);
});

test('inactive, invalid geometry and taps do not alter the scale', () => {
  const { axis, state, command } = setup();
  state.active = false;
  assert.equal(axis.handle(command('start')), false);
  state.active = true;
  state.height = 0;
  assert.equal(axis.handle(command('start')), false);
  state.height = 200;
  axis.handle(command('start', 0, { gestureId: 2 }));
  axis.handle(command('end', 0, { gestureId: 2 }));
  assert.equal(state.updates.length, 0);
  assert.equal(axis.handle(command('start', NaN, { gestureId: 3 })), false);
});
