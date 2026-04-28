import type {
  PortfolioItem,
  TokenMarketTokenRelatedItem,
} from '@rabby-wallet/rabby-api/dist/types';

export type TokenDisplayMode = 'byAddress' | 'byAsset' | 'bySymbol';

export interface Token {
  address: string;
  chain: string;
}

export type IManageToken = {
  chainId: string;
  tokenId: string;
};

export type IManageNft = {
  id: string;
  chain: string;
};

export type IDefiOrToken = {
  id: string;
  chainid: string;
  type: 'token' | 'defi';
};

export type ITokenSetting = {
  pinedQueue?: IManageToken[];
  foldTokens?: IManageToken[];
  unfoldTokens?: IManageToken[];
  includeDefiAndTokens?: IDefiOrToken[];
  excludeDefiAndTokens?: IDefiOrToken[];
  foldNfts?: IManageNft[];
  unfoldNfts?: IManageNft[];
  foldDefis?: string[];
  unFoldDefis?: string[];
};

export interface ITokenManageSettingMap {
  [address: string]: {
    /** @deprecated will be migrated to store.pinedQueue */
    pinedQueue?: ITokenSetting['pinedQueue'];
    /** @deprecated will be migrated to store.foldTokens */
    foldTokens?: ITokenSetting['foldTokens'];
    /** @deprecated will be migrated to store.unfoldTokens */
    unfoldTokens?: ITokenSetting['unfoldTokens'];
    /** @deprecated will be migrated to store.includeDefiAndTokens */
    includeDefiAndTokens?: ITokenSetting['includeDefiAndTokens'];
    /** @deprecated will be migrated to store.excludeDefiAndTokens */
    excludeDefiAndTokens?: ITokenSetting['excludeDefiAndTokens'];
  };
}

export interface ITokenItem {
  amount: number;
  chain: string;
  decimals: number;
  display_symbol: string | null;
  id: string;
  is_core: boolean | null;
  is_verified: boolean | null;
  is_wallet: boolean;
  logo_url: string;
  name: string;
  optimized_symbol: string;
  price: number;
  symbol: string;
  usd_value: number;
  owner_addr: string;
  raw_amount?: string;
  price_24h_change?: number | null;
  cex_ids: string[];
  time_at: number;
  credit_score?: number;
  is_suspicious?: boolean;
  is_scam?: boolean;
  low_credit_score?: boolean;
  fdv?: number | null;
  is_infinity?: boolean;
  content_type?: 'image' | 'image_url' | 'video_url' | 'audio_url';
  content?: string;
  inner_id?: string;
  raw_amount_hex_str?: string;
  isPin?: boolean;
  trade_volume_level?: 'low' | 'middle' | 'high';
  support_market_data?: boolean;
  protocol_id?: string;
  launchpad?: TokenMarketTokenRelatedItem | null;
  asset?: TokenMarketTokenRelatedItem | null;
  market_status?: string;
}

export type TokenAssetsResult = {
  unFoldTokens: ITokenItem[];
  foldTokens: ITokenItem[];
  scamTokens: ITokenItem[];
  hasFoldTokens: boolean;
};

export interface IProtocolItem {
  id: string;
  name: string;
  logo?: string;
  chain?: string;
  netWorth: number;
  site_url?: string;
  owner_addr: string;
  _portfolios: IProtocolPortfolio[];
}

export interface IProtocolPortfolio {
  id: string;
  name?: string;
  _sumTokenRealUsdValue: number;
  netWorth: number;
  _originPortfolio: PortfolioItem;
}

export type ICacheProtocolItem = {
  fold: IProtocolItem[];
  unFold: IProtocolItem[];
};
