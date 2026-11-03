import BigNumber from 'bignumber.js';

import type { PerpsProOverlayLine } from '@/components2024/TradingViewCandleChart/type';

import type { PerpsPositionViewModel } from './position';

export type PerpsProKlineOverlayLabels = {
  entry: string;
  liquidation: string;
  stopLoss: string;
  takeProfit: string;
};

const positivePrice = (value: string | null | undefined) => {
  const price = Number(value);
  return Number.isFinite(price) && price > 0 ? price : null;
};

const formatShare = (share: BigNumber) =>
  share.lt(1) ? '<1%' : `${share.integerValue(BigNumber.ROUND_HALF_UP)}%`;

/**
 * Position guides for the Pro K-line. Every active TP/SL is drawn: a
 * position-scope order covers 100%, a partial one shows its share of the
 * current size, and orders at the same trigger price merge into one line.
 */
export const buildPerpsProKlineOverlayLines = (
  position: PerpsPositionViewModel | null,
  labels: PerpsProKlineOverlayLabels,
): PerpsProOverlayLine[] => {
  if (!position) {
    return [];
  }
  const lines: PerpsProOverlayLine[] = [];
  const entryPrice = positivePrice(position.entryPrice);
  if (entryPrice !== null) {
    lines.push({
      id: 'entry',
      kind: 'entry',
      price: entryPrice,
      title: labels.entry,
    });
  }
  const liquidationPrice = positivePrice(position.liquidationPrice);
  if (liquidationPrice !== null) {
    lines.push({
      id: 'liquidation',
      kind: 'liquidation',
      price: liquidationPrice,
      title: labels.liquidation,
    });
  }

  const positionSize = new BigNumber(position.baseSize);
  const shares = new Map<
    string,
    { kind: 'tp' | 'sl'; price: number; share: BigNumber }
  >();
  position.tpslOrders.forEach(order => {
    const price = positivePrice(order.triggerPrice);
    if (price === null) {
      return;
    }
    const kind = order.kind === 'takeProfit' ? 'tp' : 'sl';
    const share =
      order.scope === 'position'
        ? new BigNumber(100)
        : positionSize.gt(0)
        ? new BigNumber(order.remainingSize).div(positionSize).times(100)
        : null;
    if (!share?.isFinite() || share.lte(0)) {
      return;
    }
    const id = `${kind}:${price}`;
    const existing = shares.get(id);
    shares.set(id, {
      kind,
      price,
      share: BigNumber.min(
        100,
        (existing?.share ?? new BigNumber(0)).plus(share),
      ),
    });
  });
  shares.forEach(({ kind, price, share }, id) => {
    lines.push({
      id,
      kind,
      price,
      title: `${
        kind === 'tp' ? labels.takeProfit : labels.stopLoss
      } ${formatShare(share)}`,
    });
  });
  return lines;
};
