import {
  NFTItem,
  PortfolioItem,
  PortfolioItemToken,
  CollectionList,
  WithdrawAction,
} from '@rabby-wallet/rabby-api/dist/types';
import { DisplayedProject } from './utils/project';
import { KeyringAccountWithAlias } from '@/hooks/account';
import { NftItemWithCollection } from './hooks/nft';
// curve
export type ChartLine = {
  value: number;
  netWorth: string;
  timestamp: number;
  change?: string;
  isUp: boolean;
  changePecentage?: string;
};

// portfolios
export interface AbstractProject {
  id: string;
  name: string;
  logo?: string;
  chain?: string;
  netWorth: number;
  site_url?: string;
  _netWorth: string;
  _portfolioDict: Record<string, AbstractPortfolio>;
  _historyPatched?: boolean;
  _portfolios: AbstractPortfolio[];
  _serverUpdatedAt: number;
  netWorthChange: number;
  _netWorthChange: string;
  _netWorthChangePercent: string;
  _intNetworth: string;
  _isExcludeBalance?: boolean;
  _isFold?: boolean;
  _isManualFold?: boolean;
}

export interface AbstractPortfolio {
  id: string;
  name?: string;
  type?: string;
  netWorth: number;
  _netWorth: string;
  // _project?: AbstractProject;
  _originPortfolio: PortfolioItem;
  _tokenDict: Record<string, AbstractPortfolioToken>;
  _tokenList: AbstractPortfolioToken[];
  _historyPatched?: boolean;
  netWorthChange: number;
  _netWorthChange: string;
  _changePercentStr: string;
}

export type AbstractPortfolioToken = PortfolioItemToken & {
  _tokenId: string;
  _amountStr?: string;
  _priceStr?: string;
  _amountChange?: number;
  _amountChangeStr?: string;
  _usdValue?: number;
  _realUsdValue: number;
  _usdValueStr?: string;
  _historyPatched?: boolean;
  _usdValueChange?: number;
  _usdValueChangeStr?: string;
  _amountChangeUsdValueStr?: string;
  _usdValueChangePercent?: string;
  _realUsdValueChange?: number;
  _isPined?: boolean;
  _isFold?: boolean;
  _isMiniFold?: boolean;
  _isManualFold?: boolean;
  _isExcludeBalance?: boolean;
  _pinIndex?: number;
  _unHold?: boolean;
  value_24h_change?: string;
};

export type PortfolioProject = {
  chain: string;
  id: string;
  logo_url: string;
  name: string;
  site_url: string;
  withdraw_actions?: WithdrawAction[];
  portfolio_item_list?: PortfolioItem[];
};

export type CombineToken = {
  type: 'unfold_token' | 'fold_token';
  data: AbstractPortfolioToken;
};

export type CombineDefi = {
  type: 'unfold_defi' | 'fold_defi';
  data: DisplayedProject;
};

export type CombineCollection = CollectionList & {
  address: string;
};

export type CombineNft = {
  type: 'unfold_nft' | 'fold_nft';
  data: NftItemWithCollection;
};

export type ActionHeaderItem = {
  type:
    | 'overview'
    | 'asset_header'
    | 'defi_header'
    | 'nft_header'
    | 'toggle_token_fold'
    | 'toggle_defi_fold'
    | 'toggle_nft_fold'
    | 'empty-assets'
    | 'empty-token'
    | 'empty-nft'
    | 'empty-defi'
    | 'switch_tabs'
    | 'loading-skeleton'
    | 'loading-defi-skeleton';
  data?: null | string;
};

export type IScamTokenHeader = {
  type: 'scam_token';
  data: {
    total: number;
    logoUrls: string[];
  };
};

export type RenterAddressType = {
  type: 'address_entry';
  data: KeyringAccountWithAlias;
};

export type ActionItem =
  | ActionHeaderItem
  | CombineToken
  | CombineDefi
  | CombineNft
  | RenterAddressType
  | IScamTokenHeader;

export type DisplayNftItem = NFTItem & {
  _isFold?: boolean;
  _isManualFold?: boolean;
  is_core?: boolean;
};
export const isSectionHeader = (type: string) => {
  return [
    'asset_header',
    'toggle_token_fold',
    'defi_header',
    'toggle_defi_fold',
    'nft_header',
    'toggle_nft_fold',
  ].includes(type);
};
