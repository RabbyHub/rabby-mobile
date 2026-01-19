import { IProtocolItem, IProtocolPortfolio } from '@/store/protocols';
import {
  ComplexProtocol,
  PortfolioItem,
} from '@rabby-wallet/rabby-api/dist/types';
import { columnConverter } from '@/databases/entities/_helpers';
import { ProtocolItemEntity } from '@/databases/entities/portocolItem';

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

// 来自数据库的协议数据，转换为前端协议数据
export const protocolEntityToIProtocolItem = (
  item: ProtocolItemEntity,
): IProtocolItem => {
  const portfolios = columnConverter.jsonStringToObj(
    item.portfolio_item_list,
  ) as unknown as PortfolioItem[];
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

// 来自backend的协议数据，转换为前端协议数据
export const complexProtocol2ProtocolItem = (
  complexProtocol: ComplexProtocol,
  owner_addr: string,
): IProtocolItem => {
  const formatPortfolio = complexProtocol.portfolio_item_list.map(
    portfolioToIProtocolPortfolio,
  );
  const totalNetWorth = formatPortfolio.reduce(
    (acc, curr) => acc + curr.netWorth,
    0,
  );
  return {
    id: complexProtocol.id,
    name: complexProtocol.name,
    logo: complexProtocol.logo_url,
    chain: complexProtocol.chain,
    site_url: complexProtocol.site_url,
    netWorth: totalNetWorth,
    _portfolios: formatPortfolio,
    owner_addr,
  };
};
