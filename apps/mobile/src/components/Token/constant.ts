import { TokenItemMaybeWithOwner } from '@/databases/hooks/token';

export const SCAM_TOKEN_HAEDER_ID = 'scam_token_header';
export const SCAM_TOKEN_HEADER_DATA: TokenItemMaybeWithOwner = {
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
};
