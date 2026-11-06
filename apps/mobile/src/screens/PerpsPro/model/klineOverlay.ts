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

/**
 * Position guides for the Pro K-line, matching Simple: entry, liquidation
 * and the position-scope TP/SL only. Partial TP/SL orders are not drawn.
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

  (['takeProfit', 'stopLoss'] as const).forEach(kind => {
    const order = position.tpslOrders.find(
      item => item.scope === 'position' && item.kind === kind,
    );
    const price = positivePrice(order?.triggerPrice);
    if (price === null) {
      return;
    }
    lines.push({
      id: kind === 'takeProfit' ? 'tp' : 'sl',
      kind: kind === 'takeProfit' ? 'tp' : 'sl',
      price,
      title: kind === 'takeProfit' ? labels.takeProfit : labels.stopLoss,
    });
  });
  return lines;
};
