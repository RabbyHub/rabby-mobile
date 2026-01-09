import { ITokenItem } from '@/store/tokens';

export const SCAM_TOKEN_HAEDER_ID = 'scam_token_header';
export const SCAM_TOKEN_HEADER_DATA: ITokenItem = {
  id: SCAM_TOKEN_HAEDER_ID,
  chain: '',
  amount: 0,
  price: 0,
  decimals: 0,
  display_symbol: null,
  is_core: false,
  is_verified: false,
  is_wallet: false,
  is_scam: false,
  is_suspicious: false,
  logo_url: '',
  name: '',
  optimized_symbol: '',
  symbol: '',
  time_at: 0,
  price_24h_change: 0,
  owner_addr: '',
  usd_value: 0,
  cex_ids: [],
};
