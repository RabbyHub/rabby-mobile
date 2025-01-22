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
import { runOnJS } from 'react-native-reanimated';

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
    console.log(
      '🔍 CUSTOM_LOGGER:=>isExpired token:',
      isExpired,
      'force',
      force,
      user_id.slice(-4),
    );
    if (force || isExpired) {
      const tokens = await batchQueryTokens(user_id, chainId, isTestnet);
      runOnJS(syncRemoteTokens)(user_id, tokens);
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

export const tagTokenList = (
  tokens: AbstractPortfolioToken[],
  tokenSetting: ITokenSetting,
) => {
  const {
    pinedQueue = [],
    includeDefiAndTokens = [],
    excludeDefiAndTokens = [],
    foldTokens = [],
    unfoldTokens = [],
  } = tokenSetting;

  return tokens.map(i => {
    const pinIndex = pinedQueue.findIndex(
      x => x.chainId === i.chain && x.tokenId === i._tokenId,
    );
    const isPin = pinIndex !== -1;
    const isFold = (() => {
      if (
        foldTokens.some(x => x.chainId === i.chain && x.tokenId === i._tokenId)
      ) {
        return true;
      }
      if (
        unfoldTokens.some(
          x => x.chainId === i.chain && x.tokenId === i._tokenId,
        )
      ) {
        return false;
      }
      if (!i.is_core || (i._usdValue || 0) < 1) {
        return true;
      }
      return false;
    })();

    const isExcludeBalance = (() => {
      if (
        excludeDefiAndTokens.some(
          x =>
            x.id === i._tokenId && x.chainid === i.chain && x.type === 'token',
        )
      ) {
        return true;
      }
      if (
        includeDefiAndTokens.some(
          x =>
            x.id === i._tokenId && x.chainid === i.chain && x.type === 'token',
        )
      ) {
        return false;
      }
      if (!i.is_core) {
        return true;
      }
      return false;
    })();

    const isManualFold = foldTokens.some(
      x => x.chainId === i.chain && x.tokenId === i._tokenId,
    );

    return {
      ...i,
      _isPined: isPin,
      _isFold: isFold,
      _isManualFold: isManualFold,
      _isExcludeBalance: isExcludeBalance,
      _pinIndex: pinIndex,
    };
  });
};

export const ensureAbstractPortfolioToken = (
  token: TokenItem | AbstractPortfolioToken,
): AbstractPortfolioToken => {
  if (token instanceof DisplayedToken) return token as AbstractPortfolioToken;

  return new DisplayedToken(token) as AbstractPortfolioToken;
};
