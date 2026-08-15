import type { MarketData } from '@/hooks/perps/usePerpsStore';
import { buildPerpsProMarketDescriptor } from '@/screens/PerpsPro/model/market';

import type { PerpsProHistoryMarket, PerpsProHistoryRow } from '../types';

const fallbackDisplayBase = (coin: string) => {
  if (!coin.includes(':')) {
    return coin;
  }
  return coin.split(':')[1] || coin;
};

export const resolvePerpsProHistoryMarket = (
  coin: string,
  marketDataMap: Readonly<Record<string, MarketData | undefined>>,
): PerpsProHistoryMarket => {
  const marketData = marketDataMap[coin];
  if (!marketData) {
    const displayBase = fallbackDisplayBase(coin);
    return {
      coin,
      displayBase,
      displayPair: `${displayBase}USDC`,
      logoUrl: null,
      pxDecimals: null,
      quoteAsset: 'USDC',
      sourceTag: coin.includes(':') ? coin.split(':')[0] || null : null,
      szDecimals: null,
    };
  }

  const descriptor = buildPerpsProMarketDescriptor(marketData);
  return {
    coin,
    displayBase: descriptor.displayBase,
    displayPair: descriptor.displayPair,
    logoUrl: marketData.logoUrl || null,
    pxDecimals: marketData.pxDecimals,
    quoteAsset: descriptor.quoteAsset,
    sourceTag: descriptor.sourceTag,
    szDecimals: marketData.szDecimals,
  };
};

export const sortPerpsProHistoryRows = <Row extends PerpsProHistoryRow>(
  rows: readonly Row[],
): Row[] =>
  [...rows].sort(
    (left, right) =>
      right.time - left.time || left.key.localeCompare(right.key),
  );

export const mergePerpsProHistoryRows = <Row extends PerpsProHistoryRow>(
  incoming: readonly Row[],
  existing: readonly Row[],
  limit: number,
): Row[] => {
  const rowsByKey = new Map<string, Row>();
  existing.forEach(row => rowsByKey.set(row.key, row));
  incoming.forEach(row => rowsByKey.set(row.key, row));
  return sortPerpsProHistoryRows([...rowsByKey.values()]).slice(0, limit);
};
