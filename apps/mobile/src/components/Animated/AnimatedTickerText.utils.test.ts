import {
  getRequiredTickerColumnCount,
  getFittedTickerFontSize,
} from './AnimatedTickerText.utils';

describe('getFittedTickerFontSize', () => {
  it('fits the complete NGN balance into the space left by the wallet button', () => {
    // ₦1,593,285.32: nine digit columns, three punctuation columns, one symbol.
    const widthUnits = 9 * 0.61 + 3 * 0.3 + 0.72;
    const fontSize = getFittedTickerFontSize(30, widthUnits, 190);
    expect(fontSize).toBeLessThan(30);
    expect(fontSize * widthUnits).toBeLessThanOrEqual(190);
  });

  it.each([0, -1, NaN, Infinity])(
    'ignores an unmeasured/invalid width %s',
    width => {
      expect(getFittedTickerFontSize(30, 7.11, width)).toBe(30);
    },
  );

  it('does not enlarge short amounts or divide by an empty string', () => {
    expect(getFittedTickerFontSize(38, 2.4, 190)).toBe(38);
    expect(getFittedTickerFontSize(38, 0, 190)).toBe(38);
  });
});

describe('getRequiredTickerColumnCount', () => {
  it('uses the current text length instead of eagerly allocating every slot', () => {
    expect(getRequiredTickerColumnCount('$12.34', 16)).toBe(6);
  });

  it('keeps one slot ready while the initial value is empty', () => {
    expect(getRequiredTickerColumnCount('', 16)).toBe(1);
  });

  it('clamps overflowing text to the configured maximum', () => {
    expect(getRequiredTickerColumnCount('$123456', 4)).toBe(4);
  });
});
