import {
  getPagerDragPosition,
  resolvePagerBoundary,
  resolvePagerTarget,
} from '@rabby-wallet/rn-collapsible-scene-view/src/pagerMath';

const drag = { startIndex: 2, translationX: 0, width: 400, pageCount: 5 };
const release = { ...drag, velocityX: 0 };

describe('resolvePagerTarget', () => {
  it.each([
    [0, 2],
    [-99.99, 2],
    [-100, 3],
    [99.99, 2],
    [100, 1],
    [-4000, 3],
    [4000, 1],
  ])('resolves translation %s to page %s', (translationX, expected) => {
    expect(resolvePagerTarget({ ...release, translationX })).toBe(expected);
  });

  it('scales the distance threshold with the measured page width', () => {
    expect(
      resolvePagerTarget({ ...release, translationX: -199.99, width: 800 }),
    ).toBe(2);
    expect(
      resolvePagerTarget({ ...release, translationX: -200, width: 800 }),
    ).toBe(3);
  });

  it.each([
    [-12, -599.99, 2],
    [-11.99, -600, 2],
    [-12, -600, 3],
    [12, 599.99, 2],
    [11.99, 600, 2],
    [12, 600, 1],
    [0, -6000, 2],
    [0, 6000, 2],
  ])(
    'requires both meaningful displacement and velocity for a fling (%s, %s)',
    (translationX, velocityX, expected) => {
      expect(resolvePagerTarget({ ...release, translationX, velocityX })).toBe(
        expected,
      );
    },
  );

  it.each([
    [-120, 599.99, 3],
    [-120, 600, 1],
    [120, -599.99, 1],
    [120, -600, 3],
    [-12, 600, 1],
    [12, -600, 3],
  ])(
    'uses a strong final reversal, not a weak opposing velocity (%s, %s)',
    (translationX, velocityX, expected) => {
      expect(resolvePagerTarget({ ...release, translationX, velocityX })).toBe(
        expected,
      );
    },
  );

  it('does not let a small opposing velocity cancel an already qualified drag', () => {
    expect(
      resolvePagerTarget({ ...release, translationX: -100, velocityX: 300 }),
    ).toBe(3);
    expect(
      resolvePagerTarget({ ...release, translationX: 100, velocityX: -300 }),
    ).toBe(1);
  });

  it.each([
    [0, 4000, 6000, 0],
    [0, -4000, -6000, 1],
    [4, -4000, -6000, 4],
    [4, 4000, 6000, 3],
  ])(
    'clamps a large drag at page %s (%s, %s)',
    (startIndex, translationX, velocityX, expected) => {
      expect(
        resolvePagerTarget({ ...release, startIndex, translationX, velocityX }),
      ).toBe(expected);
    },
  );

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'stays at the start when width %s is not usable',
    width => {
      expect(
        resolvePagerTarget({
          ...release,
          width,
          translationX: -200,
          velocityX: -900,
        }),
      ).toBe(2);
    },
  );

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'returns the neutral index for invalid or absent pages (%s)',
    pageCount => {
      expect(
        resolvePagerTarget({ ...release, pageCount, translationX: -200 }),
      ).toBe(0);
    },
  );

  it('keeps a single page fixed and normalizes an out-of-range start', () => {
    expect(
      resolvePagerTarget({ ...release, pageCount: 1, translationX: -200 }),
    ).toBe(0);
    expect(resolvePagerTarget({ ...release, startIndex: -20 })).toBe(0);
    expect(resolvePagerTarget({ ...release, startIndex: 20 })).toBe(4);
  });

  it('does not spread non-finite event values into the target', () => {
    for (const translationX of [
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
    ]) {
      expect(
        resolvePagerTarget({ ...release, translationX, velocityX: -900 }),
      ).toBe(2);
    }
    expect(
      resolvePagerTarget({
        ...release,
        translationX: -100,
        velocityX: Number.NaN,
      }),
    ).toBe(3);
  });
});

describe('resolvePagerBoundary', () => {
  it.each<[number, number, 'prev' | 'next' | null]>([
    [0, 59.99, null],
    [0, 60, 'prev'],
    [0, 600, 'prev'],
    [0, -600, null],
    [4, -59.99, null],
    [4, -60, 'next'],
    [4, -600, 'next'],
    [4, 600, null],
    [2, -4000, null],
    [2, 4000, null],
  ])(
    'only hands off an outward pull from its starting edge (%s, %s)',
    (startIndex, translationX, expected) => {
      expect(
        resolvePagerBoundary({ startIndex, translationX, pageCount: 5 }),
      ).toBe(expected);
    },
  );

  it('supports both outer directions for a single-page child track', () => {
    expect(
      resolvePagerBoundary({ startIndex: 0, translationX: 60, pageCount: 1 }),
    ).toBe('prev');
    expect(
      resolvePagerBoundary({ startIndex: 0, translationX: -60, pageCount: 1 }),
    ).toBe('next');
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'does not hand off when no valid pages exist (%s)',
    pageCount => {
      expect(
        resolvePagerBoundary({ startIndex: 0, translationX: 600, pageCount }),
      ).toBeNull();
    },
  );

  it('ignores non-finite translations', () => {
    expect(
      resolvePagerBoundary({
        startIndex: 0,
        translationX: Number.POSITIVE_INFINITY,
        pageCount: 5,
      }),
    ).toBeNull();
    expect(
      resolvePagerBoundary({
        startIndex: 4,
        translationX: Number.NaN,
        pageCount: 5,
      }),
    ).toBeNull();
  });
});

describe('getPagerDragPosition', () => {
  it.each([
    [0, 2],
    [-40, 2.1],
    [100, 1.75],
    [-200, 2.5],
    [-400, 3],
    [400, 1],
    [-4000, 3],
    [4000, 1],
  ])(
    'follows translation %s within the immediate neighbours',
    (translationX, expected) => {
      expect(getPagerDragPosition({ ...drag, translationX })).toBeCloseTo(
        expected,
      );
    },
  );

  it('returns to the settled starting position when opposing movement nets to zero', () => {
    expect(getPagerDragPosition({ ...drag, translationX: -200 })).toBe(2.5);
    expect(getPagerDragPosition({ ...drag, translationX: 0 })).toBe(2);
    expect(getPagerDragPosition({ ...drag, translationX: 200 })).toBe(1.5);
  });

  it.each([
    [0, 4000, 0],
    [0, -4000, 1],
    [4, -4000, 4],
    [4, 4000, 3],
  ])(
    'clamps an edge drag at start %s / translation %s',
    (startIndex, translationX, expected) => {
      expect(getPagerDragPosition({ ...drag, startIndex, translationX })).toBe(
        expected,
      );
    },
  );

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'keeps a valid starting position for unusable width %s',
    width => {
      expect(getPagerDragPosition({ ...drag, width, translationX: -200 })).toBe(
        2,
      );
    },
  );

  it.each([0, 1, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'uses the neutral position with no movable pages (%s)',
    pageCount => {
      expect(
        getPagerDragPosition({ ...drag, pageCount, translationX: -200 }),
      ).toBe(0);
    },
  );

  it('normalizes invalid starting indices without leaking NaN', () => {
    expect(getPagerDragPosition({ ...drag, startIndex: -20 })).toBe(0);
    expect(getPagerDragPosition({ ...drag, startIndex: 20 })).toBe(4);
    expect(getPagerDragPosition({ ...drag, startIndex: Number.NaN })).toBe(0);
    expect(getPagerDragPosition({ ...drag, translationX: Number.NaN })).toBe(2);
  });
});
