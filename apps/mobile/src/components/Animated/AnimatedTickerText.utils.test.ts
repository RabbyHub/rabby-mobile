import { getRequiredTickerColumnCount } from './AnimatedTickerText.utils';

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
