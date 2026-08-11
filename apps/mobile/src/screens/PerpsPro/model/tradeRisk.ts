import BigNumber from 'bignumber.js';

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
    szi?: string;
  } | null;
  entryPrice: string;
  leverage: number;
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
  if (!entry || !orderSize || !leverageValue || !mark) {
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
  const margin =
    marginMode === 'cross'
      ? new BigNumber(crossMarginAvailableAfterMaintenance ?? Number.NaN)
      : sameDirection
      ? new BigNumber(currentPosition?.marginUsed ?? 0).plus(
          orderSize.multipliedBy(entry).dividedBy(leverageValue),
        )
      : notional.dividedBy(leverageValue);
  if (!margin.isFinite() || margin.lte(0)) {
    return { kind: 'unavailable', reason: 'margin' };
  }

  const liquidation = calculateLiquidationPrice(
    projectedEntry.toNumber(),
    margin.toNumber(),
    side === 'buy' ? 'Long' : 'Short',
    projectedSize.toNumber(),
    notional.toNumber(),
    maxLeverage,
  );
  if (!Number.isFinite(liquidation)) {
    return { kind: 'unavailable', reason: 'calculation' };
  }
  if (liquidation <= 0) return { kind: 'noPositivePrice' };

  return {
    kind: 'price',
    risk: {
      gap: new BigNumber(liquidation).minus(mark).dividedBy(mark).toNumber(),
      liquidationPrice: new BigNumber(liquidation).toFixed(pxDecimals),
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
