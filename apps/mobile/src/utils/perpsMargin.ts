import BigNumber from 'bignumber.js';

export interface PerpsMarginTierSource {
  lowerBound: string;
  maxLeverage: number;
}

export interface PerpsMaintenanceMarginTier {
  lowerBound: string;
  maintenanceDeduction: string;
  maintenanceMarginRate: string;
  maxLeverage: number;
}

const validDecimal = (value: unknown): BigNumber | null => {
  const result = new BigNumber(
    (value as string | number | BigNumber | undefined) ?? NaN,
  );
  return result.isFinite() ? result : null;
};

/**
 * Normalize Hyperliquid's margin tiers into the continuous maintenance-margin
 * curve defined by the protocol. Invalid or incomplete tables fail closed so
 * callers never render an understated risk ratio.
 */
export const buildPerpsMaintenanceMarginTiers = (
  tiers: readonly PerpsMarginTierSource[],
): PerpsMaintenanceMarginTier[] => {
  if (!Array.isArray(tiers) || tiers.length === 0) {
    return [];
  }

  const result: PerpsMaintenanceMarginTier[] = [];
  let previousLowerBound: BigNumber | null = null;
  let previousRate: BigNumber | null = null;
  let previousDeduction = new BigNumber(0);

  for (const tier of tiers) {
    const lowerBound = validDecimal(tier?.lowerBound);
    const maxLeverage = validDecimal(tier?.maxLeverage);
    if (
      !lowerBound ||
      !maxLeverage ||
      lowerBound.isNegative() ||
      maxLeverage.lte(0) ||
      (!previousLowerBound && !lowerBound.isZero()) ||
      (previousLowerBound && lowerBound.lte(previousLowerBound))
    ) {
      return [];
    }

    const maintenanceMarginRate = new BigNumber(1).dividedBy(
      maxLeverage.multipliedBy(2),
    );
    if (previousRate && maintenanceMarginRate.lt(previousRate)) {
      return [];
    }

    const maintenanceDeduction = previousRate
      ? previousDeduction.plus(
          lowerBound.multipliedBy(maintenanceMarginRate.minus(previousRate)),
        )
      : new BigNumber(0);

    result.push({
      lowerBound: lowerBound.toString(),
      maintenanceDeduction: maintenanceDeduction.toString(),
      maintenanceMarginRate: maintenanceMarginRate.toString(),
      maxLeverage: maxLeverage.toNumber(),
    });
    previousLowerBound = lowerBound;
    previousRate = maintenanceMarginRate;
    previousDeduction = maintenanceDeduction;
  }

  return result;
};

export const calculatePerpsMaintenanceMargin = ({
  positionNotional,
  tiers,
}: {
  positionNotional: unknown;
  tiers: readonly PerpsMaintenanceMarginTier[];
}): string | null => {
  const notional = validDecimal(positionNotional)?.abs();
  if (!notional || notional.lte(0) || !Array.isArray(tiers)) {
    return null;
  }

  let selectedTier: PerpsMaintenanceMarginTier | null = null;
  let previousLowerBound: BigNumber | null = null;
  for (const tier of tiers) {
    const lowerBound = validDecimal(tier?.lowerBound);
    if (
      !lowerBound ||
      lowerBound.isNegative() ||
      (previousLowerBound && lowerBound.lte(previousLowerBound))
    ) {
      return null;
    }
    previousLowerBound = lowerBound;
    if (notional.gte(lowerBound)) {
      selectedTier = tier;
    } else {
      break;
    }
  }

  if (!selectedTier) {
    return null;
  }
  const maintenanceMarginRate = validDecimal(
    selectedTier.maintenanceMarginRate,
  );
  const maintenanceDeduction = validDecimal(selectedTier.maintenanceDeduction);
  if (
    !maintenanceMarginRate ||
    !maintenanceDeduction ||
    maintenanceMarginRate.lte(0) ||
    maintenanceDeduction.isNegative()
  ) {
    return null;
  }

  const maintenanceMargin = notional
    .multipliedBy(maintenanceMarginRate)
    .minus(maintenanceDeduction);
  return maintenanceMargin.isFinite() && maintenanceMargin.gte(0)
    ? maintenanceMargin.toString()
    : null;
};

export const calculateIsolatedPositionMarginRatio = ({
  isolatedEquity,
  positionNotional,
  tiers,
}: {
  isolatedEquity: unknown;
  positionNotional: unknown;
  tiers: readonly PerpsMaintenanceMarginTier[];
}): string | null => {
  const equity = validDecimal(isolatedEquity);
  if (!equity || equity.lte(0)) {
    return null;
  }
  const maintenanceMargin = calculatePerpsMaintenanceMargin({
    positionNotional,
    tiers,
  });
  if (maintenanceMargin == null) {
    return null;
  }
  const ratio = new BigNumber(maintenanceMargin).dividedBy(equity);
  return ratio.isFinite() && ratio.gte(0) ? ratio.toString() : null;
};
