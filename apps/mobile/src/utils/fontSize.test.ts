import { getFontSizeByLength } from './fontSize';

describe('getFontSizeByLength', () => {
  const options = {
    maxFontSize: 24,
    minFontSize: 12,
    threshold: 8,
  };

  it('keeps the max font size while the length is under the threshold', () => {
    expect(getFontSizeByLength(8, options)).toBe(24);
  });

  it('reduces font size by the default step and clamps to the minimum', () => {
    expect(getFontSizeByLength(10, options)).toBe(20);
    expect(getFontSizeByLength(100, options)).toBe(12);
  });

  it('uses custom step values and treats non-positive steps as minimum size', () => {
    expect(getFontSizeByLength(10, { ...options, step: 3 })).toBe(18);
    expect(getFontSizeByLength(10, { ...options, step: 0 })).toBe(12);
  });
});
