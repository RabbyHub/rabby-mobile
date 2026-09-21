import {
  add0x,
  ellipsis,
  formatAddressToShow,
  getAddressScanLink,
  isStrictHexString,
  shortEllipsisAddress,
} from './address';

describe('address utils', () => {
  it('ellipsis keeps the 0x-prefixed head and the tail', () => {
    expect(ellipsis('0x1234567890', 4)).toBe('0x1234...7890');
  });

  it('shortEllipsisAddress truncates from the requested raw length', () => {
    expect(shortEllipsisAddress('0x1234567890', 4)).toBe('0x12...7890');
  });

  it('formatAddressToShow lowercases the output and respects the ellipsis option', () => {
    expect(formatAddressToShow('0xABCDEF1234567890', { length: 4 })).toBe(
      '0xabcd...7890',
    );
    expect(
      formatAddressToShow('0xABCDEF1234567890', {
        ellipsis: false,
      }),
    ).toBe('0xabcdef1234567890');
  });

  it('formatAddressToShow currently turns an undefined address into a stringified placeholder tail', () => {
    expect(formatAddressToShow(undefined)).toBe('...undefined');
  });

  it('rewrites both transaction and tx scan templates to address links', () => {
    expect(getAddressScanLink('/transaction/_s_', '0xabc')).toBe(
      '/address/0xabc',
    );
    expect(getAddressScanLink('/tx/_s_', '0xabc')).toBe('/address/0xabc');
  });

  it('normalizes hex prefixes with add0x', () => {
    expect(add0x('abc')).toBe('0xabc');
    expect(add0x('0Xabc')).toBe('0xabc');
    expect(add0x('0xabc')).toBe('0xabc');
  });

  it('validates strict hex strings using the current case-insensitive matcher', () => {
    expect(isStrictHexString('0xabc123')).toBe(true);
    expect(isStrictHexString('0XABC123')).toBe(true);
    expect(isStrictHexString('abc123')).toBe(false);
    expect(isStrictHexString('0xxyz')).toBe(false);
  });
});
