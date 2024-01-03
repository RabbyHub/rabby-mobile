import { Chain } from '@debank/common';
import { CHAINS } from '@/constant/chains';

interface PortfolioChain extends Chain {
  isSupportHistory: boolean;
}

// chainid 如果有值, 资产页面会发起请求
export const CHAIN_ID_LIST = new Map<string, PortfolioChain>(
  Object.values(CHAINS).map(chain => {
    return [chain.serverId, { ...chain, isSupportHistory: false }];
  }),
);

export const getChainName = (chain?: string) => {
  return (chain && CHAIN_ID_LIST.get(chain)?.name) || 'Unsupported chain';
};
