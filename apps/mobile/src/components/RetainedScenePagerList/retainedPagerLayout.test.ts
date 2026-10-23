import {
  clampRetainedPagerScrollY,
  resolveRetainedPagerLayout,
  type RetainedPagerLayoutInput,
} from './retainedPagerLayout';

const input: RetainedPagerLayoutInput = {
  pageHeights: [2000, 200, 3000],
  settledIndex: 0,
  viewportHeight: 800,
  headerHeight: 416,
  tabHeight: 48,
  transitionScrollY: null,
};
const layout = (overrides: Partial<RetainedPagerLayoutInput> = {}) =>
  resolveRetainedPagerLayout({ ...input, ...overrides });

describe('resolveRetainedPagerLayout (measured geometry)', () => {
  it.each([
    [0, 2000],
    [1, 752],
    [2, 3000],
  ])(
    'uses only the settled page %s height while idle',
    (settledIndex, height) => {
      expect(layout({ settledIndex })).toEqual({
        pagerHeight: height,
        pageTopInsets: [0, 0, 0],
      });
    },
  );

  it('uses viewport minus tabs, not viewport minus the whole header, as its minimum', () => {
    expect(layout({ pageHeights: [0] })).toEqual({
      pagerHeight: 752,
      pageTopInsets: [0],
    });
    expect(layout({ pageHeights: [0], headerHeight: 1000 }).pagerHeight).toBe(
      752,
    );
  });

  it('keeps the source height and aligns a short neighbour at deep scroll', () => {
    expect(
      layout({ transitionScrollY: 1200, transitionPagerHeight: 2000 }),
    ).toEqual({
      pagerHeight: 2000,
      pageTopInsets: [0, 832, 0],
    });
  });

  it('only releases source height and neighbour inset once idle accepts the new page', () => {
    const transition = layout({
      transitionScrollY: 1200,
      transitionPagerHeight: 2000,
    });
    expect(transition.pagerHeight).toBe(2000);
    expect(transition.pageTopInsets[1]).toBe(832);
    const settled = layout({
      settledIndex: 1,
      transitionScrollY: null,
      transitionPagerHeight: 2000,
    });
    expect(settled).toEqual({ pagerHeight: 752, pageTopInsets: [0, 0, 0] });
    expect(
      clampRetainedPagerScrollY({
        ...input,
        scrollY: 1200,
        pageHeight: 200,
      }),
    ).toBe(368);
  });

  it('cancels by returning to idle source geometry without selecting another page', () => {
    const before = layout();
    layout({ transitionScrollY: 1200, transitionPagerHeight: 2000 });
    expect(layout()).toEqual(before);
  });

  it('does not shorten a long neighbour to the source pager viewport', () => {
    const pageHeights = Object.freeze([200, 3000]);
    expect(
      layout({
        pageHeights,
        transitionScrollY: 368,
        transitionPagerHeight: 752,
      }),
    ).toEqual({ pagerHeight: 752, pageTopInsets: [0, 0] });
    expect(pageHeights).toEqual([200, 3000]);
    // The caller still gives the long page/list its own 3000-point content
    // height. pagerHeight describes only the common clipping viewport.
  });

  it('keeps the captured source height while dynamic source and neighbour heights change', () => {
    expect(
      layout({
        pageHeights: [100, 1000, 3000],
        transitionScrollY: 1200,
        transitionPagerHeight: 2000,
      }),
    ).toEqual({ pagerHeight: 2000, pageTopInsets: [0, 584, 0] });
    expect(
      layout({
        pageHeights: [4000, 1500, 3000],
        transitionScrollY: 1200,
        transitionPagerHeight: 2000,
      }),
    ).toEqual({ pagerHeight: 2000, pageTopInsets: [0, 84, 0] });
    expect(layout({ pageHeights: [100, 1000, 3000] }).pagerHeight).toBe(752);
  });

  it('never insets the source itself even after source shrink or an overscrolled capture', () => {
    expect(
      layout({
        pageHeights: [0, 0],
        transitionScrollY: 5000,
        transitionPagerHeight: 2000,
      }),
    ).toEqual({ pagerHeight: 2000, pageTopInsets: [0, 4632] });
  });

  it.each([0, 200, 368, 368.25, 1200])(
    'only insets beyond the target native maximum at scroll %s',
    transitionScrollY => {
      expect(
        layout({ transitionScrollY, transitionPagerHeight: 2000 })
          .pageTopInsets[1],
      ).toBe(Math.max(0, transitionScrollY - 368));
    },
  );

  it('retains fractional measured dimensions without pixel rounding', () => {
    const fractional: RetainedPagerLayoutInput = {
      pageHeights: [2000.25, 100.5, 3000.75],
      settledIndex: 0,
      viewportHeight: 800.5,
      headerHeight: 416.125,
      tabHeight: 48.25,
      transitionScrollY: 1200.625,
      transitionPagerHeight: 2000.25,
    };
    expect(resolveRetainedPagerLayout(fractional)).toEqual({
      pagerHeight: 2000.25,
      pageTopInsets: [0, 832.75, 0],
    });
    expect(
      resolveRetainedPagerLayout({
        ...fractional,
        settledIndex: 1,
        transitionScrollY: null,
      }).pagerHeight,
    ).toBe(752.25);
  });

  it.each<[number, number]>([
    [-5, 2000],
    [-0.5, 2000],
    [1.9, 752],
    [20, 3000],
    [Number.NaN, 2000],
    [Number.POSITIVE_INFINITY, 2000],
  ])(
    'normalizes settled index %s to valid fixture geometry',
    (index, height) => {
      expect(layout({ settledIndex: index }).pagerHeight).toBe(height);
    },
  );

  it('handles no pages and zero-height pages without inventing content', () => {
    expect(layout({ pageHeights: [] })).toEqual({
      pagerHeight: 752,
      pageTopInsets: [],
    });
    expect(
      layout({
        pageHeights: [],
        transitionScrollY: 1200,
        transitionPagerHeight: 2000,
      }),
    ).toEqual({ pagerHeight: 2000, pageTopInsets: [] });
    expect(layout({ pageHeights: [0, 0] })).toEqual({
      pagerHeight: 752,
      pageTopInsets: [0, 0],
    });
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'treats invalid measured page height %s as zero',
    invalid => {
      expect(layout({ pageHeights: [invalid] })).toEqual({
        pagerHeight: 752,
        pageTopInsets: [0],
      });
      expect(
        layout({ pageHeights: [2000, invalid], transitionScrollY: 1200 })
          .pageTopInsets,
      ).toEqual([0, 832]);
    },
  );

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])(
    'falls back to current source geometry for invalid captured height %s',
    transitionPagerHeight => {
      expect(
        layout({ transitionScrollY: 1200, transitionPagerHeight }),
      ).toEqual({
        pagerHeight: 2000,
        pageTopInsets: [0, 832, 0],
      });
    },
  );

  it('uses an explicit zero snapshot and does not silently grow it after viewport changes', () => {
    expect(
      layout({ transitionScrollY: 0, transitionPagerHeight: 0 }).pagerHeight,
    ).toBe(0);
    expect(
      layout({
        viewportHeight: 3000,
        transitionScrollY: 0,
        transitionPagerHeight: 752,
      }).pagerHeight,
    ).toBe(752);
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])(
    'normalizes invalid captured scroll %s without leaving transition mode',
    transitionScrollY => {
      expect(
        layout({ transitionScrollY, transitionPagerHeight: 1234 }),
      ).toEqual({
        pagerHeight: 1234,
        pageTopInsets: [0, 0, 0],
      });
    },
  );

  it.each(['viewportHeight', 'headerHeight', 'tabHeight'] as const)(
    'normalizes invalid %s to the zero-dimension fixture fallback',
    field => {
      const fallback = layout({ [field]: 0, transitionScrollY: 1200 });
      for (const invalid of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
        expect(layout({ [field]: invalid, transitionScrollY: 1200 })).toEqual(
          fallback,
        );
      }
    },
  );

  it('bounds minimum height at zero when tabs exceed or viewport has no height', () => {
    expect(layout({ pageHeights: [0], tabHeight: 900 }).pagerHeight).toBe(0);
    expect(layout({ pageHeights: [0], viewportHeight: 0 }).pagerHeight).toBe(0);
  });

  it('does not mutate frozen input or depend on prior calculations', () => {
    const frozen = Object.freeze({
      ...input,
      pageHeights: Object.freeze([2000, 200, 3000]),
      transitionScrollY: 1200,
      transitionPagerHeight: 2000,
    });
    expect(resolveRetainedPagerLayout(frozen)).toEqual(
      resolveRetainedPagerLayout(frozen),
    );
    expect(frozen.pageHeights).toEqual([2000, 200, 3000]);
    expect(frozen.settledIndex).toBe(0);
    expect(frozen.transitionScrollY).toBe(1200);
  });
});

describe('clampRetainedPagerScrollY (expected idle native clamp)', () => {
  it.each([
    [-1, 200, 0],
    [0, 200, 0],
    [100.25, 200, 100.25],
    [368, 200, 368],
    [368.25, 200, 368],
    [1200, 200, 368],
    [1200, 2000, 1200],
    [9999, 2000, 1616],
    [Number.NaN, 2000, 0],
    [Number.POSITIVE_INFINITY, 2000, 0],
  ])(
    'clamps offset %s for page height %s to %s',
    (scrollY, pageHeight, expected) => {
      expect(clampRetainedPagerScrollY({ ...input, scrollY, pageHeight })).toBe(
        expected,
      );
    },
  );

  it('returns zero when the whole content fits the viewport', () => {
    expect(
      clampRetainedPagerScrollY({
        scrollY: 1000,
        pageHeight: 200,
        viewportHeight: 800,
        headerHeight: 0,
        tabHeight: 100,
      }),
    ).toBe(0);
  });

  it('keeps huge but finite fixture inputs finite rather than overflowing', () => {
    expect(
      clampRetainedPagerScrollY({
        scrollY: Number.MAX_VALUE,
        pageHeight: Number.MAX_VALUE,
        viewportHeight: 0,
        headerHeight: Number.MAX_VALUE,
        tabHeight: 0,
      }),
    ).toBe(Number.MAX_VALUE);
  });

  it('maintains the same visible row coordinate across preview and predicted idle clamp', () => {
    const capturedScrollY = 1200;
    const rowOffsetWithinPage = 100;
    const transition = layout({
      transitionScrollY: capturedScrollY,
      transitionPagerHeight: 2000,
    });
    const settledScrollY = clampRetainedPagerScrollY({
      ...input,
      scrollY: capturedScrollY,
      pageHeight: 200,
    });
    const previewScreenY =
      input.headerHeight +
      transition.pageTopInsets[1] +
      rowOffsetWithinPage -
      capturedScrollY;
    const settledScreenY =
      input.headerHeight + rowOffsetWithinPage - settledScrollY;
    expect(previewScreenY).toBe(settledScreenY);
    expect(previewScreenY).toBe(148);
  });
});
