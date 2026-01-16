import PQueue from 'p-queue';

import {
  PortfolioItem,
  WithdrawAction,
} from '@rabby-wallet/rabby-api/dist/types';
import { AbstractPortfolio, AbstractProject, PortfolioProject } from '../types';
import { formatUsdValue } from '@/utils/number';
import { DisplayedToken } from '@/utils/token';

export const pQueue = new PQueue({
  interval: 1000,
  intervalCap: 100,
  concurrency: 40,
});

export class DisplayedProject implements AbstractProject {
  // [immerable] = true;
  id: string;
  name: string;
  logo?: string;
  chain?: string;
  netWorth: number;
  _netWorth: string;
  _isExcludeBalance?: boolean;
  _isFold?: boolean;
  _isManualFold?: boolean;
  _portfolioDict: Record<string, DisplayedPortfolio> = {};
  _portfolios: DisplayedPortfolio[] = [];
  _historyPatched?: boolean;
  _serverUpdatedAt = Math.ceil(new Date().getTime() / 1000);
  site_url?: string;
  netWorthChange = 0;
  _netWorthChange = '-';
  _netWorthChangePercent = '';
  _intNetworth = '';
  _rawPortfolios?: PortfolioItem[] = [];
  withdrawActions?: WithdrawAction[] = [];

  constructor(
    p: Partial<PortfolioProject>,
    portfolios?: PortfolioItem[],
    countRepeat = false,
  ) {
    this.id = p.id!;
    this.name = p.name!;
    this.logo = p.logo_url;
    this.chain = p.chain;
    this.netWorth = 0;
    this._netWorth = '-';
    this.site_url = p.site_url;
    this._rawPortfolios = portfolios;
    this.withdrawActions = p.withdraw_actions;

    this.setPortfolios(portfolios, countRepeat);
  }

  setPortfolios(portfolios?: PortfolioItem[], countRepeat = false) {
    portfolios?.forEach((x, i) => {
      const position = new DisplayedPortfolio(x);
      const _p = this._portfolioDict[position.id];
      if (_p) {
        if (countRepeat) {
          // bundle 的 临时 fix，bundle 中相同的 portfolio 没有聚合
          position.id = `${position.id}_${i}`;
        } else {
          // 如果之前已经有了这个 position，就 减去 原来的 netWorth
          this.netWorth -= _p.netWorth;
        }
      }
      this.netWorth += position.netWorth;
      this._netWorth = formatUsdValue(this.netWorth);
      this._intNetworth = formatUsdValue(this.netWorth);

      this._portfolioDict[position.id] = position;

      this._serverUpdatedAt = Math.min(this._serverUpdatedAt, x.update_at);
    });

    this._portfolios = Object.values(this._portfolioDict).sort((m, n) => {
      // debt 在最后面进行从大到小排序
      if (n._sumTokenRealUsdValue < 0 && m._sumTokenRealUsdValue < 0) {
        return m._sumTokenRealUsdValue - n._sumTokenRealUsdValue;
      }

      return n._sumTokenRealUsdValue - m._sumTokenRealUsdValue;
    });
  }
}

export {
  /** @deprecated import from '@/utils/token.ts' directly */
  DisplayedToken,
};

export class DisplayedPortfolio implements AbstractPortfolio {
  // [immerable] = true;
  id: string;
  name?: string;
  netWorth: number;
  _netWorth: string;
  _sumTokenRealUsdValue = 0;
  // _project?: DisplayedProject;
  _originPortfolio: PortfolioItem;
  netWorthChange = 0;
  _netWorthChange = '-';
  _changePercentStr = '';

  constructor(p: PortfolioItem) {
    this.id = `${p?.pool?.id}${p.position_index || ''}`;
    this._originPortfolio = p;
    this.name = p.name;
    // this._project = project;

    // 如果是 wallet，没有 stats 对象
    let tokenNetWorth = 0;

    p.asset_token_list?.forEach(t => {
      const currentRealUsdValue = (t.price ?? 0) * (t.amount ?? 0);
      // 注意这里，debt 也被处理成正值
      const currentUsdValue = Math.abs(currentRealUsdValue);
      tokenNetWorth += currentUsdValue || 0;
      this._sumTokenRealUsdValue += currentRealUsdValue || 0;
    });

    this.netWorth = p.stats ? p.stats.net_usd_value : tokenNetWorth;
    this._netWorth = formatUsdValue(this.netWorth);
  }
}
