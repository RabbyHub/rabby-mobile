import type { TDexQuoteData } from './quote';

export function mergeSwapQuoteBatch(
  current: TDexQuoteData[],
  updates: TDexQuoteData[],
) {
  if (!updates.length) {
    return current;
  }

  const updateMap = new Map(
    updates.map(quote => [
      quote.name,
      { ...quote, loading: false } satisfies TDexQuoteData,
    ]),
  );
  const next = current.map(quote => {
    const update = updateMap.get(quote.name);
    if (!update) {
      return quote;
    }
    updateMap.delete(quote.name);
    return update;
  });

  return [...next, ...updateMap.values()];
}
