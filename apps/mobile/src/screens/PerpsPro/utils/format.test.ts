import {
  formatPerpsProCompactNumber,
  formatPerpsProFundingRate,
  formatPerpsProPercent,
  formatPerpsProPrice,
  formatPerpsProSignedUsd,
} from './format';

describe('Perps Pro formatters', () => {
  it('reuses the mobile K/M/B/T abbreviation policy without a currency prefix', () => {
    expect(formatPerpsProCompactNumber(null)).toBe('-');
    expect(formatPerpsProCompactNumber(999)).toBe('999.00');
    expect(formatPerpsProCompactNumber(1_000)).toBe('1.00K');
    expect(formatPerpsProCompactNumber(14_080_000)).toBe('14.08M');
    expect(formatPerpsProCompactNumber(149_900_000)).toBe('149.90M');
    expect(formatPerpsProCompactNumber(1_500_000_000)).toBe('1.50B');
  });

  it('formats prices with the requested aggregation decimals', () => {
    expect(formatPerpsProPrice(63870.3, 1)).toBe('63,870.3');
    expect(formatPerpsProPrice(0.0123, 4)).toBe('0.0123');
    expect(formatPerpsProPrice('', 2)).toBe('-');
  });

  it('formats market and funding rates from fractional values', () => {
    expect(formatPerpsProPercent(0.0232)).toBe('+2.32%');
    expect(formatPerpsProPercent(-0.013)).toBe('-1.30%');
    expect(formatPerpsProFundingRate('0.0000905')).toBe('0.00905%');
  });

  it('keeps the sign outside the funding fee currency marker', () => {
    expect(formatPerpsProSignedUsd(1.25, 2)).toBe('+$1.25');
    expect(formatPerpsProSignedUsd(-1.25, 2)).toBe('-$1.25');
    expect(formatPerpsProSignedUsd(null)).toBe('-');
  });
});
