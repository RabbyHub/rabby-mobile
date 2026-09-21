import type { SelectedBridgeQuote } from '../types';

const getBridgeQuoteKey = (quote: SelectedBridgeQuote) =>
  `${quote.aggregator.id}:${quote.bridge.id}`;

export function mergeBridgeQuoteBatch(
  current: SelectedBridgeQuote[],
  updates: SelectedBridgeQuote[],
) {
  if (!updates.length) {
    return current;
  }

  const updateMap = new Map<string, SelectedBridgeQuote>();
  updates.forEach(quote => {
    updateMap.set(getBridgeQuoteKey(quote), quote);
  });

  return [
    ...current.filter(quote => !updateMap.has(getBridgeQuoteKey(quote))),
    ...updateMap.values(),
  ];
}

export function getBridgeAllowanceRequestKey({
  chainId,
  tokenId,
  spender,
  account,
}: {
  chainId: string;
  tokenId: string;
  spender: string;
  account: string;
}) {
  return [chainId, tokenId, spender, account]
    .map(part => part.toLowerCase())
    .join(':');
}

export function getOrCreateBridgeAllowanceRequest(
  requests: Map<string, Promise<string>>,
  key: string,
  createRequest: () => Promise<string>,
) {
  const existing = requests.get(key);
  if (existing) {
    return existing;
  }

  const request = createRequest();
  requests.set(key, request);
  return request;
}
