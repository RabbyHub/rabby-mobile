import {
  getPerpsProTwapMinimum,
  parsePerpsProTwapDuration,
  sanitizePerpsProTwapDuration,
  validatePerpsProTwapDraft,
} from './twapOrder';

describe('TWAP amount and duration contract', () => {
  it('accepts the minimum total independently of duration', () => {
    for (const durationDraft of ['5', '30', '60', '720', '1439']) {
      expect(
        validatePerpsProTwapDraft({
          baseSize: '0.002',
          midPrice: '50000',
          szDecimals: 5,
          durationDraft,
        }).valid,
      ).toBe(true);
    }
  });

  it('checks the actual quantized size and exposes independent errors', () => {
    const result = validatePerpsProTwapDraft({
      baseSize: '0.0019999',
      midPrice: '50000',
      szDecimals: 5,
      durationDraft: '4',
    });
    expect(result).toMatchObject({
      amountError: 'amountTooSmall',
      durationError: 'durationTooShort',
      baseSize: '0.00199',
      notional: '99.5',
      valid: false,
    });
    expect(getPerpsProTwapMinimum('60000', 5)?.minimumBaseSize).toBe('0.00167');
  });

  it('preserves empty input, rejects non-integers and clamps the product cap', () => {
    expect(sanitizePerpsProTwapDuration('', '5')).toBe('');
    for (const value of ['1.5', '-5', '1e3', '30m']) {
      expect(sanitizePerpsProTwapDuration(value, '5')).toBe('5');
      expect(parsePerpsProTwapDuration(value).error).toBe('durationInvalid');
    }
    expect(sanitizePerpsProTwapDuration('9999999999999999999', '')).toBe(
      '1439',
    );
    expect(parsePerpsProTwapDuration('').error).toBe('durationRequired');
    expect(parsePerpsProTwapDuration('1440').error).toBe('durationTooLong');
  });

  it('fails closed for unavailable prices and respects direction capacity', () => {
    const draft = {
      baseSize: '2',
      midPrice: '100',
      szDecimals: 2,
      durationDraft: '5',
    };
    expect(
      validatePerpsProTwapDraft({ ...draft, midPrice: '0' }).amountError,
    ).toBe('priceUnavailable');
    expect(
      validatePerpsProTwapDraft({ ...draft, maximumBaseSize: '1' }).amountError,
    ).toBe('amountExceedsMaximum');
  });
});
