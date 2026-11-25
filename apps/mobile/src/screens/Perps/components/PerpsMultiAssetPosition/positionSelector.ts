import type { MarketData, PerpsState } from '@/hooks/perps/usePerpsStore';

type PositionMarketMetadata = Pick<
  MarketData,
  'quoteAsset' | 'logoUrl' | 'displayName'
>;

export type HomePerpsPositionSource = Pick<
  PerpsState,
  'clearinghouseStateMap' | 'marketDataMap'
>;

export type HomePerpsPositionSnapshot = {
  clearinghouseStateMap: HomePerpsPositionSource['clearinghouseStateMap'];
  marketMetadataByCoin: Record<string, PositionMarketMetadata | undefined>;
};

export function selectHomePerpsPositions(
  state: HomePerpsPositionSource,
): HomePerpsPositionSnapshot {
  const marketMetadataByCoin: HomePerpsPositionSnapshot['marketMetadataByCoin'] =
    {};

  Object.values(state.clearinghouseStateMap).forEach(accountState => {
    accountState?.assetPositions?.forEach(({ position }) => {
      const market = state.marketDataMap[position.coin];
      marketMetadataByCoin[position.coin] = market
        ? {
            quoteAsset: market.quoteAsset,
            logoUrl: market.logoUrl,
            displayName: market.displayName,
          }
        : undefined;
    });
  });

  return {
    clearinghouseStateMap: state.clearinghouseStateMap,
    marketMetadataByCoin,
  };
}

export function areHomePerpsPositionsEqual(
  previous: HomePerpsPositionSnapshot,
  next: HomePerpsPositionSnapshot,
) {
  // Position snapshots drive PnL, sorting and the open risk popup. Never
  // suppress them; only market ticker fields are irrelevant to these cards.
  if (previous.clearinghouseStateMap !== next.clearinghouseStateMap) {
    return false;
  }

  const coins = Object.keys(previous.marketMetadataByCoin);
  if (coins.length !== Object.keys(next.marketMetadataByCoin).length) {
    return false;
  }
  return coins.every(coin => {
    const previousMarket = previous.marketMetadataByCoin[coin];
    const nextMarket = next.marketMetadataByCoin[coin];
    return (
      previousMarket?.quoteAsset === nextMarket?.quoteAsset &&
      previousMarket?.logoUrl === nextMarket?.logoUrl &&
      previousMarket?.displayName === nextMarket?.displayName
    );
  });
}
