import BigNumber from 'bignumber.js';
import { PERPS_MINI_USD_VALUE } from '@/constant/perps';

/** Call with the executable base size, after lot-size normalization. */
export const meetsPerpsMinimumOrderNotional = (
  baseSize: string | null,
  referencePrice: string | null,
) => {
  const size = new BigNumber(baseSize ?? NaN);
  const price = new BigNumber(referencePrice ?? NaN);
  return (
    size.isFinite() &&
    price.isFinite() &&
    size.gt(0) &&
    price.gt(0) &&
    size.multipliedBy(price).gte(PERPS_MINI_USD_VALUE)
  );
};
