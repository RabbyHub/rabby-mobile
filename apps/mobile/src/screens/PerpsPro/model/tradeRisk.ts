import BigNumber from 'bignumber.js';

import {
  calculatePerpsMaintenanceMargin,
  type PerpsMaintenanceMarginTier,
} from '@/utils/perpsMargin';

import { projectPerpsProLiquidationPrice } from './liquidation';

export type PerpsProProjectedTradeRisk = {
  gap: number;
  liquidationPrice: string;
  projectedEntryPrice: string;
  projectedSize: string;
};

export type PerpsProProjectedTradeRiskOutcome =
  | { kind: 'price'; risk: PerpsProProjectedTradeRisk }
  | { kind: 'noPositivePrice' }
  | { kind: 'notApplicable'; reason: 'reducesOrCloses' }
  | {
      kind: 'unavailable';
      reason:
        | 'calculation'
        | 'currentPosition'
        | 'input'
        | 'margin'
        | 'positionEntry';
    };

const positive = (value: unknown) => {
  const result = new BigNumber(
    (value as string | number | null | undefined) ?? Number.NaN,
  );
  return result.isFinite() && result.gt(0) ? result : null;
};

export const resolvePerpsProProjectedTradeRiskOutcome = ({
  baseSize,
  calculateLiquidationPrice,
  crossMarginAvailableAfterMaintenance,
  currentPosition,
  entryPrice,
  leverage,
  maintenanceMarginTiers,
  marginMode,
  markPrice,
  maxLeverage,
  pxDecimals,
  side,
}: {
  baseSize: string;
  calculateLiquidationPrice: (
    markPrice: number,
    margin: number,
    direction: 'Long' | 'Short',
    positionSize: number,
    nationalValue: number,
    maxLeverage: number,
  ) => number;
  crossMarginAvailableAfterMaintenance: string | null;
  currentPosition?: {
    entryPx?: string;
    marginUsed?: string;
    positionValue?: string;
    szi?: string;
  } | null;
  entryPrice: string;
  leverage: number;
  maintenanceMarginTiers?: readonly PerpsMaintenanceMarginTier[];
  marginMode: 'cross' | 'isolated';
  markPrice: string;
  maxLeverage: number;
  pxDecimals: number;
  side: 'buy' | 'sell';
}): PerpsProProjectedTradeRiskOutcome => {
  const entry = positive(entryPrice);
  const orderSize = positive(baseSize);
  const leverageValue = positive(leverage);
  const mark = positive(markPrice);
  const maxLeverageValue = positive(maxLeverage);
  if (!entry || !orderSize || !leverageValue || !mark || !maxLeverageValue) {
    return { kind: 'unavailable', reason: 'input' };
  }

  const positionSize = new BigNumber(currentPosition?.szi ?? 0);
  if (!positionSize.isFinite()) {
    return { kind: 'unavailable', reason: 'currentPosition' };
  }
  const currentSize = positionSize.abs();
  const sameDirection =
    (side === 'buy' && positionSize.gt(0)) ||
    (side === 'sell' && positionSize.lt(0));
  const flipsDirection =
    currentSize.gt(0) && !sameDirection && orderSize.gt(currentSize);
  if (currentSize.gt(0) && !sameDirection && !flipsDirection) {
    return { kind: 'notApplicable', reason: 'reducesOrCloses' };
  }

  const currentEntry = positive(currentPosition?.entryPx);
  if (sameDirection && !currentEntry) {
    return { kind: 'unavailable', reason: 'positionEntry' };
  }
  const currentNotional =
    sameDirection && currentEntry
      ? currentSize.multipliedBy(currentEntry)
      : new BigNumber(0);
  const projectedSize = sameDirection
    ? currentSize.plus(orderSize)
    : flipsDirection
    ? orderSize.minus(currentSize)
    : orderSize;
  const notional = sameDirection
    ? currentNotional.plus(orderSize.multipliedBy(entry))
    : projectedSize.multipliedBy(entry);
  const projectedEntry = notional.dividedBy(projectedSize);
  const reportedCurrentNotional = new BigNumber(
    currentPosition?.positionValue ?? Number.NaN,
  ).abs();
  const hasMaintenanceMarginTiers =
    Array.isArray(maintenanceMarginTiers) && maintenanceMarginTiers.length > 0;
  const currentMaintenanceNotional =
    reportedCurrentNotional.isFinite() && reportedCurrentNotional.gt(0)
      ? reportedCurrentNotional
      : currentSize.multipliedBy(mark);
  // Cross available-after-maintenance already excludes the current position's
  // maintenance. Restore it here so the calculator replaces it with the
  // projected position maintenance instead of charging both positions.
  const tieredCurrentMaintenance =
    currentSize.gt(0) && hasMaintenanceMarginTiers
      ? calculatePerpsMaintenanceMargin({
          positionNotional: currentMaintenanceNotional,
          tiers: maintenanceMarginTiers,
        })
      : null;
  if (
    currentSize.gt(0) &&
    hasMaintenanceMarginTiers &&
    tieredCurrentMaintenance == null
  ) {
    return { kind: 'unavailable', reason: 'calculation' };
  }
  const currentMaintenance = currentSize.gt(0)
    ? hasMaintenanceMarginTiers
      ? new BigNumber(tieredCurrentMaintenance ?? Number.NaN)
      : currentMaintenanceNotional.dividedBy(maxLeverageValue.multipliedBy(2))
    : new BigNumber(0);
  const crossRiskMargin = new BigNumber(
    crossMarginAvailableAfterMaintenance ?? Number.NaN,
  ).plus(currentMaintenance);
  const projectedInitialMargin = notional.dividedBy(leverageValue);
  // Hyperliquid's web estimator still projects a valid liquidation price when
  // the typed size exceeds today's available balance. Model that display-only
  // top-up to the order's initial-margin requirement without changing Max or
  // submission eligibility.
  const margin =
    marginMode === 'cross'
      ? crossRiskMargin.isFinite()
        ? BigNumber.max(crossRiskMargin, projectedInitialMargin)
        : crossRiskMargin
      : sameDirection
      ? new BigNumber(currentPosition?.marginUsed ?? 0).plus(
          orderSize.multipliedBy(entry).dividedBy(leverageValue),
        )
      : projectedInitialMargin;
  if (!margin.isFinite() || margin.lte(0)) {
    return { kind: 'unavailable', reason: 'margin' };
  }

  const liquidationValue = hasMaintenanceMarginTiers
    ? projectPerpsProLiquidationPrice({
        direction: side === 'buy' ? 'long' : 'short',
        margin,
        positionSize: projectedSize,
        referencePrice: projectedEntry,
        tiers: maintenanceMarginTiers,
      })
    : calculateLiquidationPrice(
        projectedEntry.toNumber(),
        margin.toNumber(),
        side === 'buy' ? 'Long' : 'Short',
        projectedSize.toNumber(),
        notional.toNumber(),
        maxLeverage,
      );
  const liquidation = new BigNumber(liquidationValue ?? Number.NaN);
  if (!liquidation.isFinite()) {
    return { kind: 'unavailable', reason: 'calculation' };
  }
  if (liquidation.lte(0)) return { kind: 'noPositivePrice' };

  return {
    kind: 'price',
    risk: {
      gap: liquidation.minus(mark).dividedBy(mark).toNumber(),
      liquidationPrice: liquidation.toFixed(pxDecimals),
      projectedEntryPrice: projectedEntry.toFixed(),
      projectedSize: projectedSize.toFixed(),
    },
  };
};

export const resolvePerpsProProjectedTradeRisk = (
  facts: Parameters<typeof resolvePerpsProProjectedTradeRiskOutcome>[0],
): PerpsProProjectedTradeRisk | null => {
  const outcome = resolvePerpsProProjectedTradeRiskOutcome(facts);
  return outcome.kind === 'price' ? outcome.risk : null;
};
