import { formatMemeBalanceUsd } from './formatBalance';

jest.mock('@/utils/number', () => ({
  formatUsdValue: (usd: number) => `$${usd.toFixed(2)}`,
}));

describe('formatMemeBalanceUsd', () => {
  it.each([
    [1246.82, '$1,246'],
    [50.99, '$50'],
    [50.01, '$50'],
    [1234567.9, '$1,234,567'],
  ])('cuts the cents above $50: %p', (usd, expected) => {
    expect(formatMemeBalanceUsd(usd)).toBe(expected);
  });

  it.each([
    [50, '$50.00'],
    [12.34, '$12.34'],
  ])('keeps the normal format up to $50: %p', (usd, expected) => {
    expect(formatMemeBalanceUsd(usd)).toBe(expected);
  });

  it.each([0, 0.001])('shows no cents when it would read $0.00: %p', usd => {
    expect(formatMemeBalanceUsd(usd)).toBe('$0');
  });
});
