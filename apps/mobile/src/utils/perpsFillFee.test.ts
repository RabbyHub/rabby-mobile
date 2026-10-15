import { PERPS_EXCHANGE_FEE_NUMBER } from '@/constant/perps';

import {
  getPerpsFillFeeRates,
  type PerpsFillFeeSnapshot,
} from './perpsFillFee';

const fill: PerpsFillFeeSnapshot = {
  px: '10000',
  sz: '1',
  fee: '6.5',
  builderFee: '2',
  feeToken: 'USDC',
  quoteAsset: 'USDC',
};

describe('getPerpsFillFeeRates', () => {
  it.each([
    ['old fee', {}, { builder: '0.02%', exchange: '0.05%' }],
    [
      'new fee',
      { fee: '8.5', builderFee: '4' },
      { builder: '0.04%', exchange: '0.05%' },
    ],
    [
      'aggregated fills',
      { px: '17500', sz: '4', fee: '57.5', builderFee: '26' },
      { builder: '0.04%', exchange: '0.05%' },
    ],
    [
      'explicit zero',
      { fee: '0', builderFee: '0' },
      { builder: '0.00%', exchange: '0.00%' },
    ],
    [
      'signed size and rebate',
      { sz: '-1', fee: '1' },
      { builder: '0.02%', exchange: '-0.01%' },
    ],
    [
      'negative total fee',
      { fee: '-1', builderFee: '0' },
      { builder: '0.00%', exchange: '-0.01%' },
    ],
    [
      'negative zero after rounding',
      { fee: '1.99' },
      { builder: '0.02%', exchange: '0.00%' },
    ],
    [
      'valid alternate quote',
      { feeToken: 'USDH', quoteAsset: 'USDH' },
      { builder: '0.02%', exchange: '0.05%' },
    ],
    [
      'currency case and whitespace',
      { feeToken: ' usdc ' },
      { builder: '0.02%', exchange: '0.05%' },
    ],
    [
      'legacy missing fee token',
      { feeToken: undefined },
      { builder: '0.02%', exchange: '0.05%' },
    ],
    [
      'different fee currency',
      { feeToken: 'HYPE' },
      { builder: '-', exchange: '-' },
    ],
  ] as const)('calculates %s', (_name, overrides, expected) => {
    expect(getPerpsFillFeeRates({ ...fill, ...overrides })).toEqual(expected);
  });

  it.each([undefined, null, '', '   '])(
    'uses the shared default only for a missing builder fee (%p)',
    builderFee => {
      const expected = {
        builder: `${(PERPS_EXCHANGE_FEE_NUMBER * 100).toFixed(2)}%`,
        exchange: '-',
      };
      expect(getPerpsFillFeeRates({ ...fill, builderFee })).toEqual(expected);
      expect(
        getPerpsFillFeeRates({
          ...fill,
          builderFee,
          px: '0',
          feeToken: 'HYPE',
        }),
      ).toEqual(expected);
    },
  );

  it.each([
    { builderFee: 'invalid' },
    { builderFee: 'NaN' },
    { builderFee: 'Infinity' },
    { builderFee: '-1' },
    { px: '0' },
    { px: '-1' },
    { px: 'Infinity' },
    { px: '' },
    { sz: '0' },
    { sz: 'NaN' },
    { sz: 'Infinity' },
  ])('does not turn invalid facts into zero or a default: %p', overrides => {
    expect(getPerpsFillFeeRates({ ...fill, ...overrides })).toEqual({
      builder: '-',
      exchange: '-',
    });
  });

  it('tolerates a malformed non-string builder field without treating it as missing', () => {
    expect(
      getPerpsFillFeeRates({
        ...fill,
        builderFee: 0,
      } as unknown as PerpsFillFeeSnapshot),
    ).toEqual({ builder: '-', exchange: '-' });
  });

  it.each(['', ' ', 'NaN', 'Infinity'])(
    'keeps the builder rate when the total fee is invalid (%p)',
    fee => {
      expect(getPerpsFillFeeRates({ ...fill, fee })).toEqual({
        builder: '0.02%',
        exchange: '-',
      });
    },
  );

  it.each([
    ['3.4999999', '0.03%'],
    ['3.5', '0.04%'],
    ['3.9999999', '0.04%'],
  ])('rounds %s only at final display precision', (builderFee, builder) => {
    expect(getPerpsFillFeeRates({ ...fill, builderFee }).builder).toBe(builder);
  });

  it.each([undefined, null])(
    'does not invent a fee without a fill (%p)',
    value => {
      expect(getPerpsFillFeeRates(value)).toEqual({
        builder: '-',
        exchange: '-',
      });
    },
  );
});
