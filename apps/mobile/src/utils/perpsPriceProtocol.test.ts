import {
  getPerpsProPriceInputMaxDecimals,
  isPerpsProPriceProtocolValid,
  normalizePerpsProCalculatedPrice,
  roundPerpsProTpSlPrice,
  sanitizePerpsProPriceEditingInput,
  sanitizePerpsProPriceInput,
} from './perpsPriceProtocol';

describe('Perps price protocol', () => {
  it.each([
    ['0.0946159998587', 0, '0.094616'],
    ['0.0946160001413', 0, '0.094616'],
    ['0.1234499', 2, '0.1234'],
    ['0.12345', 2, '0.1235'],
    ['99999.9', 0, '100000'],
    ['111111.9', 5, '111112'],
    ['111111', 5, '111111'],
    ['0.0000004', 0, null],
  ])(
    'rounds TP/SL %s once to the nearest legal tick',
    (price, szDecimals, expected) => {
      expect(roundPerpsProTpSlPrice(price, szDecimals)).toBe(expected);
    },
  );

  it.each([
    [0, 6],
    [1, 5],
    [2, 4],
    [5, 1],
  ])('derives the price decimal cap for szDecimals=%i', (szDecimals, cap) => {
    expect(getPerpsProPriceInputMaxDecimals(szDecimals)).toBe(cap);
  });

  it.each([
    ['51000', 5],
    ['123.45', 2],
    ['12.345', 0],
    ['0.12345', 0],
    ['0.1', 5],
  ])('accepts protocol-valid price %s', (price, szDecimals) => {
    expect(isPerpsProPriceProtocolValid(price, szDecimals)).toBe(true);
  });

  it.each([
    ['51000.1', 5],
    ['123.456', 2],
    ['12.3456', 0],
    ['0.123456', 0],
    ['0.12', 5],
    ['001', 2],
    ['1.', 2],
    ['0', 2],
  ])('rejects non-canonical price %s', (price, szDecimals) => {
    expect(isPerpsProPriceProtocolValid(price, szDecimals)).toBe(false);
  });

  it('sanitizes editing text without leaking incomplete zero runs to submit', () => {
    expect(sanitizePerpsProPriceEditingInput('000', 2)).toBe('000');
    expect(sanitizePerpsProPriceInput('000', 2)).toBe('0');
    expect(sanitizePerpsProPriceInput('12.3456', 0)).toBe('12.345');
    expect(sanitizePerpsProPriceInput('123.456', 2)).toBe('123.45');
  });

  it.each([
    ['51000', 5, '51000'],
    ['123.456', 2, '123.45'],
    ['12.34567', 0, '12.345'],
    ['0.123456', 0, '0.12345'],
  ])(
    'normalizes calculated price %s for szDecimals=%i',
    (price, szDecimals, expected) => {
      expect(normalizePerpsProCalculatedPrice(price, szDecimals)).toBe(
        expected,
      );
    },
  );
});
