import { getTop10MyAddresses } from '@/core/apis/account';
import { openapi } from '@/core/request';
import { zCreate } from '@/core/utils/reexports';
import { BalanceEntity } from '@/databases/entities/balance';
import { TokenItemEntity } from '@/databases/entities/tokenitem';
import { syncRemoteTokens } from '@/databases/sync/assets';
import { waitQueueFinished } from '@/hooks/useMultiCurve';
import { queryTokensCache } from '@/screens/Home/utils/token';
import { lpTokenFilter } from '@/utils/lpToken';
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
  time_at: number;
  credit_score?: number;
  is_suspicious?: boolean;
  is_scam?: boolean;
  low_credit_score?: boolean;
  fdv?: number | null;
  is_infinity?: boolean;
  content_type?: 'image' | 'image_url' | 'video_url' | 'audio_url';
  content?: string;
  inner_id?: string;
  raw_amount_hex_str?: string;
  isPin?: boolean;
  trade_volume_level?: 'low' | 'middle' | 'high';
  support_market_data?: boolean;
  protocol_id?: string;
}

interface TokenListState {
  tokenListMap: Record<string, ITokenItem[]>;
  isLoading: boolean;
  isLoadingByAddress: Record<string, boolean>;
  forMultiAssets(
    chainServerId?: string,
    isLpTokenEnabled?: boolean,
  ): {
    unFoldTokens: ITokenItem[];
    foldTokens: ITokenItem[];
    scamTokens: ITokenItem[];
  };
  forSingleAssets(
    address: string,
    chainServerId?: string,
    isLpTokenEnabled?: boolean,
  ): {
    unFoldTokens: ITokenItem[];
    foldTokens: ITokenItem[];
    scamTokens: ITokenItem[];
  };
  forTokenSelect(
    address?: string,
    chainServerId?: string,
    keyword?: string,
    isLpTokenEnabled?: boolean,
  ): {
    unFoldTokens: ITokenItem[];
    foldTokens: ITokenItem[];
    scamTokens: ITokenItem[];
  };
  forPerpsTokenSelect(address?: string): ITokenItem[];
  forChainSelector(address?: string): ITokenItem[];
  initStore(): void;
  batchGetTokenList(addresses: string[], force?: boolean): Promise<void>;
  getTokenList(address: string, force?: boolean): Promise<void>;
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

const compareByUsdValueDesc = (a: ITokenItem, b: ITokenItem) =>
  (b.usd_value || 0) - (a.usd_value || 0);

const sortByUsdValueDesc = (list: ITokenItem[]) =>
  list.slice().sort(compareByUsdValueDesc);

const isDataExpired = async (address: string) => {
  const isExpired = await TokenItemEntity.isExpired(address);
  return isExpired;
};

const isDataExpiredBatch = async (addresses: string[]) => {
  const res = await Promise.all(addresses.map(isDataExpired));
  return res.some(item => !!item);
};

const tokenListStore = zCreate<TokenListState>((set, get) => {
  let lastTokenListMap: TokenListState['tokenListMap'] | null = null;
  let lastChainServerId: string | undefined;
  let lastMultiAssetsResult: {
    unFoldTokens: ITokenItem[];
    foldTokens: ITokenItem[];
    scamTokens: ITokenItem[];
  } | null = null;
  let lastSingleAssetsResult: {
    unFoldTokens: ITokenItem[];
    foldTokens: ITokenItem[];
    scamTokens: ITokenItem[];
  } | null = null;
  let lastSingleAddress: string | undefined;
  let lastSingleChainServerId: string | undefined;
  let lastSingleTokenListMap: TokenListState['tokenListMap'] | null = null;
  let lastTokenSelectResult: {
    unFoldTokens: ITokenItem[];
    foldTokens: ITokenItem[];
    scamTokens: ITokenItem[];
  } | null = null;
  let lastTokenSelectChainServerId: string | undefined;
  let lastTokenSelectListMap: TokenListState['tokenListMap'] | null = null;
  let lastTokenSelectAddress: string | undefined;
  let lastTokenSelectKeyword: string | undefined;
  let lastIsLpTokenEnabled: boolean | undefined;

  return {
    tokenListMap: {},
    isLoading: false, // 整体的 loading 状态
    isLoadingByAddress: {}, // 单个地址的 loading 状态
    // selectors
    forMultiAssets(chainServerId?: string, isLpTokenEnabled?: boolean) {
      const tokenListMap = get().tokenListMap || {};
      if (
        lastMultiAssetsResult &&
        lastTokenListMap === tokenListMap &&
        lastChainServerId === chainServerId &&
        lastIsLpTokenEnabled === isLpTokenEnabled
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
            foldTokens: foldedTokens
              .filter(item => item.chain === chainServerId)
              .filter(i => lpTokenFilter(i, isLpTokenEnabled)),
            scamTokens: scamTokens
              .filter(item => item.chain === chainServerId)
              .filter(i => lpTokenFilter(i, isLpTokenEnabled)),
          }
        : {
            unFoldTokens: unfoldedTokens,
            foldTokens: foldedTokens.filter(i =>
              lpTokenFilter(i, isLpTokenEnabled),
            ),
            scamTokens: scamTokens.filter(i =>
              lpTokenFilter(i, isLpTokenEnabled),
            ),
          };

      lastTokenListMap = tokenListMap;
      lastChainServerId = chainServerId;
      lastMultiAssetsResult = result;
      lastIsLpTokenEnabled = isLpTokenEnabled;
      return result;
    },
    forSingleAssets(
      address: string,
      chainServerId?: string,
      isLpTokenEnabled?: boolean,
    ) {
      const tokenListMap = get().tokenListMap || {};
      const normalizedAddress = address.toLowerCase();
      if (
        lastSingleAssetsResult &&
        lastSingleTokenListMap === tokenListMap &&
        lastSingleAddress === normalizedAddress &&
        lastSingleChainServerId === chainServerId &&
        lastIsLpTokenEnabled === isLpTokenEnabled
      ) {
        return lastSingleAssetsResult;
      }
      const tokens = tokenListMap[normalizedAddress] || [];
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
            foldTokens: foldedTokens
              .filter(item => item.chain === chainServerId)
              .filter(i => lpTokenFilter(i, isLpTokenEnabled)),
            scamTokens: scamTokens
              .filter(item => item.chain === chainServerId)
              .filter(i => lpTokenFilter(i, isLpTokenEnabled)),
          }
        : {
            unFoldTokens: unfoldedTokens,
            foldTokens: foldedTokens.filter(i =>
              lpTokenFilter(i, isLpTokenEnabled),
            ),
            scamTokens: scamTokens.filter(i =>
              lpTokenFilter(i, isLpTokenEnabled),
            ),
          };

      lastSingleTokenListMap = tokenListMap;
      lastSingleAddress = normalizedAddress;
      lastSingleChainServerId = chainServerId;
      lastSingleAssetsResult = result;
      lastIsLpTokenEnabled = isLpTokenEnabled;
      return result;
    },
    forTokenSelect(
      address?: string,
      chainServerId?: string,
      keyword?: string,
      isLpTokenEnabled?: boolean,
    ) {
      const tokenListMap = get().tokenListMap || {};
      const normalizedAddress = address ? address.toLowerCase() : undefined;
      const normalizedKeyword = keyword ? keyword.toLowerCase() : undefined;
      if (
        lastTokenSelectResult &&
        lastTokenSelectListMap === tokenListMap &&
        lastTokenSelectChainServerId === chainServerId &&
        lastTokenSelectAddress === normalizedAddress &&
        lastTokenSelectKeyword === normalizedKeyword &&
        lastIsLpTokenEnabled === isLpTokenEnabled
      ) {
        return lastTokenSelectResult;
      }
      const tokens = normalizedAddress
        ? tokenListMap[normalizedAddress] || []
        : Object.values(tokenListMap).flat();
      const getUsdValue = (token: ITokenItem) =>
        token.usd_value || (token.price || 0) * (token.amount || 0);
      const filterAndSortTokens = (_list: ITokenItem[]) => {
        const list = _list.filter(i => lpTokenFilter(i, isLpTokenEnabled));
        if (!normalizedKeyword) {
          return sortByUsdValueDesc(list);
        }
        const keywordLower = normalizedKeyword;
        const filteredList = list.filter(item => {
          const matchKeyWords = [item.id, item.symbol];
          return matchKeyWords.some(i =>
            i?.toLowerCase().includes(keywordLower),
          );
        });
        return filteredList.sort((a, b) => {
          const aIdLower = a.id?.toLowerCase() || '';
          const bIdLower = b.id?.toLowerCase() || '';
          const aSymbolLower = a.symbol?.toLowerCase() || '';
          const bSymbolLower = b.symbol?.toLowerCase() || '';

          const aExactMatch =
            aIdLower === keywordLower || aSymbolLower === keywordLower;
          const bExactMatch =
            bIdLower === keywordLower || bSymbolLower === keywordLower;

          const getScore = (exactMatch: boolean, isCore: boolean) => {
            if (exactMatch && isCore) {
              return 4;
            }
            if (exactMatch && !isCore) {
              return 3;
            }
            if (!exactMatch && isCore) {
              return 2;
            }
            return 1;
          };

          const aScore = getScore(aExactMatch, a.is_core);
          const bScore = getScore(bExactMatch, b.is_core);
          if (aScore !== bScore) {
            return bScore - aScore;
          }

          if (a.is_suspicious !== b.is_suspicious) {
            return a.is_suspicious ? 1 : -1;
          }

          const aIdMatch = aIdLower.includes(keywordLower);
          const bIdMatch = bIdLower.includes(keywordLower);
          const aSymbolMatch = aSymbolLower.includes(keywordLower);
          const bSymbolMatch = bSymbolLower.includes(keywordLower);

          if (aIdMatch && !bIdMatch) {
            return -1;
          }
          if (!aIdMatch && bIdMatch) {
            return 1;
          }
          if (aSymbolMatch && !bSymbolMatch) {
            return -1;
          }
          if (!aSymbolMatch && bSymbolMatch) {
            return 1;
          }

          return getUsdValue(b) - getUsdValue(a);
        });
      };
      let sortedUnfoldTokens: ITokenItem[] = [];
      let sortedFoldTokens: ITokenItem[] = [];
      let sortedScamTokens: ITokenItem[] = [];
      if (normalizedKeyword || isLpTokenEnabled) {
        sortedUnfoldTokens = filterAndSortTokens(tokens);
      } else {
        const unFoldTokens: ITokenItem[] = [];
        const foldTokens: ITokenItem[] = [];
        const scamTokens: ITokenItem[] = [];
        tokens.forEach(token => {
          const usdValue = token.usd_value || 0;
          const isScam = !!token.is_scam || (!token.is_core && usdValue === 0);
          if (isScam) {
            scamTokens.push(token);
          } else if (token.is_core) {
            unFoldTokens.push(token);
          } else {
            foldTokens.push(token);
          }
        });

        sortedUnfoldTokens = sortByUsdValueDesc(unFoldTokens);
        sortedFoldTokens = sortByUsdValueDesc(foldTokens);
        sortedScamTokens = sortByUsdValueDesc(scamTokens);
      }

      const result = chainServerId
        ? {
            unFoldTokens: sortedUnfoldTokens.filter(
              item => item.chain === chainServerId,
            ),
            foldTokens: sortedFoldTokens.filter(
              item => item.chain === chainServerId,
            ),
            scamTokens: sortedScamTokens.filter(
              item => item.chain === chainServerId,
            ),
          }
        : {
            unFoldTokens: sortedUnfoldTokens,
            foldTokens: sortedFoldTokens,
            scamTokens: sortedScamTokens,
          };

      lastTokenSelectListMap = tokenListMap;
      lastTokenSelectChainServerId = chainServerId;
      lastTokenSelectAddress = normalizedAddress;
      lastTokenSelectKeyword = normalizedKeyword;
      lastIsLpTokenEnabled = isLpTokenEnabled;
      lastTokenSelectResult = result;

      return result;
    },
    forPerpsTokenSelect(address?: string) {
      const tokenListMap = get().tokenListMap || {};
      if (!address) {
        return [];
      }
      return (
        tokenListMap[address.toLowerCase()]
          ?.filter(item => item.is_core)
          .sort(compareByUsdValueDesc) || []
      );
    },
    forChainSelector(address?: string) {
      const tokenListMap = get().tokenListMap || {};
      if (address) {
        const normalizedAddress = address.toLowerCase();
        return (tokenListMap[normalizedAddress] || []).filter(
          item => item.is_core,
        );
      }
      return Object.values(tokenListMap)
        .flat()
        .filter(item => item.is_core);
    },

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

    async getTokenList(address: string, force = false) {
      const normalizedAddress = address.toLowerCase();
      if (!force) {
        const isExpired = await isDataExpired(normalizedAddress);
        if (!isExpired) {
          const tokens = (await TokenItemEntity.batchQueryTokens(
            normalizedAddress,
          )) as TokenItemEntity[];
          const res = tokens.map(tokenItemEntityToTokenItem);
          set(state => ({
            tokenListMap: {
              ...state.tokenListMap,
              [normalizedAddress]: res,
            },
          }));
          return;
        }
      }

      set(state => ({
        isLoadingByAddress: {
          ...state.isLoadingByAddress,
          [normalizedAddress]: true,
        },
      }));

      try {
        const cacheList = await queryTokensCache(address);
        const cacheTokens = cacheList.map(item =>
          tokenItemToITokenItem(item, address),
        );
        set(state => ({
          tokenListMap: {
            ...state.tokenListMap,
            [normalizedAddress]: cacheTokens,
          },
          isLoadingByAddress: {
            ...state.isLoadingByAddress,
            [normalizedAddress]: false,
          },
        }));

        let chainIdList: string[] = [];
        // 单地址的查询还是使用 usedChainList，不然担心 token 选择器之类的地方用户找不到自己的 token
        const chains = await openapi.usedChainList(address);
        chainIdList = chains.map(item => item.id);
        const realTimeTokenQueue = new PQueue({
          concurrency: 15,
        });
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

        syncRemoteTokens(normalizedAddress, results);
        set(state => ({
          tokenListMap: {
            ...state.tokenListMap,
            [normalizedAddress]: results,
          },
        }));
      } finally {
        set(state => ({
          isLoadingByAddress: {
            ...state.isLoadingByAddress,
            [normalizedAddress]: false,
          },
        }));
      }
    },
  };
});

export default tokenListStore;
