import {
  abbreviateNumber,
  calcPercent,
  formatAmount,
  formatNetworth,
  formatNum,
  formatPriceMainsite,
  numFormat,
  numberToWords,
  unreadCountFormat,
} from './math';

describe('math utils', () => {
  it('abbreviateNumber handles null, zero, and thousand-level abbreviations', () => {
    expect(abbreviateNumber(null)).toBeNull();
    expect(abbreviateNumber(0)).toBe('0');
    expect(abbreviateNumber(1234)).toBe('1.2K');
  });

  it('numFormat preserves the current zero, negative, and billion formatting behavior', () => {
    expect(numFormat(0, undefined, '$', true)).toBe('+$0');
    expect(numFormat(-0.1234)).toBe('-0.1234');
    expect(numFormat(1_234_000_000, undefined, '$')).toBe('$1.2B');
    expect(numFormat(undefined)).toBe('-');
  });

  it('unreadCountFormat keeps its current handling of falsy and clamped values', () => {
    expect(unreadCountFormat(0)).toBe('0');
    expect(unreadCountFormat(-1)).toBe('');
    expect(unreadCountFormat(100, 99)).toBe('99+');
  });

  it('calcPercent follows the current 100 percent fallback when the previous value is empty', () => {
    expect(calcPercent(undefined, 5)).toBe('+100.00%');
    expect(calcPercent(10, 5)).toBe('-50.00%');
    expect(calcPercent(0, 0, 2, false)).toBe('0.00%');
  });

  it('formatNum keeps placeholder, floor, sign, and zero formatting behavior', () => {
    expect(formatNum(undefined)).toBe('-');
    expect(formatNum(0, 2, { keepPostiveSign: true })).toBe('+0');
    expect(formatNum(0.00001, 2, { floor: 0.0001, prefix: '$' })).toBe(
      '<$0.0001',
    );
    expect(formatNum(-0.00001, 2, { floor: 0.0001, prefix: '$' })).toBe(
      '<-$0.0001',
    );
  });

  it('formatNetworth, formatPriceMainsite, and formatAmount preserve the current display thresholds', () => {
    expect(formatNetworth(2_000_000_000)).toBe('$2.00B');
    expect(formatNetworth(1_500_000)).toBe('$1,500,000');
    expect(formatPriceMainsite(1.234)).toBe('$1.23');
    expect(formatPriceMainsite(0.1234)).toBe('$0.1234');
    expect(formatAmount(0)).toBe('0.0000');
    expect(formatAmount(15_000)).toBe('15,000.00');
  });

  it('numberToWords supports the implemented range and out-of-range fallback', () => {
    expect(numberToWords(0)).toBe('zero');
    expect(numberToWords(42)).toBe('forty two');
    expect(numberToWords(3421)).toBe('three thousand four hundred twenty one');
    expect(numberToWords(10_000)).toBe('Number out of range');
  });
});
