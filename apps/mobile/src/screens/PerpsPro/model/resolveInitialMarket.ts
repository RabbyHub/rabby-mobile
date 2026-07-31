import type { PerpsProMarket } from './market';

export const resolveInitialPerpsProMarket = ({
  markets,
  navigationMarket,
  sessionMarketKey,
}: {
  markets: PerpsProMarket[];
  navigationMarket?: string;
  sessionMarketKey?: string | null;
}): PerpsProMarket | null => {
  if (navigationMarket) {
    const navigationMatch = markets.find(
      market => market.canonicalCoin === navigationMarket,
    );
    if (navigationMatch) {
      return navigationMatch;
    }
  }
  if (sessionMarketKey) {
    const sessionMatch = markets.find(
      market => market.marketKey === sessionMarketKey,
    );
    if (sessionMatch) {
      return sessionMatch;
    }
  }
  return (
    markets.find(
      market =>
        market.canonicalCoin === 'BTC' && market.marketData.dexId === '',
    ) ??
    markets[0] ??
    null
  );
};
