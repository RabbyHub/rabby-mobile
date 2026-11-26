import { resolvePerpsProPositionTpSlTabRowFit } from './perpsProPositionTpSlTabRowFit';

describe('resolvePerpsProPositionTpSlTabRowFit', () => {
  const chromeWidth = 108;

  it('keeps the design sizes when the row fits or is not measured', () => {
    const full = { tabFontSize: 14, actionFontSize: 12, wrapped: false };
    expect(
      resolvePerpsProPositionTpSlTabRowFit({
        chromeWidth,
        rowWidth: 351,
        widths: { tabText: 120, actionText: 100 },
      }),
    ).toEqual(full);
    expect(
      resolvePerpsProPositionTpSlTabRowFit({
        chromeWidth,
        rowWidth: 351,
        widths: null,
      }),
    ).toEqual(full);
  });

  it('shrinks tabs and actions by one ratio for long translations', () => {
    const fit = resolvePerpsProPositionTpSlTabRowFit({
      chromeWidth,
      rowWidth: 336,
      widths: { tabText: 160, actionText: 110 },
    });
    expect(fit.wrapped).toBe(false);
    expect(fit.tabFontSize).toBeLessThan(14);
    expect(fit.tabFontSize).toBeGreaterThanOrEqual(11);
    expect(fit.actionFontSize).toBeLessThan(12);
    expect(fit.actionFontSize).toBeGreaterThanOrEqual(10);
    expect(
      (160 * fit.tabFontSize) / 14 + (110 * fit.actionFontSize) / 12,
    ).toBeLessThanOrEqual(336 - chromeWidth);
  });

  it('wraps at the design sizes instead of truncating below the minimum', () => {
    expect(
      resolvePerpsProPositionTpSlTabRowFit({
        chromeWidth,
        rowWidth: 300,
        widths: { tabText: 220, actionText: 160 },
      }),
    ).toEqual({ tabFontSize: 14, actionFontSize: 12, wrapped: true });
  });
});
