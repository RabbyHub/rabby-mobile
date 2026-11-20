import {
  clampTrackPosition,
  resolveSettleTarget,
  resolveTrackPageIndex,
  splitTrackDelta,
} from './continuousTrack';

const page = (start: number, end: number) => ({ end, start });

describe('clampTrackPosition', () => {
  it('clamps into the range', () => {
    expect(clampTrackPosition(-1, page(0, 3))).toBe(0);
    expect(clampTrackPosition(1.5, page(0, 3))).toBe(1.5);
    expect(clampTrackPosition(9, page(0, 3))).toBe(3);
  });

  it('tolerates a reversed or non-finite input', () => {
    expect(clampTrackPosition(2, page(3, 0))).toBe(2);
    expect(clampTrackPosition(Number.NaN, page(0, 3))).toBe(0);
  });
});

describe('splitTrackDelta', () => {
  it('consumes the delta inside the range', () => {
    expect(
      splitTrackDelta({ delta: 0.4, range: page(0, 1), start: 0 }),
    ).toEqual({ overflow: 0, position: 0.4 });
  });

  it('reports the overflow past an edge for parent chaining', () => {
    const forward = splitTrackDelta({
      delta: 0.6,
      range: page(0, 1),
      start: 0.8,
    });
    expect(forward.position).toBe(1);
    expect(forward.overflow).toBeCloseTo(0.4, 6);

    const backward = splitTrackDelta({
      delta: -0.5,
      range: page(0, 1),
      start: 0.2,
    });
    expect(backward.position).toBe(0);
    expect(backward.overflow).toBeCloseTo(-0.3, 6);
  });
});

describe('resolveSettleTarget', () => {
  it('free stays exactly where the finger left it', () => {
    expect(
      resolveSettleTarget({
        mode: 'free',
        position: 0.42,
        range: page(0, 3),
        start: 0,
        velocityPages: 4,
      }),
    ).toBe(0.42);
  });

  it('snap advances with a flick even below half a page', () => {
    expect(
      resolveSettleTarget({
        mode: 'snap',
        position: 0.3,
        range: page(0, 3),
        start: 0,
        velocityPages: 3,
      }),
    ).toBe(1);
  });

  it('snap returns below half a page without velocity', () => {
    expect(
      resolveSettleTarget({
        mode: 'snap',
        position: 0.3,
        range: page(0, 3),
        start: 0,
        velocityPages: 0,
      }),
    ).toBe(0);
    expect(
      resolveSettleTarget({
        mode: 'snap',
        position: 0.6,
        range: page(0, 3),
        start: 0,
        velocityPages: 0,
      }),
    ).toBe(1);
  });

  it('snap clamps the projection to the range', () => {
    expect(
      resolveSettleTarget({
        mode: 'snap',
        position: 0.99,
        range: page(0, 1),
        start: 0,
        velocityPages: 20,
      }),
    ).toBe(1);
    expect(
      resolveSettleTarget({
        mode: 'snap',
        position: 0.01,
        range: page(0, 1),
        start: 1,
        velocityPages: -20,
      }),
    ).toBe(0);
  });

  it('never advances more than one page, however fast the flick', () => {
    // The old formula projected velocity * 0.18 pages and could skip a tab
    // (e.g. 0.31 + 9.26 * 0.18 => 2).
    expect(
      resolveSettleTarget({
        mode: 'snap',
        position: 0.2,
        range: page(0, 3),
        start: 0,
        velocityPages: 60,
      }),
    ).toBe(1);
    expect(
      resolveSettleTarget({
        mode: 'snap',
        position: 2.8,
        range: page(0, 3),
        start: 3,
        velocityPages: -60,
      }),
    ).toBe(2);
  });

  it('uses the gesture origin, not a fractional mid-flight value', () => {
    // A settle interrupted at 1.86 must not make the next gesture able to
    // land on 3; it starts from the page it was already committed to.
    expect(
      resolveSettleTarget({
        mode: 'snap',
        position: 2.3,
        range: page(0, 3),
        start: 2,
        velocityPages: 9,
      }),
    ).toBe(3);
    expect(
      resolveSettleTarget({
        mode: 'snap',
        position: 1.9,
        range: page(0, 3),
        start: 2,
        velocityPages: 9,
      }),
    ).toBe(2);
  });

  it('does not advance when the release velocity contradicts the drag', () => {
    expect(
      resolveSettleTarget({
        mode: 'snap',
        position: 0.2,
        range: page(0, 3),
        start: 0,
        velocityPages: -6,
      }),
    ).toBe(0);
  });
});

describe('resolveTrackPageIndex', () => {
  it('rounds to the nearest page inside the range', () => {
    expect(resolveTrackPageIndex(0.4, page(0, 3))).toBe(0);
    expect(resolveTrackPageIndex(0.6, page(0, 3))).toBe(1);
    expect(resolveTrackPageIndex(9, page(0, 3))).toBe(3);
  });
});
