import {
  isLinkedPagerRowInViewport,
  resolveLinkedPagerOwner,
  type LinkedPagerOwner,
  type LinkedPagerOwnerInput,
  type LinkedPagerRowBounds,
  type LinkedPagerTrack,
  type LinkedPagerViewport,
} from './linkedPagerMath';

describe('isLinkedPagerRowInViewport', () => {
  const viewport = { offset: 1000, height: 200 };

  it.each<[number, number, number, boolean]>([
    [900, 999, 0, false],
    [900, 1000, 0, true],
    [900, 1001, 0, true],
    [1000, 1100, 0, true],
    [1199, 1300, 0, true],
    [1200, 1300, 0, true],
    [1201, 1300, 0, false],
    [800, 899, 100, false],
    [800, 900, 100, true],
    [1250, 1300, 100, true],
    [1300, 1400, 100, true],
    [1301, 1400, 100, false],
  ])(
    'resolves exact bounds [%s, %s] with overscan %s as %s',
    (startOffset, endOffset, overscan, expected) => {
      expect(
        isLinkedPagerRowInViewport(
          { startOffset, endOffset },
          viewport,
          overscan,
        ),
      ).toBe(expected);
    },
  );

  it.each<LinkedPagerRowBounds | undefined>([
    undefined,
    { startOffset: -1, endOffset: 100 },
    { startOffset: 0, endOffset: 0 },
    { startOffset: 100, endOffset: 0 },
    { startOffset: Number.NaN, endOffset: 100 },
    { startOffset: Number.POSITIVE_INFINITY, endOffset: 100 },
    { startOffset: 0, endOffset: Number.NaN },
    { startOffset: 0, endOffset: Number.POSITIVE_INFINITY },
  ])('keeps unknown or invalid bounds participating: %s', bounds => {
    expect(isLinkedPagerRowInViewport(bounds, viewport, 0)).toBe(true);
  });

  it.each<LinkedPagerViewport>([
    { offset: -1, height: 200 },
    { offset: Number.NaN, height: 200 },
    { offset: Number.POSITIVE_INFINITY, height: 200 },
    { offset: 1000, height: 0 },
    { offset: 1000, height: -1 },
    { offset: 1000, height: Number.NaN },
    { offset: 1000, height: Number.POSITIVE_INFINITY },
  ])('keeps rows participating before valid viewport geometry: %s', invalid => {
    expect(
      isLinkedPagerRowInViewport({ startOffset: 0, endOffset: 96 }, invalid, 0),
    ).toBe(true);
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])(
    'does not cull rows with invalid overscan %s',
    overscan => {
      expect(
        isLinkedPagerRowInViewport(
          { startOffset: 0, endOffset: 96 },
          viewport,
          overscan,
        ),
      ).toBe(true);
    },
  );

  it('uses deep content coordinates without shifting them back to the row origin', () => {
    const deepViewport = Object.freeze({ offset: 10000, height: 800 });
    const row = (index: number) =>
      Object.freeze({
        startOffset: 416 + index * 96,
        endOffset: 416 + (index + 1) * 96,
      });
    expect(isLinkedPagerRowInViewport(row(0), deepViewport, 96)).toBe(false);
    expect(isLinkedPagerRowInViewport(row(100), deepViewport, 96)).toBe(true);
    expect(isLinkedPagerRowInViewport(row(109), deepViewport, 96)).toBe(true);
    expect(isLinkedPagerRowInViewport(row(110), deepViewport, 96)).toBe(false);
    expect(deepViewport).toEqual({ offset: 10000, height: 800 });
  });
});

const root: LinkedPagerTrack = {
  key: 'root',
  keys: ['pro', 'simple'],
  activeKey: 'pro',
  startOffset: 0,
};
const tabs: LinkedPagerTrack = {
  key: 'tabs',
  keys: ['positions', 'orders', 'account'],
  activeKey: 'orders',
  parentKey: 'root',
  parentPageKey: 'pro',
  startOffset: 600,
};
const pills: LinkedPagerTrack = {
  key: 'pills',
  keys: ['basic', 'conditional'],
  activeKey: 'basic',
  parentKey: 'tabs',
  parentPageKey: 'orders',
  startOffset: 660,
};

const resolve = (overrides: Partial<LinkedPagerOwnerInput> = {}) =>
  resolveLinkedPagerOwner({
    tracks: [root, tabs, pills],
    contentY: 700,
    translationX: -150,
    width: 400,
    ...overrides,
  });

describe('resolveLinkedPagerOwner', () => {
  it('moves Basic to Conditional without moving either ancestor', () => {
    expect(resolve()).toEqual({
      ownerKey: 'pills',
      ownerIndex: 0,
      targetIndex: 1,
    });
  });

  it('hands Conditional outward to Account in the parent track', () => {
    expect(
      resolve({ tracks: [root, tabs, { ...pills, activeKey: 'conditional' }] }),
    ).toEqual({ ownerKey: 'tabs', ownerIndex: 1, targetIndex: 2 });
  });

  it('hands Account outward to Simple without entering the inactive PillTrack', () => {
    expect(
      resolve({ tracks: [root, { ...tabs, activeKey: 'account' }, pills] }),
    ).toEqual({ ownerKey: 'root', ownerIndex: 0, targetIndex: 1 });
  });

  it('can pass through two consecutive child boundaries in one gesture', () => {
    expect(
      resolve({
        tracks: [
          root,
          { ...tabs, keys: ['positions', 'orders'] },
          { ...pills, activeKey: 'conditional' },
        ],
      }),
    ).toEqual({ ownerKey: 'root', ownerIndex: 0, targetIndex: 1 });
  });

  it.each<[string, string, string, number, number]>([
    ['conditional', 'orders', 'pills', 1, 0],
    ['basic', 'orders', 'tabs', 1, 0],
    ['basic', 'account', 'tabs', 2, 1],
    ['basic', 'positions', 'root', 0, 0],
  ])(
    'resolves a reverse drag from %s / %s',
    (pillKey, tabKey, ownerKey, ownerIndex, targetIndex) => {
      expect(
        resolve({
          tracks: [
            root,
            { ...tabs, activeKey: tabKey },
            { ...pills, activeKey: pillKey },
          ],
          translationX: 150,
        }),
      ).toEqual({ ownerKey, ownerIndex, targetIndex });
    },
  );

  it('moves Simple back to Pro while every descendant is inactive', () => {
    expect(
      resolve({
        tracks: [{ ...root, activeKey: 'simple' }, tabs, pills],
        translationX: 150,
      }),
    ).toEqual({ ownerKey: 'root', ownerIndex: 1, targetIndex: 0 });
  });

  it.each<[number, LinkedPagerOwner | null]>([
    [-1, null],
    [0, { ownerKey: 'root', ownerIndex: 0, targetIndex: 1 }],
    [599.99, { ownerKey: 'root', ownerIndex: 0, targetIndex: 1 }],
    [600, { ownerKey: 'tabs', ownerIndex: 1, targetIndex: 2 }],
    [659.99, { ownerKey: 'tabs', ownerIndex: 1, targetIndex: 2 }],
    [660, { ownerKey: 'pills', ownerIndex: 0, targetIndex: 1 }],
  ])('uses the gesture-start content coordinate %s', (contentY, expected) => {
    expect(resolve({ contentY })).toEqual(expected);
  });

  it('requires the ancestor region to be eligible too', () => {
    expect(
      resolve({
        tracks: [root, tabs, { ...pills, startOffset: 300 }],
        contentY: 500,
      }),
    ).toEqual({ ownerKey: 'root', ownerIndex: 0, targetIndex: 1 });
  });

  it('prefers hierarchy depth over a larger but shallower start offset', () => {
    expect(
      resolve({
        tracks: [root, { ...tabs, startOffset: 680 }, pills],
      }),
    ).toEqual({ ownerKey: 'pills', ownerIndex: 0, targetIndex: 1 });
  });

  it('hands off immediately during drag but keeps the settlement threshold', () => {
    const tracks = [root, tabs, { ...pills, activeKey: 'conditional' }];
    expect(resolve({ tracks, translationX: -1 })).toEqual({
      ownerKey: 'tabs',
      ownerIndex: 1,
      targetIndex: 1,
    });
    expect(resolve({ tracks, translationX: -99.99 })).toEqual({
      ownerKey: 'tabs',
      ownerIndex: 1,
      targetIndex: 1,
    });
    expect(resolve({ tracks, translationX: -100 })).toEqual({
      ownerKey: 'tabs',
      ownerIndex: 1,
      targetIndex: 2,
    });
    expect(resolve({ tracks, translationX: -100, width: 800 })).toEqual({
      ownerKey: 'tabs',
      ownerIndex: 1,
      targetIndex: 1,
    });
  });

  it('uses a meaningful final reversal for both owner and target', () => {
    expect(resolve({ translationX: -120, velocityX: 600 })).toEqual({
      ownerKey: 'tabs',
      ownerIndex: 1,
      targetIndex: 0,
    });
    expect(
      resolve({
        tracks: [root, tabs, { ...pills, activeKey: 'conditional' }],
        translationX: 12,
        velocityX: -600,
      }),
    ).toEqual({ ownerKey: 'tabs', ownerIndex: 1, targetIndex: 2 });
  });

  it.each([
    [-120, 599.99, 1],
    [-11.99, 600, 0],
    [-12, -600, 1],
    [-120, Number.NaN, 1],
    [-120, Number.POSITIVE_INFINITY, 1],
  ])(
    'keeps sub-threshold or invalid velocity from changing the owner (%s, %s)',
    (translationX, velocityX, targetIndex) => {
      expect(resolve({ translationX, velocityX })).toEqual({
        ownerKey: 'pills',
        ownerIndex: 0,
        targetIndex,
      });
    },
  );

  it('re-resolves direction from the immutable settled hierarchy', () => {
    expect(resolve({ translationX: -150 })?.ownerKey).toBe('pills');
    expect(resolve({ translationX: 0 })).toBeNull();
    expect(resolve({ translationX: 150 })).toEqual({
      ownerKey: 'tabs',
      ownerIndex: 1,
      targetIndex: 0,
    });
    expect(resolve({ translationX: -150 })?.ownerKey).toBe('pills');
  });

  it('never consumes more than one page or mutates tracks on a large drag', () => {
    const frozenTracks = Object.freeze(
      [root, tabs, pills].map(track =>
        Object.freeze({ ...track, keys: Object.freeze([...track.keys]) }),
      ),
    );
    expect(resolve({ tracks: frozenTracks, translationX: -4000 })).toEqual({
      ownerKey: 'pills',
      ownerIndex: 0,
      targetIndex: 1,
    });
    expect(frozenTracks.map(track => track.activeKey)).toEqual([
      'pro',
      'orders',
      'basic',
    ]);
  });

  it('clamps the outermost edge rather than wrapping', () => {
    expect(
      resolve({ tracks: [{ ...root, activeKey: 'simple' }, tabs, pills] }),
    ).toEqual({ ownerKey: 'root', ownerIndex: 1, targetIndex: 1 });
  });

  it('passes through a single-page child', () => {
    expect(
      resolve({ tracks: [root, tabs, { ...pills, keys: ['basic'] }] }),
    ).toEqual({ ownerKey: 'tabs', ownerIndex: 1, targetIndex: 2 });
  });

  it('does not depend on parent-before-child input ordering', () => {
    expect(resolve({ tracks: [pills, root, tabs] })).toEqual(resolve());
  });

  it('chooses the later matching region when siblings differ in offset', () => {
    const earlier = { ...pills, key: 'earlier', startOffset: 640 };
    expect(resolve({ tracks: [earlier, pills, tabs, root] })).toEqual(
      resolve(),
    );
  });

  it('fails closed for equally deep overlapping regions with the same offset', () => {
    const sibling = { ...pills, key: 'sibling' };
    expect(resolve({ tracks: [root, tabs, pills, sibling] })).toBeNull();
    expect(resolve({ tracks: [sibling, pills, tabs, root] })).toBeNull();
  });

  it.each<Partial<LinkedPagerTrack>>([
    { parentKey: 'missing' },
    { parentKey: undefined },
    { parentPageKey: undefined },
    { parentPageKey: 'missing' },
    { parentKey: 'pills', parentPageKey: 'basic' },
    { keys: [] },
    { keys: ['basic', 'basic'] },
    { keys: ['basic', ''] },
    { activeKey: 'missing' },
    { startOffset: Number.NaN },
    { startOffset: Number.POSITIVE_INFINITY },
    { key: '' },
  ])(
    'ignores a malformed child without disabling its valid ancestors (%s)',
    patch => {
      expect(resolve({ tracks: [root, tabs, { ...pills, ...patch }] })).toEqual(
        {
          ownerKey: 'tabs',
          ownerIndex: 1,
          targetIndex: 2,
        },
      );
    },
  );

  it('rejects a cyclic branch without looping or affecting another valid root', () => {
    const cyclicTabs = { ...tabs, parentKey: 'pills', parentPageKey: 'basic' };
    expect(resolve({ tracks: [cyclicTabs, pills] })).toBeNull();
    expect(resolve({ tracks: [root, cyclicTabs, pills] })).toEqual({
      ownerKey: 'root',
      ownerIndex: 0,
      targetIndex: 1,
    });
  });

  it('rejects ambiguous track keys and their descendants', () => {
    expect(resolve({ tracks: [root, tabs, { ...tabs }, pills] })).toEqual({
      ownerKey: 'root',
      ownerIndex: 0,
      targetIndex: 1,
    });
  });

  it('does not accept descendants when any ancestor has an invalid active page', () => {
    expect(
      resolve({ tracks: [{ ...root, activeKey: 'missing' }, tabs, pills] }),
    ).toBeNull();
  });

  it('requires a root to omit its parent page key', () => {
    expect(resolve({ tracks: [{ ...root, parentPageKey: 'pro' }] })).toBeNull();
  });

  it('returns null for no tracks or no horizontal intention', () => {
    expect(resolve({ tracks: [] })).toBeNull();
    expect(resolve({ translationX: 0, velocityX: -900 })).toBeNull();
    expect(resolve({ translationX: -0, velocityX: 900 })).toBeNull();
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'fails closed for invalid viewport width %s',
    width => {
      expect(resolve({ width })).toBeNull();
    },
  );

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'fails closed for non-finite content or translation %s',
    invalid => {
      expect(resolve({ contentY: invalid })).toBeNull();
      expect(resolve({ translationX: invalid })).toBeNull();
    },
  );
});
