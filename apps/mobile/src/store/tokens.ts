import { getTop10MyAccounts } from '@/core/apis/account';
import { queryTokensCache } from '@/core/apis/tokenCache';
import { openapi } from '@/core/request';
import { mCreate, zCreate } from '@/core/utils/reexports';
import { TokenItemEntity } from '@/databases/entities/tokenitem';
import { syncRemoteTokens } from '@/databases/sync/assets';
import { defaultTokenFilter, lpTokenFilter } from '@/utils/lpToken';
import { requestOpenApiWithChainId } from '@/utils/openapi';
import { preferenceService } from '@/core/services/shared';
import { getTokenSymbol } from '@/utils/token';
import {
  tokenItemEntityToTokenItem,
  tokenItemToITokenItem,
} from '@/utils/token';
import type {
  ITokenItem,
  TokenAssetsResult,
  TokenDisplayMode,
} from '@/types/assets';
import PQueue from 'p-queue';
import { ResourceBaseStore } from './_resourceBase';
import type { ObservableResourceValueSource } from './_resourceFlow';

export type { ITokenItem, TokenAssetsResult } from '@/types/assets';

const waitQueueFinished = (q: PQueue) => {
  return new Promise(resolve => {
    q.on('idle', () => {
      resolve(null);
    });
  });
};

interface TokenListState {
  tokenListMap: Record<string, ITokenItem[]>;
  isLoading: boolean;
  tokenDisplayMode: TokenDisplayMode;
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
  setTokenDisplayMode(mode: TokenDisplayMode): void;
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
    listLength > 3 && thresholdIndex > -1 && thresholdIndex <= listLength - 4;

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

const replacePreviousCoreTokensWithCacheTokens = (
  previousTokens: ITokenItem[],
  cacheTokens: ITokenItem[],
) => {
  const previousNonCoreTokens = previousTokens.filter(token => !token.is_core);

  return [...cacheTokens, ...previousNonCoreTokens];
};

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
  hasFoldTokens: false,
});

const normalizeAddresses = (addresses: string[]) =>
  addresses.map(address => address.toLowerCase());

const getAddressesKey = (addresses: string[]) =>
  normalizeAddresses(addresses).slice().sort().join('|');

export const getMultiAssetsCacheKey = (
  addresses: string[],
  chainServerId?: string,
  isLpTokenEnabled?: boolean,
  tokenDisplayMode?: TokenDisplayMode,
) =>
  `${getAddressesKey(addresses)}::${chainServerId ?? ''}::${
    isLpTokenEnabled ? '1' : '0'
  }::${tokenDisplayMode ?? 'byAddress'}`;

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

export type TokenEntityId = string & {
  readonly __tokenEntityId: unique symbol;
};

export type TokenGroupId = string & {
  readonly __tokenGroupId: unique symbol;
};

export type TokenAssetsIndexRow =
  | {
      type: 'token';
      tokenId: TokenEntityId;
    }
  | {
      type: 'group';
      groupId: TokenGroupId;
    };

export type TokenSelectIndexRow = {
  type: 'token';
  tokenId: TokenEntityId;
};

export type TokenAssetsIndexResult = {
  unFoldRows: TokenAssetsIndexRow[];
  foldRows: TokenAssetsIndexRow[];
  scamRows: TokenAssetsIndexRow[];
  unFoldTokenIds: TokenEntityId[];
  foldTokenIds: TokenEntityId[];
  scamTokenIds: TokenEntityId[];
  scamTokenPreviewLogoUrls: string[];
  foldCoreUsdValue: number;
  hasFoldTokens: boolean;
};

export type TokenGroupResourceValue = {
  groupKey: string;
  primaryTokenId: TokenEntityId;
  memberTokenIds: TokenEntityId[];
  summary: ITokenItem;
};

const TOKEN_ENTITY_RESOURCE_FAMILY = 'token.entity';
const TOKEN_GROUP_RESOURCE_FAMILY = 'token.group';

const createEmptyAssetsIndexResult = (): TokenAssetsIndexResult => ({
  unFoldRows: [],
  foldRows: [],
  scamRows: [],
  unFoldTokenIds: [],
  foldTokenIds: [],
  scamTokenIds: [],
  scamTokenPreviewLogoUrls: [],
  foldCoreUsdValue: 0,
  hasFoldTokens: false,
});

export const buildTokenEntityId = (
  token: Pick<ITokenItem, 'owner_addr' | 'chain' | 'id'>,
): TokenEntityId =>
  [
    token.owner_addr.toLowerCase(),
    token.chain.toLowerCase(),
    token.id.toLowerCase(),
  ].join(':') as TokenEntityId;

const getTokenListFromTokenMap = (
  tokenListMap: TokenListState['tokenListMap'],
) => Object.values(tokenListMap).flat();

class TokenEntityResourceStore extends ResourceBaseStore<ITokenItem> {
  constructor() {
    super(TOKEN_ENTITY_RESOURCE_FAMILY, { mutative: true });
  }

  upsertTokens = (
    tokens: ITokenItem[],
    source: ObservableResourceValueSource = 'remote',
    options?: {
      pruneMissing?: boolean;
    },
  ) => {
    if (!tokens.length && !options?.pruneMissing) {
      return;
    }

    const entries = new Map<TokenEntityId, ITokenItem>();
    tokens.forEach(token => {
      entries.set(buildTokenEntityId(token), token);
    });

    const now = Date.now();
    const prev = this.getState();
    const changedTokens: Array<{
      tokenId: TokenEntityId;
      token: ITokenItem;
      meta: (typeof prev.metaMap)[string];
    }> = [];

    entries.forEach((token, tokenId) => {
      const prevToken = prev.valueMap[tokenId];
      const prevMeta = prev.metaMap[tokenId];
      const isTokenChanged = prevToken !== token;

      if (!prevMeta || isTokenChanged) {
        changedTokens.push({
          tokenId,
          token,
          meta: {
            family: TOKEN_ENTITY_RESOURCE_FAMILY,
            resourceKey: tokenId,
            hasValue: true,
            version: Math.max(prevMeta?.version || 0, 0) + 1,
            sourceOfCurrentValue: source,
            isHydrating: false,
            isFetchingRemote: false,
            persistStatus: prevMeta?.persistStatus || 'idle',
            localTargets: prevMeta?.localTargets || [],
            activeRemoteRequestId: undefined,
            lastHydratedAt:
              source === 'hydrate' ? now : prevMeta?.lastHydratedAt,
            lastRemoteAt: source === 'remote' ? now : prevMeta?.lastRemoteAt,
            lastPersistAt: prevMeta?.lastPersistAt,
            lastError: prevMeta?.lastError,
          },
        });
      }
    });

    const removedTokenIds = options?.pruneMissing
      ? Array.from(
          new Set([
            ...Object.keys(prev.valueMap),
            ...Object.keys(prev.metaMap),
          ]),
        ).filter(tokenId => !entries.has(tokenId as TokenEntityId))
      : [];

    if (!changedTokens.length && !removedTokenIds.length) {
      return;
    }

    this.mutateState(draft => {
      changedTokens.forEach(({ tokenId, token, meta }) => {
        draft.valueMap[tokenId] = token;
        draft.metaMap[tokenId] = meta;
      });

      removedTokenIds.forEach(tokenId => {
        delete draft.valueMap[tokenId];
        delete draft.metaMap[tokenId];
      });
    });
  };

  syncFromTokenListMap = (
    tokenListMap: TokenListState['tokenListMap'],
    source: ObservableResourceValueSource = 'remote',
  ) => {
    this.upsertTokens(getTokenListFromTokenMap(tokenListMap), source, {
      pruneMissing: true,
    });
  };
}

class TokenGroupResourceStore extends ResourceBaseStore<TokenGroupResourceValue> {
  constructor() {
    super(TOKEN_GROUP_RESOURCE_FAMILY, { mutative: true });
  }

  upsertGroups = (
    groups: Array<{ groupId: TokenGroupId; value: TokenGroupResourceValue }>,
    source: ObservableResourceValueSource = 'remote',
  ) => {
    if (!groups.length) {
      return;
    }

    const now = Date.now();
    const prev = this.getState();
    const changedGroups: Array<{
      groupId: TokenGroupId;
      value: TokenGroupResourceValue;
      meta: (typeof prev.metaMap)[string];
    }> = [];

    groups.forEach(({ groupId, value }) => {
      const prevValue = prev.valueMap[groupId];
      const prevMeta = prev.metaMap[groupId];
      const isValueChanged = prevValue !== value;

      if (!prevMeta || isValueChanged) {
        changedGroups.push({
          groupId,
          value,
          meta: {
            family: TOKEN_GROUP_RESOURCE_FAMILY,
            resourceKey: groupId,
            hasValue: true,
            version: Math.max(prevMeta?.version || 0, 0) + 1,
            sourceOfCurrentValue: source,
            isHydrating: false,
            isFetchingRemote: false,
            persistStatus: prevMeta?.persistStatus || 'idle',
            localTargets: prevMeta?.localTargets || [],
            activeRemoteRequestId: undefined,
            lastHydratedAt:
              source === 'hydrate' ? now : prevMeta?.lastHydratedAt,
            lastRemoteAt: source === 'remote' ? now : prevMeta?.lastRemoteAt,
            lastPersistAt: prevMeta?.lastPersistAt,
            lastError: prevMeta?.lastError,
          },
        });
      }
    });

    if (!changedGroups.length) {
      return;
    }

    this.mutateState(draft => {
      changedGroups.forEach(({ groupId, value, meta }) => {
        draft.valueMap[groupId] = value;
        draft.metaMap[groupId] = meta;
      });
    });
  };
}

export const tokenEntityResourceStore = new TokenEntityResourceStore();
export const tokenGroupResourceStore = new TokenGroupResourceStore();

export const useTokenEntity = (tokenId?: TokenEntityId) =>
  tokenEntityResourceStore.useValue(tokenId);

export const useTokenGroup = (groupId?: TokenGroupId) =>
  tokenGroupResourceStore.useValue(groupId);

export const getTokenAssetsIndexRowKey = (row: TokenAssetsIndexRow) => {
  if (row.type === 'group') {
    return `group-${row.groupId}`;
  }
  return `token-${row.tokenId}`;
};

export const getTokenSelectIndexRowKey = (row: TokenSelectIndexRow) =>
  `token-${row.tokenId}`;

const getTokenRuntimeGroupItems = (token: ITokenItem) =>
  (token as { groupItems?: ITokenItem[] }).groupItems;

const getTokenRuntimeGroupKey = (token: ITokenItem) =>
  (token as { groupKey?: string }).groupKey;

const stripTokenRuntimeGroupFields = (token: ITokenItem): ITokenItem => {
  const rest = {
    ...(token as ITokenItem & {
      groupItems?: ITokenItem[];
      groupKey?: string;
    }),
  };
  delete rest.groupItems;
  delete rest.groupKey;

  return rest;
};

const buildTokenGroupId = (
  listKey: string,
  section: 'unfold' | 'fold' | 'scam',
  token: ITokenItem,
): TokenGroupId => {
  const groupKey = getTokenRuntimeGroupKey(token) || buildTokenEntityId(token);
  return `${listKey}::${section}::${groupKey}` as TokenGroupId;
};

const buildTokenAssetsIndexRows = (
  tokens: ITokenItem[],
  section: 'unfold' | 'fold' | 'scam',
  listKey?: string,
) => {
  const groups: Array<{
    groupId: TokenGroupId;
    value: TokenGroupResourceValue;
  }> = [];
  const rows = tokens.map(token => {
    const groupItems = getTokenRuntimeGroupItems(token);

    if (listKey && groupItems?.length) {
      const groupId = buildTokenGroupId(listKey, section, token);
      const memberTokenIds = groupItems.map(buildTokenEntityId);
      groups.push({
        groupId,
        value: {
          groupKey: getTokenRuntimeGroupKey(token) || groupId,
          primaryTokenId: buildTokenEntityId(token),
          memberTokenIds,
          summary: stripTokenRuntimeGroupFields(token),
        },
      });
      return {
        type: 'group',
        groupId,
      } satisfies TokenAssetsIndexRow;
    }

    return {
      type: 'token',
      tokenId: buildTokenEntityId(token),
    } satisfies TokenAssetsIndexRow;
  });

  if (groups.length) {
    const groupTokens = tokens.flatMap(token => {
      return getTokenRuntimeGroupItems(token) || [];
    });
    tokenEntityResourceStore.upsertTokens(groupTokens);
    tokenGroupResourceStore.upsertGroups(groups);
  }

  return rows;
};

const buildTokenAssetsIndexResult = (
  result: TokenAssetsResult,
  listKey?: string,
): TokenAssetsIndexResult => {
  const unFoldRows = buildTokenAssetsIndexRows(
    result.unFoldTokens,
    'unfold',
    listKey,
  );
  const foldRows = buildTokenAssetsIndexRows(
    result.foldTokens,
    'fold',
    listKey,
  );
  const scamRows = buildTokenAssetsIndexRows(
    result.scamTokens,
    'scam',
    listKey,
  );

  return {
    unFoldRows,
    foldRows,
    scamRows,
    unFoldTokenIds: result.unFoldTokens.map(buildTokenEntityId),
    foldTokenIds: result.foldTokens.map(buildTokenEntityId),
    scamTokenIds: result.scamTokens.map(buildTokenEntityId),
    scamTokenPreviewLogoUrls: result.scamTokens
      .slice(0, 3)
      .map(token => token.logo_url),
    foldCoreUsdValue: result.foldTokens
      .filter(token => token.is_core)
      .reduce((total, token) => total + (token.usd_value || 0), 0),
    hasFoldTokens: result.hasFoldTokens,
  };
};

type AggregatedTokenItem = ITokenItem & {
  groupKey: string;
  groupItems: ITokenItem[];
};

const getTokenGroupKey = (token: ITokenItem, mode: TokenDisplayMode) => {
  if (mode === 'bySymbol') {
    const symbolKey = getTokenSymbol(token)?.trim().toLowerCase();
    return symbolKey || `${token.chain}::${token.id}`;
  }
  return `${token.chain}::${token.id}`;
};

const aggregateTokens = (
  tokens: ITokenItem[],
  mode: TokenDisplayMode,
): AggregatedTokenItem[] => {
  const grouped = new Map<string, ITokenItem[]>();
  tokens.forEach(token => {
    const key = getTokenGroupKey(token, mode);
    const list = grouped.get(key);
    if (list) {
      list.push(token);
    } else {
      grouped.set(key, [token]);
    }
  });

  return Array.from(grouped.entries()).map(([groupKey, groupItems]) => {
    const primary = groupItems.reduce((best, item) => {
      const bestValue = best?.usd_value || 0;
      const nextValue = item.usd_value || 0;
      return nextValue > bestValue ? item : best;
    }, groupItems[0])!;

    const totalAmount = groupItems.reduce(
      (sum, item) => sum + (item.amount || 0),
      0,
    );
    const totalUsdValue = groupItems.reduce(
      (sum, item) => sum + (item.usd_value || 0),
      0,
    );

    return {
      ...primary,
      amount: totalAmount,
      usd_value: totalUsdValue,
      groupKey,
      groupItems,
    };
  });
};

const computeMultiAssets = (
  tokenListMap: TokenListState['tokenListMap'],
  addresses: string[],
  chainServerId?: string,
  isLpTokenEnabled?: boolean,
  tokenDisplayMode?: TokenDisplayMode,
): TokenAssetsResult => {
  if (!addresses.length) {
    return createEmptyAssetsResult();
  }
  const normalizedAddresses = normalizeAddresses(addresses);
  const allTokens = normalizedAddresses.flatMap(
    address => tokenListMap[address] || [],
  );
  const tokens = chainServerId
    ? allTokens.filter(item => item.chain === chainServerId)
    : allTokens;
  const scamTokens: ITokenItem[] = [];
  const nonScamTokens: ITokenItem[] = [];
  tokens.forEach(token => {
    const usdValue = token.usd_value || 0;
    const isLowValueToken = token.is_core === null && usdValue === 0;
    const isScam = token.is_verified === false || token.is_suspicious;
    if (!isScam) {
      if (isLowValueToken) {
        scamTokens.push(token);
      } else {
        nonScamTokens.push(token);
      }
    }
  });
  const displayMode = tokenDisplayMode || 'byAddress';
  const aggregatedNonScamTokens =
    displayMode === 'byAddress'
      ? nonScamTokens
      : aggregateTokens(nonScamTokens, displayMode);
  const aggregatedScamTokens =
    displayMode === 'byAddress'
      ? scamTokens
      : aggregateTokens(scamTokens, displayMode);
  const coreTokens = aggregatedNonScamTokens.filter(token => token.is_core);
  const totalValue = coreTokens.reduce(
    (sum, token) => sum + (token.usd_value || 0),
    0,
  );

  const { foldedTokens, unfoldedTokens } = getMultiAssetsFoldResultFromParts({
    nonScamTokens: aggregatedNonScamTokens,
    coreTokens,
    totalValue,
  });
  return {
    unFoldTokens: unfoldedTokens,
    hasFoldTokens: foldedTokens.length > 0 || aggregatedScamTokens.length > 0,
    foldTokens: foldedTokens.filter(i => lpTokenFilter(i, isLpTokenEnabled)),
    scamTokens: aggregatedScamTokens.filter(i =>
      lpTokenFilter(i, isLpTokenEnabled),
    ),
  };
};

const computeMultiAssetsIndex = (
  tokenListMap: TokenListState['tokenListMap'],
  addresses: string[],
  chainServerId?: string,
  isLpTokenEnabled?: boolean,
  tokenDisplayMode?: TokenDisplayMode,
  listKey?: string,
): TokenAssetsIndexResult => {
  if (!addresses.length) {
    return createEmptyAssetsIndexResult();
  }

  return buildTokenAssetsIndexResult(
    computeMultiAssets(
      tokenListMap,
      addresses,
      chainServerId,
      isLpTokenEnabled,
      tokenDisplayMode,
    ),
    listKey,
  );
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
        hasFoldTokens:
          foldedTokens.filter(item => item.chain === chainServerId).length >
            0 ||
          scamTokens.filter(item => item.chain === chainServerId).length > 0,
        foldTokens: foldedTokens
          .filter(item => item.chain === chainServerId)
          .filter(i => lpTokenFilter(i, isLpTokenEnabled)),
        scamTokens: scamTokens
          .filter(item => item.chain === chainServerId)
          .filter(i => lpTokenFilter(i, isLpTokenEnabled)),
      }
    : {
        unFoldTokens: unfoldedTokens,
        hasFoldTokens: foldedTokens.length > 0 || scamTokens.length > 0,
        foldTokens: foldedTokens.filter(i =>
          lpTokenFilter(i, isLpTokenEnabled),
        ),
        scamTokens: scamTokens.filter(i => lpTokenFilter(i, isLpTokenEnabled)),
      };
};

const computeSingleAssetsIndex = (
  tokenListMap: TokenListState['tokenListMap'],
  address: string,
  chainServerId?: string,
  isLpTokenEnabled?: boolean,
): TokenAssetsIndexResult => {
  if (!address) {
    return createEmptyAssetsIndexResult();
  }

  return buildTokenAssetsIndexResult(
    computeSingleAssets(tokenListMap, address, chainServerId, isLpTokenEnabled),
  );
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

const buildTokenSelectIndexRows = (
  tokens: ITokenItem[],
): TokenSelectIndexRow[] => {
  tokenEntityResourceStore.upsertTokens(tokens);
  return tokens.map(token => ({
    type: 'token',
    tokenId: buildTokenEntityId(token),
  }));
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
  tokenDisplayMode: preferenceService.getTokenDisplayMode(),
  // 单个地址的 loading 状态：cache token拿到loading设置false，等所有token都拿到allLoading才设置false
  isLoadingByAddress: {},
  setTokenDisplayMode(mode) {
    set(() => ({ tokenDisplayMode: mode }));
    preferenceService.setTokenDisplayMode(mode);
  },
  async initStore() {
    // 在 App 启动时执行，初始化冷备数据
    // 取 Top10 地址
    const { top10Addresses } = await getTop10MyAccounts(true);
    const lowerAddresses = Array.from(
      new Set(top10Addresses.map(item => item.toLowerCase())),
    );
    const tokenMap = await TokenItemEntity.getDefaultTokensByAddresses(
      lowerAddresses,
    );
    // 写入 Store
    set(() => ({ tokenListMap: tokenMap }));
  },

  async batchGetTokenList(addresses: string[], force = false) {
    const lowerAddresses = Array.from(
      new Set(addresses.map(item => item.toLowerCase())),
    );
    if (!lowerAddresses.length) {
      set(() => ({ isLoading: true }));
      await new Promise(resolve => setTimeout(resolve, 0));
      set(() => ({ tokenListMap: {}, isLoading: false }));
      return;
    }
    if (!force) {
      const isExpired = await isDataExpiredBatch(lowerAddresses);
      if (!isExpired) {
        const tokens = await TokenItemEntity.batchMultiAddressTokens(
          lowerAddresses,
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
        set(() => ({ tokenListMap: res, isLoading: false }));
        return;
      }
    }
    set(() => ({ isLoading: true }));
    const cacheTokenQueue = new PQueue({
      concurrency: 5,
    });
    const cacheTokenMap: Record<string, ITokenItem[]> = {};
    lowerAddresses.forEach(address => {
      cacheTokenQueue.add(async () => {
        const list = await queryTokensCache(address);
        cacheTokenMap[address.toLowerCase()] = list.map(item =>
          tokenItemToITokenItem(item, address),
        );
      });
    });
    await waitQueueFinished(cacheTokenQueue);
    set(state => {
      const mergedCacheTokenMap = { ...state.tokenListMap };
      lowerAddresses.forEach(address => {
        const normalizedAddress = address.toLowerCase();
        const previousTokens = state.tokenListMap[normalizedAddress] || [];
        const cacheTokens = cacheTokenMap[normalizedAddress] || [];
        mergedCacheTokenMap[normalizedAddress] =
          replacePreviousCoreTokensWithCacheTokens(previousTokens, cacheTokens);
      });
      return { tokenListMap: mergedCacheTokenMap };
    });
    const realTimeTokenMap: Record<string, ITokenItem[]> = {};
    const realTimeTokenQueue = new PQueue({
      concurrency: 15,
    });
    await Promise.allSettled(
      lowerAddresses.map(async address => {
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
      set(state => {
        const previousTokens = state.tokenListMap[normalizedAddress] || [];
        const mergedCacheTokens = replacePreviousCoreTokensWithCacheTokens(
          previousTokens,
          cacheTokens,
        );
        return {
          tokenListMap: {
            ...state.tokenListMap,
            [normalizedAddress]: mergedCacheTokens,
          },
          isLoadingByAddress: {
            ...state.isLoadingByAddress,
            // cache已经拿到，但是不是所有token都拿到
            [normalizedAddress]: { loading: false, allLoading: true },
          },
        };
      });

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
  multiAssetsIndexCache: Record<string, TokenAssetsIndexResult>;
  singleAssetsIndexCache: Record<string, TokenAssetsIndexResult>;
  tokenSelectCache: Record<string, ITokenItem[]>;
  tokenSelectIndexCache: Record<string, TokenSelectIndexRow[]>;
  perpsTokenSelectCache: Record<string, ITokenItem[]>;
  chainSelectorCache: Record<string, ITokenItem[]>;
  registerMultiAssets: (
    addresses: string[],
    chainServerId?: string,
    isLpTokenEnabled?: boolean,
    tokenDisplayMode?: TokenDisplayMode,
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

const multiAssetsIndexCacheParams = new Map<
  string,
  {
    addresses: string[];
    chainServerId?: string;
    isLpTokenEnabled?: boolean;
    tokenDisplayMode?: TokenDisplayMode;
  }
>();
const singleAssetsIndexCacheParams = new Map<
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
const multiAssetsIndexCacheOrder: string[] = [];
const singleAssetsIndexCacheOrder: string[] = [];
const tokenSelectCacheOrder: string[] = [];
const perpsTokenSelectCacheOrder: string[] = [];
const chainSelectorCacheOrder: string[] = [];

const upsertRecordCache = <T>(
  cache: Record<string, T>,
  key: string,
  value: T,
  keys: string[],
) => {
  return mCreate(cache, draft => {
    const record = draft as Record<string, T>;
    record[key] = value;
    keys.forEach(removedKey => {
      delete record[removedKey];
    });
  });
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
    multiAssetsIndexCache: {},
    singleAssetsIndexCache: {},
    tokenSelectCache: {},
    tokenSelectIndexCache: {},
    perpsTokenSelectCache: {},
    chainSelectorCache: {},
    registerMultiAssets(
      addresses,
      chainServerId,
      isLpTokenEnabled,
      tokenDisplayMode,
    ) {
      const key = getMultiAssetsCacheKey(
        addresses,
        chainServerId,
        isLpTokenEnabled,
        tokenDisplayMode,
      );
      const removedKeys = touchCacheParams(
        multiAssetsIndexCacheParams,
        multiAssetsIndexCacheOrder,
        key,
        {
          addresses,
          chainServerId,
          isLpTokenEnabled,
          tokenDisplayMode,
        },
      );
      const tokenListMap = tokenListStore.getState().tokenListMap;
      tokenEntityResourceStore.syncFromTokenListMap(tokenListMap);
      set(state => ({
        multiAssetsIndexCache: upsertRecordCache(
          state.multiAssetsIndexCache,
          key,
          computeMultiAssetsIndex(
            tokenListMap,
            addresses,
            chainServerId,
            isLpTokenEnabled,
            tokenDisplayMode,
            key,
          ),
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
        singleAssetsIndexCacheParams,
        singleAssetsIndexCacheOrder,
        key,
        {
          address,
          chainServerId,
          isLpTokenEnabled,
        },
      );
      const tokenListMap = tokenListStore.getState().tokenListMap;
      tokenEntityResourceStore.syncFromTokenListMap(tokenListMap);
      set(state => ({
        singleAssetsIndexCache: upsertRecordCache(
          state.singleAssetsIndexCache,
          key,
          computeSingleAssetsIndex(
            tokenListMap,
            address,
            chainServerId,
            isLpTokenEnabled,
          ),
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
      tokenEntityResourceStore.syncFromTokenListMap(tokenListMap);
      const tokenSelect = computeTokenSelect(
        tokenListMap,
        addresses,
        chainServerId,
        keyword,
        isLpTokenEnabled,
      );
      set(state => ({
        tokenSelectCache: upsertRecordCache(
          state.tokenSelectCache,
          key,
          tokenSelect,
          removedKeys,
        ),
        tokenSelectIndexCache: upsertRecordCache(
          state.tokenSelectIndexCache,
          key,
          buildTokenSelectIndexRows(tokenSelect),
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
        perpsTokenSelectCache: upsertRecordCache(
          state.perpsTokenSelectCache,
          key,
          computePerpsTokenSelect(tokenListMap, address),
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
        chainSelectorCache: upsertRecordCache(
          state.chainSelectorCache,
          key,
          computeChainSelector(tokenListMap, addresses),
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
  tokenEntityResourceStore.syncFromTokenListMap(tokenListMap);

  const multiAssetsIndexCache: Record<string, TokenAssetsIndexResult> = {};
  multiAssetsIndexCacheParams.forEach((params, key) => {
    multiAssetsIndexCache[key] = computeMultiAssetsIndex(
      tokenListMap,
      params.addresses,
      params.chainServerId,
      params.isLpTokenEnabled,
      params.tokenDisplayMode,
      key,
    );
  });

  const singleAssetsIndexCache: Record<string, TokenAssetsIndexResult> = {};
  singleAssetsIndexCacheParams.forEach((params, key) => {
    singleAssetsIndexCache[key] = computeSingleAssetsIndex(
      tokenListMap,
      params.address,
      params.chainServerId,
      params.isLpTokenEnabled,
    );
  });

  const tokenSelectCache: Record<string, ITokenItem[]> = {};
  const tokenSelectIndexCache: Record<string, TokenSelectIndexRow[]> = {};
  tokenSelectCacheParams.forEach((params, key) => {
    const tokenSelect = computeTokenSelect(
      tokenListMap,
      params.addresses,
      params.chainServerId,
      params.keyword,
      params.isLpTokenEnabled,
    );
    tokenSelectCache[key] = tokenSelect;
    tokenSelectIndexCache[key] = buildTokenSelectIndexRows(tokenSelect);
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
    multiAssetsIndexCache,
    singleAssetsIndexCache,
    tokenSelectCache,
    tokenSelectIndexCache,
    perpsTokenSelectCache,
    chainSelectorCache,
  });
};

tokenListStore.subscribe(state => {
  rebuildComputedCaches(state.tokenListMap);
});

export default tokenListStore;
