import type { TokenMarketTokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { openapi } from '@/core/request';
import useTokenList from '@/store/tokens';
import { compareText, tokenKey } from '../engine/keys';
import { filterBySymbolPrefix } from './market';
import type {
  MemeTokenListParams,
  MemeTokenListResult,
  MemeUserTokenListResult,
  RawMemePosition,
  RawMemeToken,
} from './memeApi';

// Temporary source until the App endpoint ships (spec U9): top 200 memes by fdv
// from the market API, shaped like meme_coin.token_list / user.token_list.
const SOURCE_PAGE_SIZE = 100;
const SOURCE_MAX_PAGES = 2;
const CACHE_TTL_MS = 60_000;
const DEFAULT_PAGE_SIZE = 100;

export type WalletTokenLike = {
  id: string;
  chain: string;
  amount: number;
  price: number;
  usd_value?: number;
};

const rawKey = (token: Pick<RawMemeToken, 'chain_id' | 'id'>) =>
  tokenKey({ chain: token.chain_id, id: token.id });

export const toRawMemeToken = (item: TokenMarketTokenItem): RawMemeToken => ({
  chain_id: item.chain,
  id: item.id,
  symbol: item.display_symbol || item.symbol,
  name: item.name,
  // the market API has no decimals; nothing in the UI reads them
  decimals: 18,
  logo_url: item.logo_url || null,
  price: item.price,
  price_24h_change: item.price_24h_change ?? null,
  fdv_usd: item.fdv || 0,
});

export const pageMemeTokens = (
  all: RawMemeToken[],
  { symbol, page = 1, pageSize = DEFAULT_PAGE_SIZE }: MemeTokenListParams,
): MemeTokenListResult => {
  const matched = filterBySymbolPrefix(all, symbol || '', t => t.symbol);
  const start = (page - 1) * pageSize;
  return {
    page,
    page_size: pageSize,
    has_more: start + pageSize < matched.length,
    tokens: matched.slice(start, start + pageSize),
  };
};

export const toRawPositions = (
  walletTokens: WalletTokenLike[],
  tokens: RawMemeToken[],
  owner: string,
): MemeUserTokenListResult => {
  const byKey = new Map(tokens.map(t => [rawKey(t), t]));
  const positions: RawMemePosition[] = [];
  for (const token of walletTokens) {
    const meme = byKey.get(tokenKey(token));
    if (meme && token.amount > 0) {
      positions.push({
        chain_id: meme.chain_id,
        id: meme.id,
        symbol: meme.symbol,
        name: meme.name,
        decimals: meme.decimals,
        logo_url: meme.logo_url,
        price: meme.price,
        price_24h_change: meme.price_24h_change,
        amount: token.amount,
        usd_value: token.usd_value ?? token.amount * (token.price || 0),
      });
    }
  }
  positions.sort(
    (a, b) => b.usd_value - a.usd_value || compareText(rawKey(a), rawKey(b)),
  );
  return {
    owner: owner.toLowerCase(),
    total_usd_value: positions.reduce((sum, p) => sum + p.usd_value, 0),
    positions,
  };
};

const fetchSourceTokens = async (): Promise<RawMemeToken[]> => {
  const result: RawMemeToken[] = [];
  const seen = new Set<string>();
  let cursor = '';
  for (let page = 0; page < SOURCE_MAX_PAGES; page++) {
    const res = await openapi.getTokenMarketTokenList({
      category_id: 'meme',
      order_by: 'fdv',
      order: 'desc',
      limit: SOURCE_PAGE_SIZE,
      cursor,
    });
    for (const item of res.data_list) {
      const token = toRawMemeToken(item);
      const key = rawKey(token);
      if (!seen.has(key)) {
        seen.add(key);
        result.push(token);
      }
    }
    if (!res.pagination?.has_next || !res.pagination.next_cursor) {
      break;
    }
    cursor = res.pagination.next_cursor;
  }
  return result;
};

let cache: { at: number; tokens: RawMemeToken[] } | null = null;
let inflight: Promise<RawMemeToken[]> | null = null;

export const loadTemporaryMemeTokens = (): Promise<RawMemeToken[]> => {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return Promise.resolve(cache.tokens);
  }
  if (!inflight) {
    inflight = fetchSourceTokens()
      .then(tokens => {
        cache = { at: Date.now(), tokens };
        return tokens;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
};

export const temporaryFetchMemeTokenList = async (
  params: MemeTokenListParams,
): Promise<MemeTokenListResult> =>
  pageMemeTokens(await loadTemporaryMemeTokens(), params);

export const temporaryFetchMemeUserTokenList = async (
  address: string,
): Promise<MemeUserTokenListResult> => {
  await useTokenList.getState().getTokenList(address, true);
  const walletTokens =
    useTokenList.getState().tokenListMap[address.toLowerCase()] || [];
  return toRawPositions(walletTokens, await loadTemporaryMemeTokens(), address);
};
