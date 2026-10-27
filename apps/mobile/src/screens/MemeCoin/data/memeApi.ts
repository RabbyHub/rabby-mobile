import { openapi } from '@/core/request';

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

export type MemeTokenListParams = {
  symbol?: string;
  page?: number;
  pageSize?: number;
};

export const fetchMemeTokenList = ({
  symbol,
  page,
  pageSize,
}: MemeTokenListParams): Promise<MemeTokenListResult> =>
  openapi.getMemeTokenList({ symbol, page, page_size: pageSize });

export const fetchMemeUserTokenList = (
  address: string,
): Promise<MemeUserTokenListResult> => openapi.getMemeUserTokenList(address);
