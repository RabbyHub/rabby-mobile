import type { PortfolioItem } from '@rabby-wallet/rabby-api/dist/types';

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
