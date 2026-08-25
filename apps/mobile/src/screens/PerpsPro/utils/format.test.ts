import {
  formatPerpsProCompactNumber,
  formatPerpsProDecimal,
  formatPerpsProFundingRate,
  formatPerpsProMarketSelectorPrice,
  formatPerpsProPercent,
  formatPerpsProPrice,
  formatPerpsProSignedUsd,
  formatPerpsProTime,
  formatPerpsProUsdValue,
  formatPerpsProVariableDecimal,
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

  it('trims only insignificant fractional zeros from market selector prices', () => {
    expect(formatPerpsProMarketSelectorPrice(101.17, 3)).toBe('101.17');
    expect(formatPerpsProMarketSelectorPrice(101.1799, 3)).toBe('101.18');
    expect(formatPerpsProMarketSelectorPrice(120, 2)).toBe('120');
    expect(formatPerpsProMarketSelectorPrice(0.019105, 6)).toBe('0.019105');
    expect(formatPerpsProMarketSelectorPrice(2503.4, 1)).toBe('2,503.4');
    expect(formatPerpsProMarketSelectorPrice(80663, 0)).toBe('80,663');
    expect(formatPerpsProMarketSelectorPrice(1.5065, 4)).toBe('1.5065');
    expect(formatPerpsProMarketSelectorPrice('', 3)).toBe('-');
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

  it('formats account and row values without compacting them', () => {
    expect(formatPerpsProDecimal('12345.6')).toBe('12,345.60');
    expect(formatPerpsProDecimal(null)).toBe('-');
    expect(formatPerpsProDecimal('')).toBe('-');
    expect(formatPerpsProUsdValue('-12345.6', { signed: true })).toBe(
      '-$12,345.60',
    );
    expect(formatPerpsProUsdValue('12', { signed: true })).toBe('+$12.00');
  });

  it('formats exact base amounts without fixed padding or scientific notation', () => {
    expect(formatPerpsProVariableDecimal('1.2300')).toBe('1.23');
    expect(formatPerpsProVariableDecimal('12345.6000')).toBe('12,345.6');
    expect(formatPerpsProVariableDecimal('0.00000000000000000100')).toBe(
      '0.000000000000000001',
    );
    expect(formatPerpsProVariableDecimal('invalid')).toBe('-');
  });

  it('formats timestamps deterministically in local time', () => {
    const timestamp = new Date(2026, 7, 3, 9, 5, 7).getTime();
    expect(formatPerpsProTime(timestamp)).toBe('2026-08-03 09:05:07');
    expect(formatPerpsProTime(undefined)).toBe('-');
  });
});
