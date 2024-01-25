interface Tokens {
  id: string;
  decimals: number;
  name: string;
  symbol: string;
  price?: number;
  chain: string;
  balance?: number;
  logo_url?: string;
  is_verified: boolean;
  is_core?: boolean;
  is_swap_hot?: boolean;
  display_symbol?: string;
  optimized_symbol?: string;
  is_custom?: boolean;
  is_wallet?: boolean;
  protocol_id?: string;
  time_at?: number;
  amount?: number;

  // nft
  contract_id?: string;
  inner_id?: string;
  content?: string;
  content_type?: MEDIA_TYPE;
  thumbnail_url?: string;
}

interface Coin {
  id: string;
  amount: number;
  price: number;
  symbol: string;
  logo: string;
  token_uuids: string[];
}
