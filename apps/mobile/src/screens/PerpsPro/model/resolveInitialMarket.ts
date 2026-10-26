import type { PerpsProMarket } from './market';

const normalizeMarketCandidate = (candidate: string) =>
  candidate.trim().toLowerCase();

const getFirstUniqueCandidateMatch = (
  markets: PerpsProMarket[],
  predicate: (market: PerpsProMarket, candidate: string) => boolean,
  candidates: readonly string[],
) => {
  for (const candidate of candidates) {
    const matches = markets.filter(market => predicate(market, candidate));
    if (matches.length === 1) {
      return matches[0];
    }
  }
  return null;
};

export const resolvePerpsProNavigationMarketCandidates = ({
  markets,
  navigationMarketCandidates,
}: {
  markets: PerpsProMarket[];
  navigationMarketCandidates?: readonly string[];
}): PerpsProMarket | null => {
  const candidates = Array.from(
    new Set(
      (navigationMarketCandidates ?? [])
        .map(candidate => candidate.trim())
        .filter(Boolean),
    ),
  );
  if (candidates.length === 0) {
    return null;
  }

  const exactCanonical = getFirstUniqueCandidateMatch(
    markets,
    (market, candidate) => market.canonicalCoin === candidate,
    candidates,
  );
  if (exactCanonical) {
    return exactCanonical;
  }

  const normalizedCandidates = candidates.map(normalizeMarketCandidate);
  const normalizedCanonical = getFirstUniqueCandidateMatch(
    markets,
    (market, candidate) =>
      normalizeMarketCandidate(market.canonicalCoin) === candidate,
    normalizedCandidates,
  );
  if (normalizedCanonical) {
    return normalizedCanonical;
  }

  return getFirstUniqueCandidateMatch(
    markets,
    (market, candidate) =>
      [
        market.displayBase,
        market.displayPair,
        market.marketData.displayName,
        market.marketData.brief,
      ].some(
        value =>
          typeof value === 'string' &&
          normalizeMarketCandidate(value) === candidate,
      ),
    normalizedCandidates,
  );
};

export const resolveInitialPerpsProMarket = ({
  markets,
  navigationMarket,
  navigationMarketCandidates,
  sessionMarketKey,
}: {
  markets: PerpsProMarket[];
  navigationMarket?: string;
  navigationMarketCandidates?: readonly string[];
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
  const navigationCandidateMatch = resolvePerpsProNavigationMarketCandidates({
    markets,
    navigationMarketCandidates,
  });
  if (navigationCandidateMatch) {
    return navigationCandidateMatch;
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
