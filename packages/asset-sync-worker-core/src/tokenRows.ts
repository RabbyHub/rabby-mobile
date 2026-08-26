/* eslint-disable jsdoc/require-param, jsdoc/require-returns */

export const TOKEN_CACHE_TABLE_NAME = 'rabby_cache_tokenitem_20260816';
export const EMPTY_TOKEN_ITEM_ID = 'rabby-empty-token-item-id';
export const LEGACY_REAL_STORAGE_RATIO = 18;

export const TOKEN_CACHE_COLUMNS = [
  '_local_created_at',
  '_local_updated_at',
  '_db_id',
  'owner_addr',
  'projection_resource_id',
  'content_type',
  'content',
  'inner_id',
  'amount',
  'chain',
  'decimals',
  'display_symbol',
  'id',
  'is_core',
  'is_verified',
  'is_wallet',
  'is_scam',
  'is_infinity',
  'is_suspicious',
  'logo_url',
  'name',
  'optimized_symbol',
  'price',
  'symbol',
  'time_at',
  'usd_value',
  'credit_score',
  'protocol_id',
  'launchpad',
  'asset',
  'market_status',
  'raw_amount',
  'raw_amount_hex_str',
  'price_24h_change',
  'low_credit_score',
  'fdv',
  'value_24h_change',
  'cex_ids',
] as const;

export type TokenCacheColumn = (typeof TOKEN_CACHE_COLUMNS)[number];
export type TokenCacheScalar = string | number | boolean | null;
export type TokenCacheRow = Record<TokenCacheColumn, TokenCacheScalar>;

export type WorkerTokenInput = {
  content_type?: string | null;
  content?: string | null;
  inner_id?: string | null;
  amount?: number | string | null;
  chain?: string | null;
  decimals?: number | null;
  display_symbol?: string | null;
  id?: string | null;
  is_core?: boolean | null;
  is_verified?: boolean | null;
  is_wallet?: boolean | null;
  is_scam?: boolean | null;
  is_infinity?: boolean | null;
  is_suspicious?: boolean | null;
  logo_url?: string | null;
  name?: string | null;
  optimized_symbol?: string | null;
  price?: number | string | null;
  symbol?: string | null;
  time_at?: number | null;
  usd_value?: number | null;
  credit_score?: number | null;
  protocol_id?: string | null;
  launchpad?: unknown;
  asset?: unknown;
  market_status?: string | null;
  raw_amount?: number | string | null;
  raw_amount_hex_str?: string | null;
  price_24h_change?: number | null;
  low_credit_score?: boolean | null;
  fdv?: number | null;
  identity?: {
    fdv?: number | null;
  } | null;
  value_24h_change?: string | null;
  cex_ids?: string[] | null;
};

/** Decide whether a remote token belongs in the local asset snapshot. */
export function isPersistableWorkerToken(input: WorkerTokenInput) {
  return input.is_verified !== false && !input.is_suspicious;
}

/** Normalize an API numeric scalar without allowing non-finite values. */
function numberValue(value: number | string | null | undefined): number {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
}

/** Encode structured optional columns for SQLite persistence. */
function nullableJson(value: unknown): string | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  return typeof value === 'string' ? value : JSON.stringify(value);
}

/** Build the cache table's existing stable primary key. */
function makeDbId(
  ownerAddress: string,
  tokenId: string,
  chainId: string,
  innerId: string,
) {
  return [ownerAddress, tokenId, chainId, innerId].filter(Boolean).join('-');
}

/** Build the normalized projection identity used by current readers. */
function makeProjectionResourceId(
  ownerAddress: string,
  chainId: string,
  tokenId: string,
) {
  return [ownerAddress, chainId, tokenId]
    .map(value => value.toLowerCase())
    .join(':');
}

/** Build the existing empty-snapshot sentinel row. */
export function makeEmptyTokenInput(): WorkerTokenInput {
  return {
    amount: 0,
    chain: EMPTY_TOKEN_ITEM_ID,
    decimals: 0,
    display_symbol: EMPTY_TOKEN_ITEM_ID,
    id: EMPTY_TOKEN_ITEM_ID,
    is_core: false,
    is_verified: false,
    is_wallet: false,
    logo_url: EMPTY_TOKEN_ITEM_ID,
    name: EMPTY_TOKEN_ITEM_ID,
    optimized_symbol: EMPTY_TOKEN_ITEM_ID,
    price: 0,
    symbol: EMPTY_TOKEN_ITEM_ID,
    time_at: 0,
  };
}

/** Convert one API token into the current cache-table representation. */
export function makeTokenCacheRow(
  rawOwnerAddress: string,
  input: WorkerTokenInput,
  syncTimestamp: number,
): TokenCacheRow {
  const ownerAddress = rawOwnerAddress.toLowerCase();
  const chain = input.chain ?? '';
  const id = input.id ?? '';
  const innerId = input.inner_id ?? '';
  const amount = numberValue(input.amount);
  const price = numberValue(input.price);

  return {
    _local_created_at: syncTimestamp,
    _local_updated_at: syncTimestamp,
    _db_id: makeDbId(ownerAddress, id, chain, innerId),
    owner_addr: ownerAddress,
    projection_resource_id: makeProjectionResourceId(ownerAddress, chain, id),
    content_type: input.content_type ?? '',
    content: input.content ?? '',
    inner_id: innerId,
    amount: amount * LEGACY_REAL_STORAGE_RATIO,
    chain,
    decimals: input.decimals ?? 18,
    display_symbol: input.display_symbol ?? '',
    id,
    is_core: input.is_core ?? null,
    is_verified: input.is_verified ?? null,
    is_wallet: input.is_wallet ?? false,
    is_scam: input.is_scam ?? false,
    is_infinity: input.is_infinity ?? false,
    is_suspicious: input.is_suspicious ?? false,
    logo_url: input.logo_url ?? '',
    name: input.name ?? '',
    optimized_symbol: input.optimized_symbol ?? '',
    price: price * LEGACY_REAL_STORAGE_RATIO,
    symbol: input.symbol ?? '',
    time_at: input.time_at ?? 0,
    usd_value: price * amount,
    credit_score: input.credit_score ?? 0,
    protocol_id: input.protocol_id ?? '',
    launchpad: nullableJson(input.launchpad),
    asset: nullableJson(input.asset),
    market_status: input.market_status ?? '',
    raw_amount:
      input.raw_amount === null || input.raw_amount === undefined
        ? ''
        : String(input.raw_amount),
    raw_amount_hex_str: input.raw_amount_hex_str ?? '',
    price_24h_change: input.price_24h_change ?? null,
    low_credit_score: input.low_credit_score ?? false,
    fdv: input.identity?.fdv || input.fdv || 0,
    value_24h_change: input.value_24h_change ?? '1',
    cex_ids: JSON.stringify(input.cex_ids ?? []),
  };
}

/** Filter and normalize one complete address token snapshot. */
export function makeTokenCacheRows(
  ownerAddress: string,
  tokens: WorkerTokenInput[],
  syncTimestamp: number,
) {
  const filteredTokens = tokens.filter(isPersistableWorkerToken);
  const normalizedTokens = filteredTokens.length
    ? filteredTokens
    : [makeEmptyTokenInput()];
  return normalizedTokens.map(token =>
    makeTokenCacheRow(ownerAddress, token, syncTimestamp),
  );
}
