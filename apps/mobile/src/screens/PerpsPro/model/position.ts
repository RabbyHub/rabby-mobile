import type { AssetPosition, OpenOrder } from '@rabby-wallet/hyperliquid-sdk';
import BigNumber from 'bignumber.js';

import {
  collectActivePositionTpSlOrders,
  type PerpsPositionTpSlOrderViewModel,
} from './positionTpSl';

export type PerpsPositionDirection = 'long' | 'short';
export interface PerpsPositionViewModel {
  baseSize: string;
  coin: string;
  direction: PerpsPositionDirection;
  entryPrice: string | null;
  key: string;
  leverage: number;
  liquidationPrice: string | null;
  margin: string;
  marginMode: 'cross' | 'isolated';
  marginRatio: string | null;
  maxLeverage: number;
  pnl: string;
  quoteSize: string;
  roiRatio: string;
  tpslOrders: PerpsPositionTpSlOrderViewModel[];
}

const validDecimal = (value: unknown): BigNumber | null => {
  const result = new BigNumber((value as string | number | undefined) ?? NaN);
  return result.isFinite() ? result : null;
};

const normalizedOptionalDecimal = (value: unknown): string | null => {
  const result = validDecimal(value);
  return result && !result.isZero() ? result.toString() : null;
};

export const collectPositionTpslOrders = (
  coin: string,
  openOrders: OpenOrder[],
): PerpsPositionTpSlOrderViewModel[] =>
  collectActivePositionTpSlOrders(coin, openOrders);

export const buildPerpsPositionViewModel = (
  assetPosition: AssetPosition,
  openOrders: OpenOrder[],
  accountMarginRatio: string | null = null,
): PerpsPositionViewModel | null => {
  const position = assetPosition.position;
  const signedSize = validDecimal(position.szi);
  if (!signedSize || signedSize.isZero()) {
    return null;
  }
  const pnl = validDecimal(position.unrealizedPnl) ?? new BigNumber(0);
  const roiMagnitude = (
    validDecimal(position.returnOnEquity) ?? new BigNumber(0)
  ).abs();
  const leverage = Number(position.leverage?.value);
  const marginMode =
    position.leverage?.type === 'isolated' ? 'isolated' : 'cross';

  return {
    baseSize: signedSize.abs().toString(),
    coin: position.coin,
    direction: signedSize.gt(0) ? 'long' : 'short',
    entryPrice: normalizedOptionalDecimal(position.entryPx),
    key: position.coin,
    leverage: Number.isFinite(leverage) && leverage > 0 ? leverage : 0,
    liquidationPrice: normalizedOptionalDecimal(position.liquidationPx),
    margin: (validDecimal(position.marginUsed) ?? new BigNumber(0))
      .abs()
      .toString(),
    marginMode,
    marginRatio: marginMode === 'cross' ? accountMarginRatio : null,
    maxLeverage: Number(position.maxLeverage) || 0,
    pnl: pnl.toString(),
    quoteSize: (validDecimal(position.positionValue) ?? new BigNumber(0))
      .abs()
      .toString(),
    roiRatio: (pnl.isNegative()
      ? roiMagnitude.negated()
      : roiMagnitude
    ).toString(),
    tpslOrders: collectPositionTpslOrders(position.coin, openOrders),
  };
};

export const sortPerpsPositions = (
  positions: PerpsPositionViewModel[],
): PerpsPositionViewModel[] =>
  [...positions].sort((left, right) => left.coin.localeCompare(right.coin));

export const buildPerpsPositions = (
  assetPositions: AssetPosition[],
  openOrders: OpenOrder[],
  accountMarginRatio: string | null = null,
): PerpsPositionViewModel[] =>
  sortPerpsPositions(
    assetPositions
      .map(position =>
        buildPerpsPositionViewModel(position, openOrders, accountMarginRatio),
      )
      .filter((position): position is PerpsPositionViewModel => !!position),
  );

export const filterPerpsPositionsForMarket = (
  positions: PerpsPositionViewModel[],
  canonicalCoin: string,
  hideOtherSymbols: boolean,
): PerpsPositionViewModel[] =>
  hideOtherSymbols
    ? positions.filter(position => position.coin === canonicalCoin)
    : positions;

export const getPerpsPositionDisplaySize = (
  position: Pick<PerpsPositionViewModel, 'baseSize' | 'quoteSize'>,
  sizeUnit: 'base' | 'quote',
) => (sizeUnit === 'base' ? position.baseSize : position.quoteSize);

export const calculateLiquidationDistance = ({
  direction,
  liquidationPrice,
  markPrice,
}: {
  direction: PerpsPositionDirection;
  liquidationPrice: string | null;
  markPrice: string | null;
}): string | null => {
  const mark = validDecimal(markPrice);
  const liquidation = validDecimal(liquidationPrice);
  if (!mark || !liquidation || mark.lte(0) || liquidation.lte(0)) {
    return null;
  }
  const distance =
    direction === 'long'
      ? mark.minus(liquidation).dividedBy(mark)
      : liquidation.minus(mark).dividedBy(mark);
  return distance.toString();
};

export type PerpsPositionSignedLiquidationDistance = {
  priceGap: string;
  ratio: string;
};

export const calculateSignedLiquidationDistance = ({
  liquidationPrice,
  markPrice,
}: {
  liquidationPrice: string | null;
  markPrice: string | null;
}): PerpsPositionSignedLiquidationDistance | null => {
  const mark = validDecimal(markPrice);
  const liquidation = validDecimal(liquidationPrice);
  if (!mark || !liquidation || mark.lte(0) || liquidation.lte(0)) {
    return null;
  }
  const priceGap = liquidation.minus(mark);
  return {
    priceGap: priceGap.toString(),
    ratio: priceGap.dividedBy(mark).toString(),
  };
};
