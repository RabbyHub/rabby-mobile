import { PERPS_EXCHANGE_FEE_NUMBER } from '@/constant/perps';

import { getRabbyFillFeeRate, type PerpsFillFeeSnapshot } from './perpsFillFee';

const fill: PerpsFillFeeSnapshot = { px: '10000', sz: '1', builderFee: '2' };
const fallback = `${(PERPS_EXCHANGE_FEE_NUMBER * 100).toFixed(2)}%`;

describe('getRabbyFillFeeRate', () => {
  it.each([
    ['2', '0.02%'],
    ['4', '0.04%'],
  ])('accepts the supported Rabby tier %s', (builderFee, expected) => {
    expect(getRabbyFillFeeRate({ ...fill, builderFee })).toBe(expected);
  });

  it('uses the supplied aggregate notional before display rounding', () => {
    expect(
      getRabbyFillFeeRate({ px: '17500', sz: '4', builderFee: '26' }),
    ).toBe('0.04%');
  });

  it.each(['0', '-0', '1', '3', '6', '10', '100'])(
    'uses the shared fallback for zero or an unsupported rate (%s)',
    builderFee => {
      expect(getRabbyFillFeeRate({ ...fill, builderFee })).toBe(fallback);
    },
  );

  it.each([undefined, null, '', ' ', 'invalid', 'NaN', 'Infinity', '-1'])(
    'falls back for a missing or invalid builder fee (%p)',
    builderFee => {
      expect(getRabbyFillFeeRate({ ...fill, builderFee })).toBe(fallback);
    },
  );

  it.each([
    { px: '0' },
    { px: '-1' },
    { px: '' },
    { px: 'Infinity' },
    { sz: '0' },
    { sz: 'NaN' },
    { sz: 'Infinity' },
  ])('falls back for an invalid notional (%p)', values => {
    expect(getRabbyFillFeeRate({ ...fill, ...values })).toBe(fallback);
  });

  it.each([0, false, {}])(
    'tolerates a malformed non-string builder field (%p)',
    builderFee => {
      expect(
        getRabbyFillFeeRate({
          ...fill,
          builderFee,
        } as unknown as PerpsFillFeeSnapshot),
      ).toBe(fallback);
    },
  );

  it.each([
    ['1.4999999', '0.04%'],
    ['1.5', '0.02%'],
    ['2.4999999', '0.02%'],
    ['2.5', '0.04%'],
    ['3.4999999', '0.04%'],
    ['3.5', '0.04%'],
    ['4.4999999', '0.04%'],
    ['4.5', '0.04%'],
  ])(
    'matches only after two-decimal half-up rounding (%s)',
    (builderFee, expected) => {
      expect(getRabbyFillFeeRate({ ...fill, builderFee })).toBe(expected);
    },
  );

  it('supports signed size without mutating raw facts', () => {
    const input = Object.freeze({ ...fill, sz: '-1' });
    expect(getRabbyFillFeeRate(input)).toBe('0.02%');
    expect(input).toEqual({ px: '10000', sz: '-1', builderFee: '2' });
  });

  it.each(['0', '-10', 'invalid'])(
    'does not use total fee or its display currency (%s)',
    fee => {
      const input = Object.freeze({
        ...fill,
        fee,
        feeToken: 'HYPE',
        quoteAsset: 'USDC',
      });
      expect(getRabbyFillFeeRate(input)).toBe('0.02%');
      expect(input.fee).toBe(fee);
    },
  );

  it.each([undefined, null])('falls back for a missing record (%p)', record => {
    expect(getRabbyFillFeeRate(record)).toBe(fallback);
  });
});
