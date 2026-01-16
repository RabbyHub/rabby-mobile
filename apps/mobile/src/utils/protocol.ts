import { IProtocolItem, IProtocolPortfolio } from '@/store/protocols';
import { PortfolioItem } from '@rabby-wallet/rabby-api/dist/types';
import { columnConverter } from '@/databases/entities/_helpers';

export const portfolioToIProtocolPortfolio = (
  p: PortfolioItem,
): IProtocolPortfolio => {
  let tokenNetWorth = 0;
  let sumTokenRealUsdValue = 0;

  p.asset_token_list?.forEach(t => {
    const currentRealUsdValue = (t.price ?? 0) * (t.amount ?? 0);
    const currentUsdValue = Math.abs(currentRealUsdValue);
    tokenNetWorth += currentUsdValue || 0;
    sumTokenRealUsdValue += currentRealUsdValue || 0;
  });

  const netWorth = p.stats ? p.stats.net_usd_value : tokenNetWorth;

  return {
    id: `${p?.pool?.id}${p.position_index || ''}`,
    name: p.name,

    _sumTokenRealUsdValue: sumTokenRealUsdValue,

    netWorth,

    _originPortfolio: p,
  };
};

export const protocolEntityToIProtocolItem = (item: {
  id: string;
  chain: string;
  name: string;
  site_url: string;
  logo_url: string;
  has_supported_portfolio: boolean;
  tvl: number;
  portfolio_item_list: PortfolioItem[] | string;
  owner_addr: string;
}): IProtocolItem => {
  const portfolios =
    typeof item.portfolio_item_list === 'string'
      ? (columnConverter.jsonStringToObj(
          item.portfolio_item_list,
        ) as unknown as PortfolioItem[])
      : item.portfolio_item_list;
  const formatPortfolio = portfolios.map(portfolioToIProtocolPortfolio);
  const totalNetWorth = formatPortfolio.reduce(
    (acc, curr) => acc + curr.netWorth,
    0,
  );

  return {
    id: item.id,
    name: item.name,
    logo: item.logo_url,
    chain: item.chain,
    site_url: item.site_url,
    owner_addr: item.owner_addr,
    netWorth: totalNetWorth,
    _portfolios: formatPortfolio,
  };
};
