import { tokenKey } from '../engine/keys';
import type { RawMemePosition, RawMemeToken } from './memeApi';
import type { MemeHolding, MemeMarketItem, MemeToken } from './types';

const toMemeToken = (raw: Omit<RawMemeToken, 'fdv_usd'>): MemeToken => ({
  id: raw.id,
  chain: raw.chain_id,
  symbol: raw.symbol,
  logoUrl: raw.logo_url ?? '',
  price: raw.price,
  change24h: raw.price_24h_change,
});

export const toMemeMarketItem = (raw: RawMemeToken): MemeMarketItem => ({
  ...toMemeToken(raw),
  marketCap: raw.fdv_usd,
});

export const toMemeHolding = (raw: RawMemePosition): MemeHolding => ({
  meme: toMemeToken(raw),
  amount: raw.amount,
  valueUsd: raw.usd_value,
});

export const filterBySymbolPrefix = <T>(
  list: T[],
  keyword: string,
  getSymbol: (item: T) => string,
): T[] => {
  const q = keyword.trim().toLowerCase();
  if (!q) {
    return list;
  }
  return list.filter(item => getSymbol(item).toLowerCase().startsWith(q));
};

export const appendByTokenKey = <T extends MemeToken>(
  list: T[],
  more: T[],
): T[] => {
  const seen = new Set(list.map(item => tokenKey(item)));
  const added = more.filter(item => {
    const key = tokenKey(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
  return added.length ? [...list, ...added] : list;
};
