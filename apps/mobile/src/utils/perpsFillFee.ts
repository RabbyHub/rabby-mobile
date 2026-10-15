import type { WsFill } from '@rabby-wallet/hyperliquid-sdk';
import BigNumber from 'bignumber.js';

import { PERPS_EXCHANGE_FEE_NUMBER } from '@/constant/perps';

export type PerpsFillFeeSnapshot = Readonly<
  Pick<WsFill, 'px' | 'sz' | 'fee'> & {
    builderFee?: string | null;
    feeToken?: string;
    quoteAsset?: string;
  }
>;

export type PerpsFillFeeRates = Readonly<{
  builder: string;
  exchange: string;
}>;

const parseAmount = (value: unknown) =>
  typeof value === 'string' && value.trim()
    ? new BigNumber(value)
    : new BigNumber(NaN);

const formatFeeRate = (amount: BigNumber, notional: BigNumber) => {
  const percent = amount
    .dividedBy(notional)
    .times(100)
    .toFixed(2, BigNumber.ROUND_HALF_UP);
  return `${new BigNumber(percent).isZero() ? '0.00' : percent}%`;
};

export const getPerpsFillFeeRates = (
  fill?: PerpsFillFeeSnapshot | null,
): PerpsFillFeeRates => {
  const unknown = { builder: '-', exchange: '-' };
  if (!fill) {
    return unknown;
  }

  // A missing builder fee uses the product default; it is not a measured rate.
  if (
    fill.builderFee == null ||
    (typeof fill.builderFee === 'string' && !fill.builderFee.trim())
  ) {
    return {
      builder: `${new BigNumber(PERPS_EXCHANGE_FEE_NUMBER)
        .times(100)
        .toFixed(2)}%`,
      exchange: '-',
    };
  }

  // Spot fills can pay fees in the base asset. Do not divide different units.
  const feeToken = fill.feeToken?.trim().toUpperCase();
  const quoteAsset = fill.quoteAsset?.trim().toUpperCase();
  if (feeToken && quoteAsset && feeToken !== quoteAsset) {
    return unknown;
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
    return unknown;
  }

  // Hyperliquid's total fee already includes the builder fee; rebates can be negative.
  const totalFee = parseAmount(fill.fee);
  return {
    builder: formatFeeRate(builderFee, notional),
    exchange: totalFee.isFinite()
      ? formatFeeRate(totalFee.minus(builderFee), notional)
      : '-',
  };
};
