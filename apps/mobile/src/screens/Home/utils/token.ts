import {
  PortfolioItem,
  PortfolioItemToken,
  TokenItem,
} from '@rabby-wallet/rabby-api/dist/types';
import { DisplayedProject, pQueue } from './project';
import { isTestnet as checkIsTestnet } from '@/utils/chain';
import { flatten } from 'lodash';
import { requestOpenApiWithChainId } from '@/utils/openapi';
import { openapi } from '@/core/request';

export const queryTokensCache = async (user_id: string, isTestnet = false) => {
  return requestOpenApiWithChainId(
    ({ openapi }) => openapi.getCachedTokenList(user_id),
    {
      isTestnet,
    },
  );
};

export const batchQueryTokens = async (
  user_id: string,
  chainId?: string,
  isTestnet: boolean = !chainId ? false : checkIsTestnet(chainId),
) => {
  if (!chainId && !isTestnet) {
    const usedChains = await openapi.usedChainList(user_id);
    const chainIdList = usedChains.map(item => item.id);
    const res = await Promise.all(
      chainIdList.map(serverId =>
        pQueue.add(() => {
          return requestOpenApiWithChainId(
            ({ openapi }) => openapi.listToken(user_id, serverId, true),
            {
              isTestnet,
            },
          );
        }),
      ),
    );
    return flatten(res as TokenItem[][]);
  }
  return requestOpenApiWithChainId(
    ({ openapi }) => openapi.listToken(user_id, chainId, true),
    {
      isTestnet,
    },
  );
};

export const batchQueryHistoryTokens = async (
  user_id: string,
  time_at: number,
  isTestnet = false,
) => {
  return requestOpenApiWithChainId(
    ({ openapi }) =>
      openapi.getHistoryTokenList({ id: user_id, timeAt: time_at }),
    {
      isTestnet,
    },
  );
};

export const setWalletTokens = (
  p?: DisplayedProject,
  tokensDict?: Record<string, TokenItem[]>,
) => {
  if (!p || !tokensDict) {
    return;
  }

  Object.entries(tokensDict).forEach(([chain, tokens]) => {
    p?.setPortfolios([
      // 假的结构 portfolio，只是用来对齐结构 PortfolioItem
      {
        pool: {
          id: chain,
        },
        asset_token_list: tokens as PortfolioItemToken[],
      } as PortfolioItem,
    ]);
  });
};

export const sortWalletTokens = (wallet: DisplayedProject) => {
  return wallet._portfolios
    .flatMap(x => x._tokenList)
    .sort((m, n) => (n._usdValue || 0) - (m._usdValue || 0));
};
