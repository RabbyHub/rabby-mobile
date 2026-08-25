import {
  arePerpsProDottedUnderlineGeometriesEqual,
  resolvePerpsProDottedUnderlineGeometry,
} from './perpsProDottedUnderlineGeometry';

const roundToHalfPixel = (value: number) => Math.round(value * 2) / 2;

describe('perpsProDottedUnderlineGeometry', () => {
  it('uses 10% thickness and a 25% baseline offset for 10px labels', () => {
    expect(
      resolvePerpsProDottedUnderlineGeometry({
        fontSize: 10,
        line: { ascender: 8.5, width: 61.5, y: 1 },
        minimumStrokeWidth: 0.5,
        roundToNearestPixel: roundToHalfPixel,
      }),
    ).toEqual({
      canvasHeight: 1,
      canvasTop: 11.5,
      dotGap: 2,
      dotLength: 1,
      lineX1: 0.5,
      lineX2: 61,
      lineY: 0.5,
      strokeWidth: 1,
      width: 61.5,
    });
  });

  it('rounds 12px geometry to physical pixels and prefers a native baseline', () => {
    expect(
      resolvePerpsProDottedUnderlineGeometry({
        fontSize: 12,
        line: { ascender: 8, baseline: 11, width: 40, y: 0 },
        minimumStrokeWidth: 0.5,
        roundToNearestPixel: roundToHalfPixel,
      }),
    ).toEqual(
      expect.objectContaining({
        canvasHeight: 1,
        canvasTop: 13.5,
        dotGap: 2,
        dotLength: 1,
        strokeWidth: 1,
      }),
    );
  });

  it('falls back to the approved default font size and keeps a zero width safe', () => {
    expect(
      resolvePerpsProDottedUnderlineGeometry({
        fontSize: Number.NaN,
        line: { ascender: 9, width: -1, y: 0 },
        minimumStrokeWidth: 0.5,
        roundToNearestPixel: roundToHalfPixel,
      }),
    ).toEqual(
      expect.objectContaining({
        lineX1: 0,
        lineX2: 0,
        strokeWidth: 1,
        width: 0,
      }),
    );
  });

  it('treats sub-hairline layout noise as the same geometry', () => {
    const current = resolvePerpsProDottedUnderlineGeometry({
      fontSize: 10,
      line: { ascender: 8.5, width: 50, y: 1 },
      minimumStrokeWidth: 0.5,
      roundToNearestPixel: roundToHalfPixel,
    });
    expect(
      arePerpsProDottedUnderlineGeometriesEqual(
        current,
        { ...current, width: current.width + 0.1 },
        0.5,
      ),
    ).toBe(true);
    expect(
      arePerpsProDottedUnderlineGeometriesEqual(
        current,
        { ...current, width: current.width + 0.5 },
        0.5,
      ),
    ).toBe(false);
  });
});
