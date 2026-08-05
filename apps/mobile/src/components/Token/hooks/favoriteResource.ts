import type { TokenItem } from '@rabby-wallet/rabby-api/dist/types';

import type { IManageToken } from '@/core/startupServices/preference';
import type { ITokenItem } from '@/store/tokens';

export type FavoriteTokenCache = {
  ownerKey: string;
  tokens: Map<string, ITokenItem>;
};

type LoadFavoriteTokenResourceOptions = {
  address: string;
  cache: FavoriteTokenCache;
  force: boolean;
  pinnedTokens: readonly IManageToken[];
  loadBatch: (keys: string[], address: string) => Promise<TokenItem[]>;
};

export const EMPTY_FAVORITE_TOKENS: ITokenItem[] = [];

export const normalizeFavoriteTokenPart = (value?: string) =>
  value?.toLowerCase() || '';

export const makeFavoriteTokenKey = (token: {
  chainId?: string;
  tokenId?: string;
}) =>
  `${normalizeFavoriteTokenPart(token.chainId)}:${normalizeFavoriteTokenPart(
    token.tokenId,
  )}`;

const makeTokenItemKey = (token: Pick<TokenItem, 'chain' | 'id'>) =>
  `${normalizeFavoriteTokenPart(token.chain)}:${normalizeFavoriteTokenPart(
    token.id,
  )}`;

export const createFavoriteTokenCache = (): FavoriteTokenCache => ({
  ownerKey: '',
  tokens: new Map(),
});

export const getScopedPinnedTokens = (
  pinnedTokens: readonly IManageToken[],
  chainId?: string,
) => {
  const normalizedChainId = normalizeFavoriteTokenPart(chainId);
  const seen = new Set<string>();

  return pinnedTokens.filter(token => {
    if (!token.chainId || !token.tokenId) {
      return false;
    }
    if (
      normalizedChainId &&
      normalizeFavoriteTokenPart(token.chainId) !== normalizedChainId
    ) {
      return false;
    }

    const key = makeFavoriteTokenKey(token);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

export const makeFavoriteTokenResourceKey = (
  address: string | undefined,
  pinnedTokens: readonly IManageToken[],
) =>
  JSON.stringify([
    normalizeFavoriteTokenPart(address),
    pinnedTokens.map(makeFavoriteTokenKey),
  ]);

const convertToITokenItem = (
  token: TokenItem,
  ownerAddr: string,
): ITokenItem => ({
  amount: token.amount || 0,
  chain: token.chain,
  decimals: token.decimals,
  display_symbol: token.display_symbol || null,
  id: token.id,
  is_core: token.is_core || false,
  is_verified: token.is_verified || false,
  is_wallet: token.is_wallet || false,
  logo_url: token.logo_url || '',
  name: token.name || '',
  optimized_symbol: token.optimized_symbol || '',
  price: token.price || 0,
  symbol: token.symbol || '',
  usd_value: (token.price || 0) * (token.amount || 0),
  owner_addr: ownerAddr,
  raw_amount: token.raw_amount,
  price_24h_change: token.price_24h_change ?? null,
  cex_ids: token.cex_ids || [],
  time_at: token.time_at || 0,
  credit_score: token.credit_score,
  is_suspicious: token.is_suspicious,
  is_scam: token.is_scam,
  low_credit_score: token.low_credit_score,
  fdv: token.fdv,
  is_infinity: token.is_infinity,
  content_type: token.content_type,
  content: token.content,
  inner_id: token.inner_id,
  raw_amount_hex_str: token.raw_amount_hex_str,
  isPin: (token as any).isPin,
  trade_volume_level: (token as any).trade_volume_level,
  support_market_data: token.support_market_data,
  protocol_id: token.protocol_id,
});

const chunkArray = (
  values: readonly IManageToken[],
  size: number,
): IManageToken[][] => {
  const chunks: IManageToken[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
};

export const loadFavoriteTokenResource = async ({
  address,
  cache,
  force,
  pinnedTokens,
  loadBatch,
}: LoadFavoriteTokenResourceOptions) => {
  const ownerKey = normalizeFavoriteTokenPart(address);
  const currentTokens =
    cache.ownerKey === ownerKey ? cache.tokens : new Map<string, ITokenItem>();
  const nextTokens = force
    ? new Map<string, ITokenItem>()
    : new Map(currentTokens);
  const tokensToFetch = force
    ? pinnedTokens
    : pinnedTokens.filter(
        token => !nextTokens.has(makeFavoriteTokenKey(token)),
      );

  for (const batch of chunkArray(tokensToFetch, 50)) {
    const batchKeys = batch.map(token => `${token.chainId}:${token.tokenId}`);
    const batchDetails = await loadBatch(batchKeys, address);
    batchDetails.forEach(token => {
      nextTokens.set(
        makeTokenItemKey(token),
        convertToITokenItem(token, address),
      );
    });
  }

  const data = pinnedTokens
    .map(token => nextTokens.get(makeFavoriteTokenKey(token)))
    .filter((token): token is ITokenItem => Boolean(token));

  return {
    cache: { ownerKey, tokens: nextTokens },
    data,
  };
};
