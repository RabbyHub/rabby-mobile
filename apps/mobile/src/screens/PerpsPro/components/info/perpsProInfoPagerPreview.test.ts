import { getPerpsProInfoPagerPreviewPosition } from './perpsProInfoPagerPreview';

describe('getPerpsProInfoPagerPreviewPosition', () => {
  it('uses separate enter and exit thresholds around the page midpoint', () => {
    expect(
      getPerpsProInfoPagerPreviewPosition({
        maximumPosition: 2,
        pagePosition: 0.54,
        previewPosition: 0,
        settledPosition: 0,
      }),
    ).toBe(0);
    expect(
      getPerpsProInfoPagerPreviewPosition({
        maximumPosition: 2,
        pagePosition: 0.55,
        previewPosition: 0,
        settledPosition: 0,
      }),
    ).toBe(1);
    expect(
      getPerpsProInfoPagerPreviewPosition({
        maximumPosition: 2,
        pagePosition: 0.5,
        previewPosition: 1,
        settledPosition: 0,
      }),
    ).toBe(1);
    expect(
      getPerpsProInfoPagerPreviewPosition({
        maximumPosition: 2,
        pagePosition: 0.45,
        previewPosition: 1,
        settledPosition: 0,
      }),
    ).toBe(0);
  });

  it('supports a backward swipe from the middle page', () => {
    expect(
      getPerpsProInfoPagerPreviewPosition({
        maximumPosition: 2,
        pagePosition: 0.46,
        previewPosition: 1,
        settledPosition: 1,
      }),
    ).toBe(1);
    expect(
      getPerpsProInfoPagerPreviewPosition({
        maximumPosition: 2,
        pagePosition: 0.45,
        previewPosition: 1,
        settledPosition: 1,
      }),
    ).toBe(0);
    expect(
      getPerpsProInfoPagerPreviewPosition({
        maximumPosition: 2,
        pagePosition: 0.5,
        previewPosition: 0,
        settledPosition: 1,
      }),
    ).toBe(0);
    expect(
      getPerpsProInfoPagerPreviewPosition({
        maximumPosition: 2,
        pagePosition: 0.55,
        previewPosition: 0,
        settledPosition: 1,
      }),
    ).toBe(1);
  });

  it('clamps invalid inputs to a valid page', () => {
    expect(
      getPerpsProInfoPagerPreviewPosition({
        maximumPosition: 2,
        pagePosition: Number.NaN,
        previewPosition: Number.POSITIVE_INFINITY,
        settledPosition: 9,
      }),
    ).toBe(2);
  });
});
