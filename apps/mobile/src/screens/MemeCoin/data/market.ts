import type { TokenMarketTokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { compareText, tokenKey } from '../engine/keys';
import type { MemeHolding, MemeMarketItem } from './types';

export const toMemeMarketItem = (
  item: TokenMarketTokenItem,
): MemeMarketItem => ({
  id: item.id,
  chain: item.chain,
  symbol: item.display_symbol || item.symbol,
  logoUrl: item.logo_url,
  price: item.price || 0,
  marketCap: item.fdv || 0,
  change24h: item.price_24h_change || 0,
});

export const filterBySymbol = <T>(
  list: T[],
  keyword: string,
  getSymbol: (item: T) => string,
): T[] => {
  const q = keyword.trim().toLowerCase();
  if (!q) {
    return list;
  }
  return list.filter(item => getSymbol(item).toLowerCase().includes(q));
};

export type WalletTokenLike = {
  id: string;
  chain: string;
  amount: number;
  price: number;
  usd_value?: number;
};

export const deriveMemeHoldings = (
  walletTokens: WalletTokenLike[],
  market: MemeMarketItem[],
) => {
  const byKey = new Map(market.map(m => [tokenKey(m), m]));
  const holdings: MemeHolding[] = [];
  for (const token of walletTokens) {
    const meme = byKey.get(tokenKey(token));
    if (meme && token.amount > 0) {
      holdings.push({
        meme,
        amount: token.amount,
        valueUsd: token.usd_value ?? token.amount * (token.price || 0),
      });
    }
  }
  holdings.sort(
    (a, b) =>
      b.valueUsd - a.valueUsd ||
      compareText(tokenKey(a.meme), tokenKey(b.meme)),
  );
  return {
    holdings,
    totalUsd: holdings.reduce((sum, h) => sum + h.valueUsd, 0),
  };
};
