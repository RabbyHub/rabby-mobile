import {
  PERPS_BUILDER_INFO,
  PERPS_EXCHANGE_FEE_NUMBER,
} from '@/constant/perps';

import { isPerpsBuilderFeeApproved } from './perpsBuilderFee';

describe('Perps builder fee', () => {
  it('charges four basis points in order units and notional calculations', () => {
    expect(PERPS_BUILDER_INFO.fee).toBe(40);
    expect(PERPS_EXCHANGE_FEE_NUMBER).toBe(0.0004);
    expect(10000 * PERPS_EXCHANGE_FEE_NUMBER).toBe(4);
  });

  it.each([40, 100])('accepts a sufficient approval of %s', maxFee => {
    expect(isPerpsBuilderFeeApproved(maxFee)).toBe(true);
  });

  it.each([0, 20, 39, -1, NaN, Infinity, undefined, null, '40', true])(
    'rejects an insufficient or invalid approval of %s',
    maxFee => {
      expect(isPerpsBuilderFeeApproved(maxFee)).toBe(false);
    },
  );
});
