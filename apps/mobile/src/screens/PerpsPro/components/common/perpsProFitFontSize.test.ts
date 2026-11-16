import { resolvePerpsProFittedFontSize } from './perpsProFitFontSize';

const fit = (availableWidth: number, naturalWidth: number) =>
  resolvePerpsProFittedFontSize({
    availableWidth,
    baseFontSize: 16,
    minFontSize: 12,
    naturalWidth,
  });

describe('resolvePerpsProFittedFontSize', () => {
  it('keeps the base size when the text fits or is not measured yet', () => {
    expect(fit(289, 263)).toBe(16);
    expect(fit(289, 289)).toBe(16);
    expect(fit(0, 317)).toBe(16);
    expect(fit(289, 0)).toBe(16);
  });

  it('shrinks in half-point steps with a safety margin', () => {
    // 16 * 289 / 317 * 0.95 = 13.86 -> 13.5
    expect(fit(289, 317)).toBe(13.5);
  });

  it('never goes below the minimum size', () => {
    expect(fit(100, 317)).toBe(12);
  });
});
