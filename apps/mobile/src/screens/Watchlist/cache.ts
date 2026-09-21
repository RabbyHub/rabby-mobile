import { appMMKV } from '@/core/storage/mmkvInstances';
import { TokenDetailWithPriceCurve } from '@rabby-wallet/rabby-api/dist/types';

const WATCHLIST_TOP_CACHE_KEY = '@watchlist.topTokenList';
const WATCHLIST_TOP_CACHE_LIMIT = 20;

type WatchlistTokenCacheItem = Pick<
  TokenDetailWithPriceCurve,
  | 'id'
  | 'chain'
  | 'logo_url'
  | 'optimized_symbol'
  | 'display_symbol'
  | 'symbol'
  | 'is_verified'
  | 'is_core'
  | 'protocol_id'
  | 'is_suspicious'
  | 'price'
  | 'price_24h_change'
  | 'market_status'
  | 'amount'
  | 'decimals'
  | 'name'
  | 'fdv'
> & {
  launchpad?: Pick<NonNullable<TokenDetailWithPriceCurve['launchpad']>, 'logo'>;
  asset?: Pick<
    NonNullable<TokenDetailWithPriceCurve['asset']>,
    'logo' | 'name'
  >;
  identity?: Pick<NonNullable<TokenDetailWithPriceCurve['identity']>, 'fdv'>;
};

type WatchlistTopCachePayload = {
  list: WatchlistTokenCacheItem[];
  updatedAt: number;
};

const formatWatchlistTokenForCache = (
  token: TokenDetailWithPriceCurve,
): WatchlistTokenCacheItem => ({
  id: token.id,
  chain: token.chain,
  logo_url: token.logo_url,
  optimized_symbol: token.optimized_symbol,
  display_symbol: token.display_symbol,
  symbol: token.symbol,
  launchpad: token.launchpad?.logo
    ? {
        logo: token.launchpad.logo,
      }
    : undefined,
  is_verified: token.is_verified,
  is_core: token.is_core,
  protocol_id: token.protocol_id,
  is_suspicious: token.is_suspicious,
  asset: token.asset
    ? {
        logo: token.asset.logo,
        name: token.asset.name,
      }
    : undefined,
  identity: token.identity
    ? {
        fdv: token.identity.fdv,
      }
    : undefined,
  price: token.price,
  price_24h_change: token.price_24h_change,
  market_status: token.market_status,
  amount: token.amount,
  decimals: token.decimals,
  name: token.name,
  fdv: token.fdv,
});

export const getWatchlistTopCache = (): TokenDetailWithPriceCurve[] => {
  const raw = appMMKV.getString(WATCHLIST_TOP_CACHE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const cache = JSON.parse(raw) as WatchlistTopCachePayload;
    if (!Array.isArray(cache.list)) {
      return [];
    }

    return cache.list.slice(
      0,
      WATCHLIST_TOP_CACHE_LIMIT,
    ) as TokenDetailWithPriceCurve[];
  } catch (error) {
    console.error('getWatchlistTopCache error', error);
    return [];
  }
};

export const setWatchlistTopCache = (tokens: TokenDetailWithPriceCurve[]) => {
  const list = tokens
    .slice(0, WATCHLIST_TOP_CACHE_LIMIT)
    .map(formatWatchlistTokenForCache);

  appMMKV.set(
    WATCHLIST_TOP_CACHE_KEY,
    JSON.stringify({
      list,
      updatedAt: Date.now(),
    } satisfies WatchlistTopCachePayload),
  );
};
