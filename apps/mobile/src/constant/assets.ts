import {
  ComplexProtocol,
  NFTItem,
  TokenItem,
} from '@rabby-wallet/rabby-api/dist/types';

export const EMPTY_NFT_ITEM_ID = 'rabby-empty-nft-item-id';
export const EMPTY_NFT_ITEM: NFTItem = {
  chain: EMPTY_NFT_ITEM_ID,
  id: EMPTY_NFT_ITEM_ID,
  contract_id: EMPTY_NFT_ITEM_ID,
  inner_id: EMPTY_NFT_ITEM_ID,
  name: EMPTY_NFT_ITEM_ID,
  contract_name: EMPTY_NFT_ITEM_ID,
  description: EMPTY_NFT_ITEM_ID,
  amount: 0,
  content_type: 'image_url',
  content: EMPTY_NFT_ITEM_ID,
  detail_url: EMPTY_NFT_ITEM_ID,
  is_erc721: false,
};
export const EMPTY_PROTOCOL_ITEM_ID = 'rabby-empty-protocol-item-id';
export const EMPTY_PROTOCOL_ITEM: ComplexProtocol = {
  id: EMPTY_PROTOCOL_ITEM_ID,
  chain: EMPTY_PROTOCOL_ITEM_ID,
  name: EMPTY_PROTOCOL_ITEM_ID,
  site_url: EMPTY_PROTOCOL_ITEM_ID,
  logo_url: EMPTY_PROTOCOL_ITEM_ID,
  has_supported_portfolio: false,
  tvl: 0,
  portfolio_item_list: [],
};
export const EMPTY_TOKEN_ITEM_ID = 'rabby-empty-token-item-id';
export const EMPTY_TOKEN_ITEM: TokenItem = {
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
