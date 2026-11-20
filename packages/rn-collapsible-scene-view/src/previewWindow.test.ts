import {
  calculateScenePagerPreviewWindow,
  SCENE_PAGER_PREVIEW_ROW_LIMIT,
  type ScenePagerPreviewWindowInput,
} from './previewWindow';

// Unit coverage only: exact geometry, not native layout, clamping or gestures.
describe('ScenePager measured preview window', () => {
  const calculate = (patch: Partial<ScenePagerPreviewWindowInput> = {}) =>
    calculateScenePagerPreviewWindow({
      rowHeights: [50, 150],
      rowStartOffset: 500,
      sourceScrollOffset: 900,
      viewportHeight: 400,
      paddingBottom: 40,
      ...patch,
    });

  it('clamps a short target and compensates its preview to the settled position', () => {
    const result = calculate();
    expect(result).toEqual({
      status: 'resolved',
      startIndex: 0,
      endIndexExclusive: 2,
      prefixOffset: 0,
      targetScrollOffset: 340,
      previewOffset: 560,
      coverage: 'complete',
    });
    if (result.status !== 'resolved') {
      throw new Error('Expected exact geometry');
    }
    expect(500 + result.previewOffset - 900).toBe(
      500 + result.prefixOffset - result.targetScrollOffset,
    );
  });

  it('selects a deep variable-height window rather than the first twelve rows', () => {
    const rowHeights = Array.from(
      { length: 30 },
      (_, index) => [40, 80, 120][index % 3],
    );
    expect(
      calculate({
        rowHeights,
        rowStartOffset: 100,
        sourceScrollOffset: 1270,
        viewportHeight: 250,
      }),
    ).toEqual({
      status: 'resolved',
      startIndex: 14,
      endIndexExclusive: 18,
      prefixOffset: 1080,
      targetScrollOffset: 1270,
      previewOffset: 1080,
      coverage: 'complete',
    });
  });

  it('does not invent a prefix across an unmeasured row', () => {
    expect(
      calculate({
        rowHeights: [50, null, 200],
        rowStartOffset: 100,
        sourceScrollOffset: 200,
        viewportHeight: 100,
        minContentHeight: 1000,
      }),
    ).toEqual({
      status: 'unresolved',
      reason: 'unknown-row-height',
      rowIndex: 1,
    });
  });

  it('does not guess target clamp when an unmeasured tail could change it', () => {
    expect(
      calculate({ rowHeights: [100, undefined], paddingBottom: 0 }),
    ).toEqual({
      status: 'unresolved',
      reason: 'unknown-content-height',
      rowIndex: 1,
    });
  });

  it('does not require unseen tail measurements when the known prefix proves no clamp', () => {
    expect(
      calculate({
        rowHeights: [100, 100, null],
        rowStartOffset: 100,
        sourceScrollOffset: 25,
        viewportHeight: 250,
        paddingBottom: 0,
      }),
    ).toMatchObject({
      status: 'resolved',
      startIndex: 0,
      endIndexExclusive: 2,
      targetScrollOffset: 25,
      coverage: 'complete',
    });
  });

  it('uses target padding and total minHeight rather than the source dimensions', () => {
    expect(calculate({ paddingBottom: 0 })).toMatchObject({
      targetScrollOffset: 300,
      previewOffset: 600,
    });
    expect(calculate({ paddingBottom: 200 })).toMatchObject({
      targetScrollOffset: 500,
      previewOffset: 400,
    });
    expect(calculate({ minContentHeight: 1000 })).toMatchObject({
      startIndex: 1,
      prefixOffset: 50,
      targetScrollOffset: 600,
      previewOffset: 350,
    });
  });

  it('can use minHeight alone to prove no clamp with an unmeasured tail', () => {
    const input = {
      rowHeights: [...Array.from({ length: 20 }, () => 10), null],
      rowStartOffset: 0,
      sourceScrollOffset: 50,
      viewportHeight: 200,
      paddingBottom: 0,
    };
    expect(calculate(input)).toMatchObject({
      status: 'unresolved',
      reason: 'unknown-content-height',
    });
    expect(calculate({ ...input, minContentHeight: 1000 })).toMatchObject({
      status: 'resolved',
      startIndex: 5,
      endIndexExclusive: 17,
      targetScrollOffset: 50,
      coverage: 'row-limit',
    });
  });

  it('recalculates the target clamp and window after the viewport changes', () => {
    const input = {
      rowHeights: [100, 200, 300],
      rowStartOffset: 100,
      sourceScrollOffset: 500,
      paddingBottom: 0,
    };
    expect(calculate({ ...input, viewportHeight: 200 })).toMatchObject({
      startIndex: 2,
      endIndexExclusive: 3,
      targetScrollOffset: 500,
    });
    expect(calculate({ ...input, viewportHeight: 400 })).toMatchObject({
      startIndex: 1,
      endIndexExclusive: 3,
      targetScrollOffset: 300,
    });
  });

  it('handles an empty list and a viewport containing only header or padding', () => {
    expect(calculate({ rowHeights: [] })).toMatchObject({
      status: 'resolved',
      startIndex: 0,
      endIndexExclusive: 0,
      prefixOffset: 0,
      targetScrollOffset: 140,
    });
    expect(
      calculate({ rowHeights: [null], sourceScrollOffset: 0 }),
    ).toMatchObject({
      status: 'resolved',
      startIndex: 0,
      endIndexExclusive: 0,
    });
    expect(
      calculate({
        rowHeights: [100],
        rowStartOffset: 0,
        sourceScrollOffset: 200,
        viewportHeight: 100,
        paddingBottom: 300,
      }),
    ).toMatchObject({
      status: 'resolved',
      startIndex: 1,
      endIndexExclusive: 1,
      prefixOffset: 100,
    });
  });

  it('bounds the returned row count even when a viewport spans many small rows', () => {
    const input = {
      rowHeights: Array.from({ length: 50 }, () => 10),
      rowStartOffset: 100,
      sourceScrollOffset: 100,
      viewportHeight: 500,
    };
    expect(calculate({ ...input, maxRows: 100 })).toMatchObject({
      status: 'resolved',
      startIndex: 0,
      endIndexExclusive: SCENE_PAGER_PREVIEW_ROW_LIMIT,
      coverage: 'row-limit',
    });
    expect(calculate({ ...input, maxRows: 3 })).toMatchObject({
      endIndexExclusive: 3,
      coverage: 'row-limit',
    });
  });

  it('uses half-open visibility boundaries and does not select zero-height edge rows', () => {
    const input = {
      rowHeights: [0, 100, 0, 100, 0],
      rowStartOffset: 0,
      viewportHeight: 100,
      paddingBottom: 0,
    };
    expect(calculate({ ...input, sourceScrollOffset: 0 })).toMatchObject({
      startIndex: 1,
      endIndexExclusive: 2,
    });
    expect(calculate({ ...input, sourceScrollOffset: 100 })).toMatchObject({
      startIndex: 3,
      endIndexExclusive: 4,
    });
  });

  it('reports complete coverage at the row limit when the viewport ends there', () => {
    expect(
      calculate({
        rowHeights: [...Array.from({ length: 12 }, () => 10), null],
        rowStartOffset: 0,
        sourceScrollOffset: 0,
        viewportHeight: 120,
      }),
    ).toMatchObject({
      status: 'resolved',
      startIndex: 0,
      endIndexExclusive: 12,
      coverage: 'complete',
    });
  });

  it('reports the bounded known window when an unknown row follows its limit', () => {
    expect(
      calculate({
        rowHeights: [...Array.from({ length: 12 }, () => 10), null],
        rowStartOffset: 0,
        sourceScrollOffset: 0,
        viewportHeight: 200,
      }),
    ).toMatchObject({
      status: 'resolved',
      startIndex: 0,
      endIndexExclusive: 12,
      coverage: 'row-limit',
    });
  });

  it('does not count a zero-height tail as missing visible coverage', () => {
    const input = {
      rowStartOffset: 0,
      sourceScrollOffset: 0,
      viewportHeight: 200,
    };
    expect(
      calculate({
        ...input,
        rowHeights: [100, ...Array.from({ length: 20 }, () => 0)],
      }),
    ).toMatchObject({
      status: 'resolved',
      startIndex: 0,
      endIndexExclusive: 12,
      coverage: 'complete',
    });
    expect(calculate({ ...input, rowHeights: [0, 0, 0] })).toMatchObject({
      status: 'resolved',
      startIndex: 3,
      endIndexExclusive: 3,
      coverage: 'complete',
    });
  });

  it('does not overflow an intermediate addition when the final offset is finite', () => {
    const result = calculate({
      rowHeights: [8e307, 2e307],
      rowStartOffset: 0,
      sourceScrollOffset: 1.7e308,
      viewportHeight: 1e307,
      paddingBottom: 0,
    });
    expect(result.status).toBe('resolved');
    if (result.status !== 'resolved') {
      throw new Error('Expected exact geometry');
    }
    expect(Number.isFinite(result.previewOffset)).toBe(true);
    expect(result.previewOffset / 1e308).toBeCloseTo(1.6);
  });

  it('updates exact prefix geometry when a measured variable row changes height', () => {
    const input = {
      rowHeights: [100, 100, 100],
      rowStartOffset: 0,
      sourceScrollOffset: 150,
      viewportHeight: 100,
    };
    expect(calculate(input)).toMatchObject({
      startIndex: 1,
      prefixOffset: 100,
    });
    expect(calculate({ ...input, rowHeights: [200, 100, 100] })).toMatchObject({
      startIndex: 0,
      prefixOffset: 0,
    });
  });

  it('normalizes a negative source offset to the existing non-bouncing model', () => {
    expect(
      calculate({ rowStartOffset: 0, sourceScrollOffset: -20 }),
    ).toMatchObject({
      targetScrollOffset: 0,
      previewOffset: 0,
    });
  });

  it.each<Partial<ScenePagerPreviewWindowInput>>([
    { viewportHeight: 0 },
    { viewportHeight: Number.NaN },
    { rowStartOffset: -1 },
    { sourceScrollOffset: Infinity },
    { paddingBottom: -1 },
    { minContentHeight: Infinity },
    { maxRows: 0 },
    { maxRows: 1.5 },
    { rowHeights: [-1] },
    { rowHeights: [Number.NaN] },
    { rowHeights: [Infinity] },
    { rowHeights: [Number.MAX_VALUE, Number.MAX_VALUE] },
  ])('fails closed for invalid geometry: %j', patch => {
    expect(calculate(patch)).toMatchObject({
      status: 'unresolved',
      reason: 'invalid-geometry',
    });
  });
});
