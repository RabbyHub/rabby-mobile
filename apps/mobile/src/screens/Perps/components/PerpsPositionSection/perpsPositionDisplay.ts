import { sortBy } from 'lodash';
import type {
  MarketData,
  PerpsState,
  PositionAndOpenOrder,
} from '@/hooks/perps/usePerpsStore';

// Exactly the market fields consumed by the position card, its coin label,
// and liquidation-distance tag. Position and order data remain complete.
export type PerpsPositionMarketDisplay = Pick<
  MarketData,
  'name' | 'displayName' | 'quoteAsset' | 'logoUrl' | 'markPx'
>;

/** Per-row projection: unrelated markets/quote fields do not publish to React. */
export function createPerpsPositionMarketSelector(coin: string) {
  let previous: PerpsPositionMarketDisplay | undefined;
  return (
    state: Pick<PerpsState, 'marketDataMap'>,
  ): PerpsPositionMarketDisplay | undefined => {
    const market = state.marketDataMap[coin];
    if (!market) {
      // Absence is significant: the card must not show a risk tag without
      // market data. Do not replace this with an all-empty market object.
      previous = undefined;
      return previous;
    }
    if (
      previous &&
      previous.name === market.name &&
      previous.displayName === market.displayName &&
      previous.quoteAsset === market.quoteAsset &&
      previous.logoUrl === market.logoUrl &&
      previous.markPx === market.markPx
    ) {
      return previous;
    }
    previous = {
      name: market.name,
      displayName: market.displayName,
      quoteAsset: market.quoteAsset,
      logoUrl: market.logoUrl,
      markPx: market.markPx,
    };
    return previous;
  };
}

export function getPerpsPositionRows(rows?: PositionAndOpenOrder[]) {
  const occurrences = new Map<string, number>();
  // Preserve the original stable sort, complete rows and source order for
  // equal margin. Canonical coin includes the DEX prefix; duplicate entries
  // remain distinct rather than being deduplicated by a React key.
  return sortBy(rows || [], row => -row.position.marginUsed).map(row => {
    const coin = row.position.coin;
    const occurrence = occurrences.get(coin) || 0;
    occurrences.set(coin, occurrence + 1);
    return { key: JSON.stringify([coin, occurrence]), row };
  });
}
