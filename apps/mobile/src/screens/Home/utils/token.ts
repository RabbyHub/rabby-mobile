import {
  PortfolioItem,
  PortfolioItemToken,
  TokenItem,
} from '@rabby-wallet/rabby-api/dist/types';
import { DisplayedProject, DisplayedToken, pQueue } from './project';
import {
  isTestnet as checkIsTestnet,
  makeChainServerIdSet,
} from '@/utils/chain';
import { flatten } from 'lodash';
import { requestOpenApiWithChainId } from '@/utils/openapi';
import { openapi } from '@/core/request';
import { AbstractPortfolioToken } from '../types';
import { ITokenSetting } from '@/core/services/preference';
import { syncRemoteTokens } from '@/databases/sync/assets';
import { TokenItemEntity } from '@/databases/entities/tokenitem';
import { makeSWRKeyAsyncFunc } from '@/core/utils/concurrency';
import { BalanceEntity } from '@/databases/entities/balance';
import { ITokenItem } from '@/store/tokens';

export const queryTokensCache = makeSWRKeyAsyncFunc(
  (user_id: string, isTestnet: boolean = false) => {
    return requestOpenApiWithChainId(
      ({ openapi }) => openapi.getCachedTokenList(user_id),
      {
        isTestnet,
      },
    );
  },
  ctx => [`${ctx.args[0]}-${ctx.args[1]}`],
);

export const batchQueryTokens = makeSWRKeyAsyncFunc(
  async (
    user_id: string,
    chainId?: string,
    isTestnet: boolean = !chainId ? false : checkIsTestnet(chainId),
    isV2 = false,
  ) => {
    if (!chainId && !isTestnet) {
      let chainIdList: string[] = [];
      if (isV2) {
        let usedChains = await BalanceEntity.queryChainList(user_id);
        chainIdList = usedChains
          .filter(item => item.usd_value > 0.5)
          .map(item => item.id);
        if (usedChains.length <= 0) {
          // 兜底，预防还没写过本地数据的情况发生
          // TODO: 移除
          const chains = await openapi.usedChainList(user_id);
          chainIdList = chains.map(item => item.id);
        }
      } else {
        const usedChains = await openapi.usedChainList(user_id);
        chainIdList = usedChains.map(item => item.id);
      }
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
  },
  ctx => {
    const [user_id, chainId, isTestnet] = ctx.args;
    return chainId
      ? `${user_id}-${chainId}-${isTestnet}`
      : `${user_id}-all-${isTestnet}`;
  },
);

export const batchQueryTokensWithLocalCache = async (
  params: {
    user_id: string;
    chainId?: string;
    isTestnet?: boolean;
  },
  force?: boolean,
  onlySync?: boolean,
  isV2 = false,
) => {
  const {
    user_id,
    chainId,
    isTestnet = !chainId ? false : checkIsTestnet(chainId),
  } = params;
  if (!chainId && !isTestnet) {
    const isExpired = await TokenItemEntity.isExpired(user_id);
    if (force || isExpired) {
      const tokens = await batchQueryTokens(user_id, chainId, isTestnet, isV2);
      syncRemoteTokens(user_id, [...tokens]);
      return tokens;
    } else {
      return onlySync ? [] : TokenItemEntity.batchQueryTokens(user_id);
    }
  }
  return batchQueryTokens(user_id, chainId, isTestnet, isV2);
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
  _isManualUnFold: boolean;
  _isMiniFold: boolean;
  _isExcludeBalance: boolean;
  _pinIndex: number;
};

type ITokenSettingsSet = {
  pinedQueue: ITokenSetting['pinedQueue'] & object;
  includeTokens: Set<string>;
  excludeTokens: Set<string>;
  foldTokens: Set<string>;
  unfoldTokens: Set<string>;
};
function encodeChainTokenId(chain: string, token_id: string) {
  return `${chain}::${token_id}`.toLowerCase();
}
export function makeTokenSettingSets(
  tokenSetting: ITokenSetting,
): ITokenSettingsSet {
  const tokenSettingSets: Required<ITokenSettingsSet> = {
    pinedQueue: tokenSetting.pinedQueue || [],
    includeTokens: new Set(
      (tokenSetting.includeDefiAndTokens || [])
        .filter(i => i.type === 'token')
        .map(i => encodeChainTokenId(i.chainid, i.id)),
    ),
    excludeTokens: new Set(
      (tokenSetting.excludeDefiAndTokens || [])
        .filter(i => i.type === 'token')
        .map(i => encodeChainTokenId(i.chainid, i.id)),
    ),
    foldTokens: new Set(
      (tokenSetting.foldTokens || []).map(i =>
        encodeChainTokenId(i.chainId, i.tokenId),
      ),
    ),
    unfoldTokens: new Set(
      (tokenSetting.unfoldTokens || []).map(i =>
        encodeChainTokenId(i.chainId, i.tokenId),
      ),
    ),
  };

  return tokenSettingSets;
}

export function tagTokenItemFavorite<T extends ITokenItem = ITokenItem>(
  i: T,
  tokenSetting: { pinedQueue: ITokenSettingsSet['pinedQueue'] },
) {
  const { pinedQueue } = tokenSetting;
  const pinIndex = Array.from(pinedQueue).findIndex(
    x =>
      x.chainId.toLowerCase() === i.chain.toLowerCase() &&
      x.tokenId.toLowerCase() === i.id.toLowerCase(),
  );
  const isPin = pinIndex !== -1;
  return {
    ...i,
    isPin,
  };
}

export function tagTokenItemV2<
  T extends AbstractPortfolioToken = AbstractPortfolioToken,
>(i: T, tokenSetting: Required<ITokenSettingsSet>) {
  const { pinedQueue, includeTokens, excludeTokens, foldTokens, unfoldTokens } =
    tokenSetting;
  // const isPin = pinedQueue.has(encodeChainTokenId(i.chain, i._tokenId));
  const pinIndex = Array.from(pinedQueue).findIndex(
    x =>
      x.chainId.toLowerCase() === i.chain.toLowerCase() &&
      x.tokenId.toLowerCase() === i._tokenId.toLowerCase(),
  );
  const isPin = pinIndex !== -1;
  const isExcludeBalance = (() => {
    if (excludeTokens.has(encodeChainTokenId(i.chain, i._tokenId))) {
      return true;
    }
    if (includeTokens.has(encodeChainTokenId(i.chain, i._tokenId))) {
      return false;
    }
    if (!i.is_core) {
      return true;
    }
    return false;
  })();

  const isManualFold = foldTokens.has(encodeChainTokenId(i.chain, i._tokenId));
  const isManualUnFold = unfoldTokens.has(
    encodeChainTokenId(i.chain, i._tokenId),
  );

  const [isFold, isMiniFold] = (() => {
    if (isManualFold) {
      return [true, false];
    }
    if (isManualUnFold) {
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

  return {
    ...i,
    _isPined: isPin,
    _isFold: isFold,
    _isManualFold: isManualFold,
    _isManualUnFold: isManualUnFold,
    _isMiniFold: isMiniFold,
    _isExcludeBalance: isExcludeBalance,
    _pinIndex: pinIndex,
  };
}

export const tagTokenList = <T extends AbstractPortfolioToken>(
  tokens: T[],
  tokenSetting: ITokenSetting,
  options?: {
    filterChainServerIds?: true | Set<string>;
  },
) => {
  const { filterChainServerIds } = options || {};
  const taggedTokens: ReturnType<typeof tagTokenItemV2>[] = [];
  const statics = {
    coreTokens: [] as ReturnType<typeof tagTokenItemV2>[],
    totalValue: 0,
    threshold: 0,
    thresholdIndex: -1,
    hasExpandSwitch: false,
  };

  const tokenSettingV2 = makeTokenSettingSets(tokenSetting);
  const chainServerIds =
    filterChainServerIds === true
      ? makeChainServerIdSet()
      : filterChainServerIds;

  tokens.forEach(i => {
    if (chainServerIds && !chainServerIds.has(i.chain)) return;

    const tagged = tagTokenItemV2(i, tokenSettingV2);
    taggedTokens.push(tagged);
    if (tagged.is_core) {
      statics.coreTokens.push(tagged);
      statics.totalValue += tagged._usdValue || 0;
    }
  });

  statics.threshold = Math.min(statics.totalValue / 100, 1000);
  statics.thresholdIndex = statics.coreTokens.findIndex(
    m => (m._usdValue || 0) < statics.threshold,
  );

  statics.hasExpandSwitch =
    statics.coreTokens.length >= 15 &&
    statics.thresholdIndex > -1 &&
    statics.thresholdIndex <= statics.coreTokens.length - 4;

  if (!statics.hasExpandSwitch) {
    return taggedTokens;
  }

  return taggedTokens.map(i => {
    if (i._isMiniFold || i._isFold || !i.is_core || i._isManualUnFold) {
      return i;
    }
    return {
      ...i,
      _isMiniFold: (i._usdValue || 0) < statics.threshold,
      _isFold: (i._usdValue || 0) < statics.threshold,
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
