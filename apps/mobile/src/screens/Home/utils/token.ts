import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { DisplayedToken, pQueue } from './project';
import { isTestnet as checkIsTestnet } from '@/utils/chain';
import { flatten } from 'lodash';
import { requestOpenApiWithChainId } from '@/utils/openapi';
import { openapi } from '@/core/request';
import { AbstractPortfolioToken } from '../types';
import { ITokenSetting } from '@/core/services/preference';
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
};
export function makeTokenSettingSets(
  tokenSetting: ITokenSetting,
): ITokenSettingsSet {
  const tokenSettingSets: Required<ITokenSettingsSet> = {
    pinedQueue: tokenSetting.pinedQueue || [],
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

export const ensureAbstractPortfolioToken = (
  token: TokenItem | AbstractPortfolioToken,
): AbstractPortfolioToken => {
  if (token instanceof DisplayedToken) {
    return token as AbstractPortfolioToken;
  }

  return new DisplayedToken(token) as AbstractPortfolioToken;
};
