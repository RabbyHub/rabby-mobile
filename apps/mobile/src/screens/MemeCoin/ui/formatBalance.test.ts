import { formatUsdValue } from '@/utils/number';
import {
  formatMemeBalanceUsd,
  formatMemePnlUsd,
  formatUsdNoZeroCents,
  isFlatMemePnl,
} from './formatBalance';

jest.mock('@/utils/number', () => ({
  formatUsdValue: jest.fn(
    (usd: number) => `${usd < 0 ? '-' : ''}$${Math.abs(usd).toFixed(2)}`,
  ),
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

describe('formatMemePnlUsd', () => {
  it.each([
    [200.32, '+$200.32'],
    [0, '+$0.00'],
    [-3.1, '-$3.10'],
  ])('signs the amount: %p', (usd, expected) => {
    expect(formatMemePnlUsd(usd)).toBe(expected);
  });
});

describe('isFlatMemePnl', () => {
  it.each([0, 0.009, -0.009, 0.0001])('under a cent either way: %p', usd => {
    expect(isFlatMemePnl(usd)).toBe(true);
  });

  it.each([0.01, -0.01, 3.1])('a cent or more: %p', usd => {
    expect(isFlatMemePnl(usd)).toBe(false);
  });
});

describe('formatUsdNoZeroCents', () => {
  it.each([
    [100, '$100'],
    [65.21, '$65.21'],
    [100.5, '$100.50'],
  ])('drops zero cents only: %p', (usd, expected) => {
    expect(formatUsdNoZeroCents(usd)).toBe(expected);
  });

  it('leaves a value without cents alone', () => {
    (formatUsdValue as jest.Mock).mockReturnValueOnce('$1,500');
    expect(formatUsdNoZeroCents(1500)).toBe('$1,500');
  });
});
