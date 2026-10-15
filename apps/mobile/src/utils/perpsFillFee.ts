import type { WsFill } from '@rabby-wallet/hyperliquid-sdk';
import BigNumber from 'bignumber.js';

import { PERPS_EXCHANGE_FEE_NUMBER } from '@/constant/perps';

export type PerpsFillFeeSnapshot = Readonly<
  Pick<WsFill, 'px' | 'sz'> & {
    builderFee?: string | null;
  }
>;

const parseAmount = (value: unknown) =>
  typeof value === 'string' && value.trim()
    ? new BigNumber(value)
    : new BigNumber(NaN);

// Match supported Rabby tiers after display rounding, using aggregates as supplied.
// The fallback is a display policy, not proof of the fee actually charged.
export const getRabbyFillFeeRate = (
  fill?: PerpsFillFeeSnapshot | null,
): string => {
  const fallback = `${new BigNumber(PERPS_EXCHANGE_FEE_NUMBER)
    .times(100)
    .toFixed(2)}%`;
  if (!fill) {
    return fallback;
  }

  const price = parseAmount(fill.px);
  const size = parseAmount(fill.sz).abs();
  const builderFee = parseAmount(fill.builderFee);
  const notional = price.times(size);
  if (
    !price.isFinite() ||
    !price.isGreaterThan(0) ||
    !notional.isFinite() ||
    !notional.isGreaterThan(0) ||
    !builderFee.isFinite() ||
    builderFee.isNegative()
  ) {
    return fallback;
  }

  const display = `${builderFee
    .dividedBy(notional)
    .times(100)
    .toFixed(2, BigNumber.ROUND_HALF_UP)}%`;
  // Do not infer the nearest tier or match the unrounded percentage.
  return display === '0.02%' || display === '0.04%' ? display : fallback;
};
