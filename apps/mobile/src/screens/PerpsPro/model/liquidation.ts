import BigNumber from 'bignumber.js';

import type { PerpsMaintenanceMarginTier } from '@/utils/perpsMargin';

const decimal = (value: unknown): BigNumber | null => {
  const result = new BigNumber(
    (value as string | number | BigNumber | null | undefined) ?? Number.NaN,
  );
  return result.isFinite() ? result : null;
};

const nonNegativeDecimal = (value: unknown): BigNumber | null => {
  const result = decimal(value);
  return result && result.gte(0) ? result : null;
};

const positiveDecimal = (value: unknown): BigNumber | null => {
  const result = decimal(value);
  return result && result.gt(0) ? result : null;
};

const nonZeroAbsoluteDecimal = (value: unknown): BigNumber | null => {
  const result = decimal(value);
  return result && !result.isZero() ? result.abs() : null;
};

/**
 * Solve a liquidation candidate against every maintenance tier and accept
 * only the candidate whose liquidation notional belongs to that same tier.
 */
export const projectPerpsProLiquidationPrice = ({
  direction,
  margin,
  positionSize,
  referencePrice,
  tiers,
}: {
  direction: 'long' | 'short';
  margin: unknown;
  positionSize: unknown;
  referencePrice: unknown;
  tiers: readonly PerpsMaintenanceMarginTier[];
}): string | null => {
  const reference = positiveDecimal(referencePrice);
  const size = nonZeroAbsoluteDecimal(positionSize);
  const targetMargin = nonNegativeDecimal(margin);
  if (!reference || !size || !targetMargin || !Array.isArray(tiers)) {
    return null;
  }
  const side = direction === 'long' ? new BigNumber(1) : new BigNumber(-1);

  for (let index = 0; index < tiers.length; index += 1) {
    const tier = tiers[index];
    const lowerBound = nonNegativeDecimal(tier?.lowerBound);
    const nextLowerBound =
      index + 1 < tiers.length
        ? nonNegativeDecimal(tiers[index + 1]?.lowerBound)
        : null;
    const rate = positiveDecimal(tier?.maintenanceMarginRate);
    const deduction = nonNegativeDecimal(tier?.maintenanceDeduction);
    if (
      !lowerBound ||
      !rate ||
      !deduction ||
      (index + 1 < tiers.length && !nextLowerBound)
    ) {
      return null;
    }
    const denominator = new BigNumber(1).minus(rate.multipliedBy(side));
    if (denominator.isZero()) {
      return null;
    }
    const referenceMaintenance = size
      .multipliedBy(reference)
      .multipliedBy(rate)
      .minus(deduction);
    const candidate = reference.minus(
      side
        .multipliedBy(targetMargin.minus(referenceMaintenance))
        .dividedBy(size)
        .dividedBy(denominator),
    );
    if (!candidate.isFinite()) {
      continue;
    }
    if (candidate.lte(0)) {
      if (direction === 'long' && lowerBound.isZero()) {
        return '0';
      }
      continue;
    }
    const candidateNotional = size.multipliedBy(candidate);
    if (
      candidateNotional.gte(lowerBound) &&
      (!nextLowerBound || candidateNotional.lt(nextLowerBound))
    ) {
      return candidate.toFixed();
    }
  }
  return null;
};
