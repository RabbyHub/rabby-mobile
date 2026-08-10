import BigNumber from 'bignumber.js';

export type PerpsProProjectedTradeRisk = {
  gap: number;
  liquidationPrice: string;
  projectedEntryPrice: string;
  projectedSize: string;
};

const positive = (value: unknown) => {
  const result = new BigNumber(
    (value as string | number | null | undefined) ?? Number.NaN,
  );
  return result.isFinite() && result.gt(0) ? result : null;
};

export const resolvePerpsProProjectedTradeRisk = ({
  baseSize,
  calculateLiquidationPrice,
  crossMarginAccountValue,
  crossMaintenanceMarginUsed,
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
  crossMarginAccountValue: string;
  crossMaintenanceMarginUsed: string;
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
}): PerpsProProjectedTradeRisk | null => {
  const entry = positive(entryPrice);
  const orderSize = positive(baseSize);
  const leverageValue = positive(leverage);
  const mark = positive(markPrice);
  if (!entry || !orderSize || !leverageValue || !mark) return null;

  const positionSize = new BigNumber(currentPosition?.szi ?? 0);
  if (!positionSize.isFinite()) return null;
  const currentSize = positionSize.abs();
  const sameDirection =
    (side === 'buy' && positionSize.gt(0)) ||
    (side === 'sell' && positionSize.lt(0));
  const flipsDirection =
    currentSize.gt(0) && !sameDirection && orderSize.gt(currentSize);
  if (currentSize.gt(0) && !sameDirection && !flipsDirection) return null;

  const currentEntry = positive(currentPosition?.entryPx);
  if (sameDirection && !currentEntry) return null;
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
      ? new BigNumber(crossMarginAccountValue).minus(crossMaintenanceMarginUsed)
      : sameDirection
      ? new BigNumber(currentPosition?.marginUsed ?? 0).plus(
          orderSize.multipliedBy(entry).dividedBy(leverageValue),
        )
      : notional.dividedBy(leverageValue);
  if (!margin.isFinite() || margin.lte(0)) return null;

  const liquidation = calculateLiquidationPrice(
    projectedEntry.toNumber(),
    margin.toNumber(),
    side === 'buy' ? 'Long' : 'Short',
    projectedSize.toNumber(),
    notional.toNumber(),
    maxLeverage,
  );
  if (!Number.isFinite(liquidation) || liquidation <= 0) return null;

  return {
    gap: new BigNumber(liquidation).minus(mark).dividedBy(mark).toNumber(),
    liquidationPrice: new BigNumber(liquidation).toFixed(pxDecimals),
    projectedEntryPrice: projectedEntry.toFixed(),
    projectedSize: projectedSize.toFixed(),
  };
};
