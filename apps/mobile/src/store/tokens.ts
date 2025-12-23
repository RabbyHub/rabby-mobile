import { getTop10MyAddresses } from '@/core/apis/account';
import { openapi } from '@/core/request';
import { zCreate } from '@/core/utils/reexports';
import { BalanceEntity } from '@/databases/entities/balance';
import { TokenItemEntity } from '@/databases/entities/tokenitem';
import { syncRemoteTokens } from '@/databases/sync/assets';
import { waitQueueFinished } from '@/hooks/useMultiCurve';
import { queryTokensCache } from '@/screens/Home/utils/token';
import { requestOpenApiWithChainId } from '@/utils/openapi';
import {
  tokenItemEntityToTokenItem,
  tokenItemToITokenItem,
} from '@/utils/token';
import PQueue from 'p-queue';

export interface ITokenItem {
  amount: number;
  chain: string;
  decimals: number;
  display_symbol: string | null;
  id: string;
  is_core: boolean;
  is_verified: boolean;
  is_wallet: boolean;
  logo_url: string;
  name: string;
  optimized_symbol: string;
  price: number;
  symbol: string;
  usd_value: number;
  owner_addr: string;
  raw_amount?: string;
  price_24h_change?: number | null;
  cex_ids: string[];
  credit_score?: number;
  is_suspicious?: boolean;
  is_scam?: boolean;
  low_credit_score?: boolean;
  fdv?: number | null;
  is_infinity?: boolean;
  content_type?: 'image' | 'image_url' | 'video_url' | 'audio_url';
  content?: string;
  inner_id?: string;
  time_at?: number;
  raw_amount_hex_str?: string;
}

interface TokenListState {
  tokenListMap: Record<string, ITokenItem[]>;
  isLoading: boolean;
  forMultiAssets(chainServerId?: string): {
    unFoldTokens: ITokenItem[];
    foldTokens: ITokenItem[];
    scamTokens: ITokenItem[];
  };
  initStore(): void;
  batchGetTokenList(addresses: string[], force?: boolean): void;
}

function getMultiAssetsFoldResultFromParts({
  nonScamTokens,
  coreTokens,
  totalValue,
}: {
  nonScamTokens: ITokenItem[];
  coreTokens: ITokenItem[];
  totalValue: number;
}) {
  const listLength = coreTokens.length || 0;
  const threshold = Math.min((totalValue || 0) / 100, 1000);
  const thresholdIndex = coreTokens
    ? coreTokens.findIndex(token => (token.usd_value || 0) < threshold)
    : -1;
  const hasExpandSwitch =
    listLength >= 15 && thresholdIndex > -1 && thresholdIndex <= listLength - 4;

  const sortedTokens = nonScamTokens
    .slice()
    .sort((a, b) => (b.usd_value || 0) - (a.usd_value || 0));

  const unfoldedTokens: ITokenItem[] = [];
  const foldedTokens: ITokenItem[] = [];
  sortedTokens.forEach(token => {
    const shouldUnfold =
      !hasExpandSwitch || (token.usd_value || 0) >= threshold;
    if (shouldUnfold && token.is_core) {
      unfoldedTokens.push(token);
    } else {
      foldedTokens.push(token);
    }
  });

  const unfoldedTokensLimited = unfoldedTokens.slice(0, 20);
  const foldedTokensFromLimited = unfoldedTokens.slice(20).concat(foldedTokens);
  const sortedFoldedTokens = foldedTokensFromLimited.slice().sort((a, b) => {
    const aValue = a.usd_value || 0;
    const bValue = b.usd_value || 0;
    const aRank = a.is_core ? (aValue > 0 ? 0 : 2) : 1;
    const bRank = b.is_core ? (bValue > 0 ? 0 : 2) : 1;
    if (aRank !== bRank) {
      return aRank - bRank;
    }
    return bValue - aValue;
  });

  return {
    unfoldedTokens: unfoldedTokensLimited,
    foldedTokens: sortedFoldedTokens,
  };
}

const isDataExpired = async (address: string) => {
  const isExpired = await TokenItemEntity.isExpired(address);
  return isExpired;
};

const isDataExpiredBatch = async (addresses: string[]) => {
  const res = await Promise.all(addresses.map(isDataExpired));
  return res.some(item => !!item);
};

const useTokenList = zCreate<TokenListState>((set, get) => {
  let lastTokenListMap: TokenListState['tokenListMap'] | null = null;
  let lastChainServerId: string | undefined;
  let lastMultiAssetsResult: {
    unFoldTokens: ITokenItem[];
    foldTokens: ITokenItem[];
    scamTokens: ITokenItem[];
  } | null = null;

  return {
    tokenListMap: {},
    isLoading: false,
    // selectors
    forMultiAssets(chainServerId?: string) {
      const tokenListMap = get().tokenListMap || {};
      if (
        lastMultiAssetsResult &&
        lastTokenListMap === tokenListMap &&
        lastChainServerId === chainServerId
      ) {
        return lastMultiAssetsResult;
      }
      const tokens = Object.values(tokenListMap).flat();
      const scamTokens: ITokenItem[] = [];
      const nonScamTokens: ITokenItem[] = [];
      const coreTokens: ITokenItem[] = [];
      let totalValue = 0;
      tokens.forEach(token => {
        const usdValue = token.usd_value || 0;
        const isZeroCore = token.is_core && usdValue === 0;
        const isScam = (usdValue === 0 && !isZeroCore) || token.is_scam;
        if (isScam) {
          scamTokens.push(token);
        } else {
          nonScamTokens.push(token);
        }
        if (!isScam && token.is_core) {
          coreTokens.push(token);
          totalValue += usdValue;
        }
      });
      const { foldedTokens, unfoldedTokens } =
        getMultiAssetsFoldResultFromParts({
          nonScamTokens,
          coreTokens,
          totalValue,
        });
      const result = chainServerId
        ? {
            unFoldTokens: unfoldedTokens.filter(
              item => item.chain === chainServerId,
            ),
            foldTokens: foldedTokens.filter(
              item => item.chain === chainServerId,
            ),
            scamTokens: scamTokens.filter(item => item.chain === chainServerId),
          }
        : {
            unFoldTokens: unfoldedTokens,
            foldTokens: foldedTokens,
            scamTokens,
          };

      lastTokenListMap = tokenListMap;
      lastChainServerId = chainServerId;
      lastMultiAssetsResult = result;

      return result;
    },
    // forSingleAssetsDefaultList(address: string) {},
    // forSingleAssetsMoreList(address: string) {},
    // forTokenSelector(address: string) {},

    // actions
    async initStore() {
      // 在 App 启动时执行，初始化冷备数据
      // 取 Top10 地址
      const top10Addresses = await getTop10MyAddresses(true);
      const tokenMap = await TokenItemEntity.getDefaultTokensByAddresses(
        top10Addresses,
      );
      // 写入 Store
      set(() => ({ tokenListMap: tokenMap }));
    },

    async batchGetTokenList(addresses: string[], force = false) {
      if (!force) {
        const isExpired = await isDataExpiredBatch(addresses);
        if (!isExpired) {
          const tokens = await TokenItemEntity.batchMultiAddressTokens(
            addresses,
          );
          const res: Record<string, ITokenItem[]> = {};
          for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i] as TokenItemEntity;
            const transformedToken = tokenItemEntityToTokenItem(token);
            const key = transformedToken.owner_addr.toLowerCase();
            if (res[key]) {
              res[key].push(transformedToken);
            } else {
              res[key] = [transformedToken];
            }
          }
          console.log(res);
          set(() => ({ tokenListMap: res }));
          return;
        }
      }
      set(() => ({ isLoading: true }));
      const cacheTokenQueue = new PQueue({
        concurrency: 5,
      });
      const cacheTokenMap: Record<string, ITokenItem[]> = {};
      addresses.forEach(address => {
        cacheTokenQueue.add(async () => {
          const list = await queryTokensCache(address);
          cacheTokenMap[address.toLowerCase()] = list.map(item =>
            tokenItemToITokenItem(item, address),
          );
        });
      });
      await waitQueueFinished(cacheTokenQueue);
      set(() => ({ tokenListMap: cacheTokenMap }));
      const realTimeTokenMap: Record<string, ITokenItem[]> = {};
      const realTimeTokenQueue = new PQueue({
        concurrency: 15,
      });
      await Promise.allSettled(
        addresses.map(async address => {
          let chainIdList: string[] = [];
          let usedChains = await BalanceEntity.queryChainList(address);
          chainIdList = usedChains
            .filter(item => item.usd_value > 0.5)
            .map(item => item.id);
          if (usedChains.length <= 0) {
            // 兜底，预防还没写过本地数据的情况发生
            // TODO: 移除
            const chains = await openapi.usedChainList(address);
            chainIdList = chains.map(item => item.id);
          }
          const res = await Promise.allSettled(
            chainIdList.map(
              async serverId =>
                await realTimeTokenQueue.add(async () => {
                  const chainTokensRes = await requestOpenApiWithChainId(
                    ({ openapi }) => openapi.listToken(address, serverId, true),
                    {
                      isTestnet: false,
                    },
                  );
                  const tokenList = chainTokensRes.map(item =>
                    tokenItemToITokenItem(item, address),
                  );
                  return tokenList;
                }),
            ),
          );
          const results = res
            .map(result => (result.status === 'fulfilled' ? result.value : []))
            .flat() as ITokenItem[];
          realTimeTokenMap[address.toLowerCase()] = results;
          syncRemoteTokens(address.toLowerCase(), results);
        }),
      );
      set(() => ({ isLoading: false }));
      set(() => ({ tokenListMap: realTimeTokenMap }));
    },
  };
});

export default useTokenList;
