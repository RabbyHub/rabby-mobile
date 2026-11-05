export type RawMemeToken = {
  /** currently always 'hood' (= Rabby chain serverId 'hood') */
  chain_id: string;
  /** token contract address */
  id: string;
  symbol: string;
  name: string;
  decimals: number;
  logo_url: string | null;
  price: number;
  /** ratio: 0.26 = +26%; null when there is no price 24h ago */
  price_24h_change: number | null;
  fdv_usd: number;
};

export type MemeTokenListResult = {
  page: number;
  page_size: number;
  has_more: boolean;
  tokens: RawMemeToken[];
};

export type RawMemePosition = Omit<RawMemeToken, 'fdv_usd'> & {
  amount: number;
  usd_value: number;
};

export type MemeUserTokenListResult = {
  owner: string;
  total_usd_value: number;
  positions: RawMemePosition[];
};

export type RawMemePnlPosition = {
  chain_id: string;
  id: string;
  /** null when the token was held 24h ago but had no price then */
  pnl_24h_usd_value: number | null;
  cost_usd_value: number;
  pnl_all_usd_value: number;
};

export type RawMemePnlPoint = {
  /** UTC RFC3339 */
  time_at: string;
  pnl_usd_value: number;
};

export type MemeUserPnlResult = {
  owner: string;
  total_pnl_24h_usd_value: number;
  total_cost_usd_value: number;
  total_pnl_all_usd_value: number;
  /** a held token missing here has no known cost, so no P&L */
  positions: RawMemePnlPosition[];
  curve_24h: RawMemePnlPoint[];
  curve_all: RawMemePnlPoint[];
};

export type MemeTokenListParams = {
  symbol?: string;
  page?: number;
  pageSize?: number;
};
