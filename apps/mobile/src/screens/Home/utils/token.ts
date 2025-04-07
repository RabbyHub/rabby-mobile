import {
  PortfolioItem,
  PortfolioItemToken,
  TokenItem,
} from '@rabby-wallet/rabby-api/dist/types';
import { DisplayedProject, DisplayedToken, pQueue } from './project';
import { isTestnet as checkIsTestnet } from '@/utils/chain';
import { flatten } from 'lodash';
import { requestOpenApiWithChainId } from '@/utils/openapi';
import { openapi, testOpenapi } from '@/core/request';
import { AbstractPortfolioToken } from '../types';
import { ITokenSetting } from '@/core/services/preference';
import { syncRemoteTokens } from '@/databases/sync/assets';
import { TokenItemEntity } from '@/databases/entities/tokenitem';
import { runOnJS } from 'react-native-reanimated';
import dayjs from 'dayjs';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import BigNumber from 'bignumber.js';

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
    if (force || isExpired) {
      const [tokensResult, historyTokensResult, chainListResult] =
        await Promise.allSettled([
          batchQueryTokens(user_id, chainId, isTestnet),
          batchQueryHistoryTokens(
            user_id,
            dayjs().subtract(1, 'days').unix(),
            isTestnet,
          ),
          openapi.getChainList(),
        ]);

      const tokens =
        tokensResult.status === 'fulfilled' ? tokensResult.value : [];
      const historyTokens =
        historyTokensResult.status === 'fulfilled'
          ? historyTokensResult.value
          : [];
      const chainList =
        chainListResult.status === 'fulfilled' ? chainListResult.value : [];

      const writeTokens = [...tokens] as (TokenItem & {
        value_24h_change?: string;
      })[];

      historyTokens?.forEach(historyToken => {
        const idx = tokens.findIndex(
          t =>
            isSameAddress(historyToken.id, t.id) &&
            historyToken.chain === t.chain,
        );
        if (idx > -1) {
          const token24hAgo = new BigNumber(historyToken.amount).times(
            historyToken.price,
          );
          writeTokens[idx].value_24h_change = new BigNumber(
            writeTokens[idx].amount,
          )
            .times(writeTokens[idx].price)
            .minus(token24hAgo)
            .div(token24hAgo)
            .toString();

          if (historyToken.price === 0 && writeTokens[idx].price === 0) {
            const token24hAgoAmount = new BigNumber(historyToken.amount);

            writeTokens[idx].value_24h_change = new BigNumber(
              writeTokens[idx].amount,
            )
              .minus(token24hAgoAmount)
              .div(token24hAgoAmount)
              .toString();
          }

          if (writeTokens[idx].price === 0 && historyToken.price !== 0) {
            writeTokens[idx].value_24h_change = '-1';
          }

          if (writeTokens[idx].amount === 0) {
            writeTokens[idx].value_24h_change = '-1';
          }
        }
      });

      writeTokens.forEach((wt, idx) => {
        if (wt.value_24h_change === undefined) {
          // only this token has history data
          const isSupportedHistory =
            !!chainList?.find(chain => wt.chain === chain.id)
              ?.is_support_history &&
            wt.is_core &&
            !wt.is_scam;
          writeTokens[idx].value_24h_change = isSupportedHistory
            ? '1'
            : (writeTokens[idx].price_24h_change || '0') + '';
        }
      });

      runOnJS(syncRemoteTokens)(user_id, writeTokens);
      return writeTokens;
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
    if ((i._usdValue || 0) < 1 || isExcludeBalance) {
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
    _isFold: isPin ? false : isFold || isExcludeBalance,
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
  return tokens.map(i => tagTokenItem(i, tokenSetting));
};

export const ensureAbstractPortfolioToken = (
  token: TokenItem | AbstractPortfolioToken,
): AbstractPortfolioToken => {
  if (token instanceof DisplayedToken) {
    return token as AbstractPortfolioToken;
  }

  return new DisplayedToken(token) as AbstractPortfolioToken;
};
