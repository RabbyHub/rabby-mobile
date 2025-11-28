import {
  PortfolioItem,
  PortfolioItemToken,
  TokenItem,
} from '@rabby-wallet/rabby-api/dist/types';
import { DisplayedProject, DisplayedToken, pQueue } from './project';
import { isTestnet as checkIsTestnet } from '@/utils/chain';
import { flatten } from 'lodash';
import { requestOpenApiWithChainId } from '@/utils/openapi';
import { openapi } from '@/core/request';
import { AbstractPortfolioToken } from '../types';
import { ITokenSetting } from '@/core/services/preference';
import { syncRemoteTokens } from '@/databases/sync/assets';
import { TokenItemEntity } from '@/databases/entities/tokenitem';

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
    const res = await Promise.allSettled(
      chainIdList.map(serverId =>
        pQueue.add(async () => {
          const chainTokensRes = await requestOpenApiWithChainId(
            ({ openapi }) => openapi.listToken(user_id, serverId, true),
            {
              isTestnet,
            },
          );
          return chainTokensRes;
        }),
      ),
    );

    // 检查是否所有链都明确失败了
    const allFailed = res.every(result => result.status === 'rejected');
    if (allFailed && chainIdList.length > 0) {
      throw new Error('All chains failed, service may unavailable');
    }

    // 提取成功的结果，失败的结果返回空数组
    const successfulResults = res.map(result =>
      result.status === 'fulfilled' ? result.value : [],
    );

    return flatten(successfulResults as TokenItem[][]);
  }
  return requestOpenApiWithChainId(
    ({ openapi }) => openapi.listToken(user_id, chainId, true),
    {
      isTestnet,
    },
  );
};

export const batchQueryTokensWithLocalCache = async (
  params: {
    user_id: string;
    chainId?: string;
    isTestnet?: boolean;
  },
  force?: boolean,
  onlySync?: boolean,
) => {
  const {
    user_id,
    chainId,
    isTestnet = !chainId ? false : checkIsTestnet(chainId),
  } = params;
  if (!chainId && !isTestnet) {
    const isExpired = await TokenItemEntity.isExpired(user_id);
    if (force || isExpired) {
      const tokens = await batchQueryTokens(user_id, chainId, isTestnet);
      syncRemoteTokens(user_id, [...tokens]);
      return tokens;
    } else {
      return onlySync ? [] : TokenItemEntity.batchQueryTokens(user_id);
    }
  }
  return batchQueryTokens(user_id, chainId, isTestnet);
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

export type TaggedPortfolioToken<
  T extends AbstractPortfolioToken = AbstractPortfolioToken,
> = T & {
  _isPined: boolean;
  _isFold: boolean;
  _isManualFold: boolean;
  _isMiniFold: boolean;
  _isExcludeBalance: boolean;
  _pinIndex: number;
};
export function tagTokenItem<
  T extends AbstractPortfolioToken = AbstractPortfolioToken,
>(i: T, tokenSetting: ITokenSetting) {
  const {
    pinedQueue = [],
    includeDefiAndTokens = [],
    excludeDefiAndTokens = [],
    foldTokens = [],
    unfoldTokens = [],
  } = tokenSetting;
  const pinIndex = pinedQueue.findIndex(
    x => x.chainId === i.chain && x.tokenId === i._tokenId,
  );
  const isPin = pinIndex !== -1;
  const isExcludeBalance = (() => {
    if (
      excludeDefiAndTokens.some(
        x => x.id === i._tokenId && x.chainid === i.chain && x.type === 'token',
      )
    ) {
      return true;
    }
    if (
      includeDefiAndTokens.some(
        x => x.id === i._tokenId && x.chainid === i.chain && x.type === 'token',
      )
    ) {
      return false;
    }
    if (!i.is_core) {
      return true;
    }
    return false;
  })();
  const [isFold, isMiniFold] = (() => {
    if (
      foldTokens.some(x => x.chainId === i.chain && x.tokenId === i._tokenId)
    ) {
      return [true, false];
    }
    if (
      unfoldTokens.some(x => x.chainId === i.chain && x.tokenId === i._tokenId)
    ) {
      return [false, false];
    }
    if (!i.is_core) {
      return [true, false];
    }
    if (isExcludeBalance) {
      return [true, true];
    }
    return [false, false];
  })();

  const isManualFold = foldTokens.some(
    x => x.chainId === i.chain && x.tokenId === i._tokenId,
  );

  return {
    ...i,
    _isPined: isPin,
    _isFold: isFold,
    _isManualFold: isManualFold,
    _isMiniFold: isMiniFold,
    _isExcludeBalance: isExcludeBalance,
    _pinIndex: pinIndex,
  };
}

export const tagTokenList = (
  tokens: AbstractPortfolioToken[],
  tokenSetting: ITokenSetting,
) => {
  const tagedTokens = tokens.map(i => tagTokenItem(i, tokenSetting));
  const { unfoldTokens = [] } = tokenSetting;
  const coreTokens = tokens.filter(i => i.is_core);
  const listLength = coreTokens.length || 0;
  const totalValue = coreTokens.reduce(
    (acc, curr) => acc + (curr._usdValue || 0),
    0,
  );
  const threshold = Math.min((totalValue || 0) / 100, 1000);
  const thresholdIndex = coreTokens
    ? coreTokens.findIndex(m => (m._usdValue || 0) < threshold)
    : -1;

  const hasExpandSwitch =
    listLength >= 15 && thresholdIndex > -1 && thresholdIndex <= listLength - 4;
  if (!hasExpandSwitch) {
    return tagedTokens;
  }
  return tagedTokens.map(i => {
    if (
      i._isMiniFold ||
      i._isFold ||
      !i.is_core ||
      unfoldTokens.some(x => x.chainId === i.chain && x.tokenId === i._tokenId)
    ) {
      return i;
    }
    return {
      ...i,
      _isMiniFold: (i._usdValue || 0) < threshold,
      _isFold: (i._usdValue || 0) < threshold,
    };
  });
};

export const ensureAbstractPortfolioToken = (
  token: TokenItem | AbstractPortfolioToken,
): AbstractPortfolioToken => {
  if (token instanceof DisplayedToken) {
    return token as AbstractPortfolioToken;
  }

  return new DisplayedToken(token) as AbstractPortfolioToken;
};
