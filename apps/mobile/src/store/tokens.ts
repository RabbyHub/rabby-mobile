import { getTop10MyAccounts } from '@/core/apis/account';
import { openapi } from '@/core/request';
import { zCreate } from '@/core/utils/reexports';
import { TokenItemEntity } from '@/databases/entities/tokenitem';
import { syncRemoteTokens } from '@/databases/sync/assets';
import { queryTokensCache } from '@/screens/Home/utils/token';
import { defaultTokenFilter, lpTokenFilter } from '@/utils/lpToken';
import { requestOpenApiWithChainId } from '@/utils/openapi';
import {
  tokenItemEntityToTokenItem,
  tokenItemToITokenItem,
} from '@/utils/token';
import PQueue from 'p-queue';

const waitQueueFinished = (q: PQueue) => {
  return new Promise(resolve => {
    q.on('idle', () => {
      resolve(null);
    });
  });
};

export interface ITokenItem {
  amount: number;
  chain: string;
  decimals: number;
  display_symbol: string | null;
  id: string;
  is_core: boolean | null;
  is_verified: boolean | null;
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

type TokenAssetsResult = {
  unFoldTokens: ITokenItem[];
  foldTokens: ITokenItem[];
  scamTokens: ITokenItem[];
};

interface TokenListState {
  tokenListMap: Record<string, ITokenItem[]>;
  isLoading: boolean;
  isLoadingByAddress: Record<
    string,
    {
      loading: boolean;
      allLoading: boolean;
    }
  >;
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

const compareByUsdValueDesc = (a: ITokenItem, b: ITokenItem) => {
  if (a.is_core && !b.is_core) {
    return -1;
  }
  if (!a.is_core && b.is_core) {
    return 1;
  }
  const aValue = (a.price ?? 0) * (a.amount ?? 0);
  const bValue = (b.price ?? 0) * (b.amount ?? 0);
  return bValue - aValue;
};

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

const COMPUTED_CACHE_LIMIT = 10;

const createEmptyAssetsResult = (): TokenAssetsResult => ({
  unFoldTokens: [],
  foldTokens: [],
  scamTokens: [],
});

const normalizeAddresses = (addresses: string[]) =>
  addresses.map(address => address.toLowerCase());

const getAddressesKey = (addresses: string[]) =>
  normalizeAddresses(addresses).slice().sort().join('|');

export const getMultiAssetsCacheKey = (
  addresses: string[],
  chainServerId?: string,
  isLpTokenEnabled?: boolean,
) =>
  `${getAddressesKey(addresses)}::${chainServerId ?? ''}::${
    isLpTokenEnabled ? '1' : '0'
  }`;

export const getSingleAssetsCacheKey = (
  address: string,
  chainServerId?: string,
  isLpTokenEnabled?: boolean,
) =>
  `${address.toLowerCase()}::${chainServerId ?? ''}::${
    isLpTokenEnabled ? '1' : '0'
  }`;

export const getTokenSelectCacheKey = (
  addresses: string[],
  chainServerId?: string,
  keyword?: string,
  isLpTokenEnabled?: boolean,
) =>
  `${getAddressesKey(addresses)}::${chainServerId ?? ''}::${
    keyword ? keyword.toLowerCase() : ''
  }::${isLpTokenEnabled ? '1' : '0'}`;

export const getPerpsTokenSelectCacheKey = (address: string) =>
  address.toLowerCase();

export const getChainSelectorCacheKey = (addresses: string[]) =>
  getAddressesKey(addresses);

const computeMultiAssets = (
  tokenListMap: TokenListState['tokenListMap'],
  addresses: string[],
  chainServerId?: string,
  isLpTokenEnabled?: boolean,
): TokenAssetsResult => {
  if (!addresses.length) {
    return createEmptyAssetsResult();
  }
  const normalizedAddresses = normalizeAddresses(addresses);
  const tokens = normalizedAddresses.flatMap(
    address => tokenListMap[address] || [],
  );
  const scamTokens: ITokenItem[] = [];
  const nonScamTokens: ITokenItem[] = [];
  const coreTokens: ITokenItem[] = [];
  let totalValue = 0;
  tokens.forEach(token => {
    const usdValue = token.usd_value || 0;
    const isZeroCore = token.is_core && usdValue === 0;
    const isScam =
      token.is_verified === false ||
      (usdValue === 0 && !isZeroCore) ||
      token.is_suspicious;
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
  const { foldedTokens, unfoldedTokens } = getMultiAssetsFoldResultFromParts({
    nonScamTokens,
    coreTokens,
    totalValue,
  });
  return chainServerId
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
        scamTokens: scamTokens.filter(i => lpTokenFilter(i, isLpTokenEnabled)),
      };
};

const computeSingleAssets = (
  tokenListMap: TokenListState['tokenListMap'],
  address: string,
  chainServerId?: string,
  isLpTokenEnabled?: boolean,
): TokenAssetsResult => {
  if (!address) {
    return createEmptyAssetsResult();
  }
  const normalizedAddress = address.toLowerCase();
  const tokens = tokenListMap[normalizedAddress] || [];
  const scamTokens: ITokenItem[] = [];
  const nonScamTokens: ITokenItem[] = [];
  const coreTokens: ITokenItem[] = [];
  let totalValue = 0;
  tokens.forEach(token => {
    const usdValue = token.usd_value || 0;
    const isZeroCore = token.is_core && usdValue === 0;
    const isScam =
      token.is_verified === false ||
      (usdValue === 0 && !isZeroCore) ||
      token.is_suspicious;
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
  const { foldedTokens, unfoldedTokens } = getMultiAssetsFoldResultFromParts({
    nonScamTokens,
    coreTokens,
    totalValue,
  });
  return chainServerId
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
        scamTokens: scamTokens.filter(i => lpTokenFilter(i, isLpTokenEnabled)),
      };
};

const computeTokenSelect = (
  tokenListMap: TokenListState['tokenListMap'],
  addresses: string[],
  chainServerId?: string,
  keyword?: string,
  isLpTokenEnabled?: boolean,
): ITokenItem[] => {
  if (!addresses.length) {
    return [];
  }
  const normalizedAddresses = normalizeAddresses(addresses);
  const normalizedKeyword = keyword ? keyword.toLowerCase() : undefined;
  const tokens = normalizedAddresses.flatMap(
    address => tokenListMap[address] || [],
  );
  const getUsdValue = (token: ITokenItem) =>
    token.usd_value || (token.price || 0) * (token.amount || 0);
  const filterAndSortTokens = (_list: ITokenItem[]) => {
    const list = _list.filter(i => lpTokenFilter(i, isLpTokenEnabled));
    return sortByUsdValueDesc(list);
  };
  const searchAndSortTokens = (_list: ITokenItem[]) => {
    const keywordLower = normalizedKeyword;
    if (!keywordLower) {
      return [];
    }
    const filteredList = _list.filter(item => {
      if (item.is_verified === false) {
        return false;
      }
      if (item.is_core === false && !item.protocol_id) {
        return false;
      }
      const matchKeyWords = [item.id, item.symbol];
      return matchKeyWords.some(i => i?.toLowerCase().includes(keywordLower));
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

      const getScore = (exactMatch: boolean, isCore: boolean | null) => {
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
  if (normalizedKeyword) {
    sortedUnfoldTokens = searchAndSortTokens(tokens);
  } else if (isLpTokenEnabled) {
    sortedUnfoldTokens = filterAndSortTokens(tokens);
  } else {
    sortedUnfoldTokens = sortByUsdValueDesc(tokens.filter(defaultTokenFilter));
  }

  return chainServerId
    ? sortedUnfoldTokens.filter(item => item.chain === chainServerId)
    : sortedUnfoldTokens;
};

const computePerpsTokenSelect = (
  tokenListMap: TokenListState['tokenListMap'],
  address?: string,
): ITokenItem[] => {
  if (!address) {
    return [];
  }
  return (
    tokenListMap[address.toLowerCase()]
      ?.filter(item => item.is_core)
      .sort(compareByUsdValueDesc) || []
  );
};

const computeChainSelector = (
  tokenListMap: TokenListState['tokenListMap'],
  addresses: string[],
): ITokenItem[] => {
  if (!addresses.length) {
    return [];
  }
  const normalizedAddresses = normalizeAddresses(addresses);
  return normalizedAddresses
    .flatMap(address => tokenListMap[address] || [])
    .filter(item => item.is_core);
};

const tokenListStore = zCreate<TokenListState>(set => ({
  tokenListMap: {},
  isLoading: false, // 整体的 loading 状态
  // 单个地址的 loading 状态：cache token拿到loading设置false，等所有token都拿到allLoading才设置false
  isLoadingByAddress: {},
  async initStore() {
    // 在 App 启动时执行，初始化冷备数据
    // 取 Top10 地址
    const { top10Addresses } = await getTop10MyAccounts(true);
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
        const tokens = await TokenItemEntity.batchMultiAddressTokens(addresses);
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
        const chains = await openapi.usedChainList(address);
        const chainIdList = chains.map(item => item.id);
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
        [normalizedAddress]: { loading: true, allLoading: true },
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
          // cache已经拿到，但是不是所有token都拿到
          [normalizedAddress]: { loading: false, allLoading: true },
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
          [normalizedAddress]: { loading: false, allLoading: false },
        },
      }));
    }
  },
}));

type TokenListComputedState = {
  multiAssetsCache: Record<string, TokenAssetsResult>;
  singleAssetsCache: Record<string, TokenAssetsResult>;
  tokenSelectCache: Record<string, ITokenItem[]>;
  perpsTokenSelectCache: Record<string, ITokenItem[]>;
  chainSelectorCache: Record<string, ITokenItem[]>;
  registerMultiAssets: (
    addresses: string[],
    chainServerId?: string,
    isLpTokenEnabled?: boolean,
  ) => string;
  registerSingleAssets: (
    address: string,
    chainServerId?: string,
    isLpTokenEnabled?: boolean,
  ) => string;
  registerTokenSelect: (
    addresses: string[],
    chainServerId?: string,
    keyword?: string,
    isLpTokenEnabled?: boolean,
  ) => string;
  registerPerpsTokenSelect: (address?: string) => string | null;
  registerChainSelector: (addresses: string[]) => string;
};

const multiAssetsCacheParams = new Map<
  string,
  {
    addresses: string[];
    chainServerId?: string;
    isLpTokenEnabled?: boolean;
  }
>();
const singleAssetsCacheParams = new Map<
  string,
  {
    address: string;
    chainServerId?: string;
    isLpTokenEnabled?: boolean;
  }
>();
const tokenSelectCacheParams = new Map<
  string,
  {
    addresses: string[];
    chainServerId?: string;
    keyword?: string;
    isLpTokenEnabled?: boolean;
  }
>();
const perpsTokenSelectCacheParams = new Map<string, { address: string }>();
const chainSelectorCacheParams = new Map<string, { addresses: string[] }>();
const multiAssetsCacheOrder: string[] = [];
const singleAssetsCacheOrder: string[] = [];
const tokenSelectCacheOrder: string[] = [];
const perpsTokenSelectCacheOrder: string[] = [];
const chainSelectorCacheOrder: string[] = [];

const removeKeysFromCache = <T extends Record<string, unknown>>(
  cache: T,
  keys: string[],
) => {
  if (!keys.length) {
    return cache;
  }
  const next = { ...cache };
  keys.forEach(key => {
    delete next[key];
  });
  return next;
};

const touchCacheParams = <T>(
  map: Map<string, T>,
  order: string[],
  key: string,
  params: T,
  limit = COMPUTED_CACHE_LIMIT,
) => {
  if (map.has(key)) {
    map.set(key, params);
    const index = order.indexOf(key);
    if (index > -1) {
      order.splice(index, 1);
    }
    order.push(key);
    return [] as string[];
  }
  map.set(key, params);
  order.push(key);
  if (order.length > limit) {
    const removed = order.shift();
    if (removed) {
      map.delete(removed);
      return [removed];
    }
  }
  return [] as string[];
};

export const EMPTY_TOKEN_LIST = [];
export const useTokenListComputedStore = zCreate<TokenListComputedState>(
  set => ({
    multiAssetsCache: {},
    singleAssetsCache: {},
    tokenSelectCache: {},
    perpsTokenSelectCache: {},
    chainSelectorCache: {},
    registerMultiAssets(addresses, chainServerId, isLpTokenEnabled) {
      const key = getMultiAssetsCacheKey(
        addresses,
        chainServerId,
        isLpTokenEnabled,
      );
      const removedKeys = touchCacheParams(
        multiAssetsCacheParams,
        multiAssetsCacheOrder,
        key,
        {
          addresses,
          chainServerId,
          isLpTokenEnabled,
        },
      );
      const tokenListMap = tokenListStore.getState().tokenListMap;
      set(state => ({
        multiAssetsCache: removeKeysFromCache(
          {
            ...state.multiAssetsCache,
            [key]: computeMultiAssets(
              tokenListMap,
              addresses,
              chainServerId,
              isLpTokenEnabled,
            ),
          },
          removedKeys,
        ),
      }));
      return key;
    },
    registerSingleAssets(address, chainServerId, isLpTokenEnabled) {
      const key = getSingleAssetsCacheKey(
        address,
        chainServerId,
        isLpTokenEnabled,
      );
      const removedKeys = touchCacheParams(
        singleAssetsCacheParams,
        singleAssetsCacheOrder,
        key,
        {
          address,
          chainServerId,
          isLpTokenEnabled,
        },
      );
      const tokenListMap = tokenListStore.getState().tokenListMap;
      set(state => ({
        singleAssetsCache: removeKeysFromCache(
          {
            ...state.singleAssetsCache,
            [key]: computeSingleAssets(
              tokenListMap,
              address,
              chainServerId,
              isLpTokenEnabled,
            ),
          },
          removedKeys,
        ),
      }));
      return key;
    },
    registerTokenSelect(addresses, chainServerId, keyword, isLpTokenEnabled) {
      const key = getTokenSelectCacheKey(
        addresses,
        chainServerId,
        keyword,
        isLpTokenEnabled,
      );
      const removedKeys = touchCacheParams(
        tokenSelectCacheParams,
        tokenSelectCacheOrder,
        key,
        {
          addresses,
          chainServerId,
          keyword,
          isLpTokenEnabled,
        },
      );
      const tokenListMap = tokenListStore.getState().tokenListMap;
      set(state => ({
        tokenSelectCache: removeKeysFromCache(
          {
            ...state.tokenSelectCache,
            [key]: computeTokenSelect(
              tokenListMap,
              addresses,
              chainServerId,
              keyword,
              isLpTokenEnabled,
            ),
          },
          removedKeys,
        ),
      }));
      return key;
    },
    registerPerpsTokenSelect(address) {
      if (!address) {
        return null;
      }
      const key = getPerpsTokenSelectCacheKey(address);
      const removedKeys = touchCacheParams(
        perpsTokenSelectCacheParams,
        perpsTokenSelectCacheOrder,
        key,
        {
          address,
        },
      );
      const tokenListMap = tokenListStore.getState().tokenListMap;
      set(state => ({
        perpsTokenSelectCache: removeKeysFromCache(
          {
            ...state.perpsTokenSelectCache,
            [key]: computePerpsTokenSelect(tokenListMap, address),
          },
          removedKeys,
        ),
      }));
      return key;
    },
    registerChainSelector(addresses) {
      const key = getChainSelectorCacheKey(addresses);
      const removedKeys = touchCacheParams(
        chainSelectorCacheParams,
        chainSelectorCacheOrder,
        key,
        {
          addresses,
        },
      );
      const tokenListMap = tokenListStore.getState().tokenListMap;
      set(state => ({
        chainSelectorCache: removeKeysFromCache(
          {
            ...state.chainSelectorCache,
            [key]: computeChainSelector(tokenListMap, addresses),
          },
          removedKeys,
        ),
      }));
      return key;
    },
  }),
);

const rebuildComputedCaches = (
  tokenListMap: TokenListState['tokenListMap'],
) => {
  const multiAssetsCache: Record<string, TokenAssetsResult> = {};
  multiAssetsCacheParams.forEach((params, key) => {
    multiAssetsCache[key] = computeMultiAssets(
      tokenListMap,
      params.addresses,
      params.chainServerId,
      params.isLpTokenEnabled,
    );
  });

  const singleAssetsCache: Record<string, TokenAssetsResult> = {};
  singleAssetsCacheParams.forEach((params, key) => {
    singleAssetsCache[key] = computeSingleAssets(
      tokenListMap,
      params.address,
      params.chainServerId,
      params.isLpTokenEnabled,
    );
  });

  const tokenSelectCache: Record<string, ITokenItem[]> = {};
  tokenSelectCacheParams.forEach((params, key) => {
    tokenSelectCache[key] = computeTokenSelect(
      tokenListMap,
      params.addresses,
      params.chainServerId,
      params.keyword,
      params.isLpTokenEnabled,
    );
  });

  const perpsTokenSelectCache: Record<string, ITokenItem[]> = {};
  perpsTokenSelectCacheParams.forEach((params, key) => {
    perpsTokenSelectCache[key] = computePerpsTokenSelect(
      tokenListMap,
      params.address,
    );
  });

  const chainSelectorCache: Record<string, ITokenItem[]> = {};
  chainSelectorCacheParams.forEach((params, key) => {
    chainSelectorCache[key] = computeChainSelector(
      tokenListMap,
      params.addresses,
    );
  });

  useTokenListComputedStore.setState({
    multiAssetsCache,
    singleAssetsCache,
    tokenSelectCache,
    perpsTokenSelectCache,
    chainSelectorCache,
  });
};

tokenListStore.subscribe(state => {
  rebuildComputedCaches(state.tokenListMap);
});

export default tokenListStore;
