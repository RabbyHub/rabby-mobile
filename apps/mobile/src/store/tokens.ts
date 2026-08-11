import { queryTokensCache } from '@/core/apis/tokenCache';
import { openapi } from '@/core/request';
import { zCreate, zMutative } from '@/core/utils/reexports';
import { TokenItemEntity } from '@/databases/entities/tokenitem';
import {
  syncRemoteTokens,
  syncRemoteTokensForAddresses,
} from '@/databases/sync/assets';
import { eventBus, EVENT_PATCH_SINGLE_TOKEN } from '@/utils/events';
import {
  commonTokenFilter,
  includeLpTokensFilter,
  lpTokenFilter,
} from '@/utils/lpToken';
import { requestOpenApiWithChainId } from '@/utils/openapi';
import {
  getTokenDisplayModeSnapshot,
  setTokenDisplayMode as setPreferenceTokenDisplayMode,
} from '@/core/serviceApi/preference';
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
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { markStartupPerf } from '@/core/utils/startupPerfMarks';
import { getSelectedBalanceAddressesSnapshot } from './balance';
import { uniqBy } from 'lodash';
import { beginAssetDataLoadDiagnostic } from '@/core/utils/assetDataLoadDiagnostics';
import { LatestAsyncRequest } from '@/core/utils/latestAsyncRequest';

export type { ITokenItem, TokenAssetsResult } from '@/types/assets';

const multiAddressTokenRequests = new LatestAsyncRequest();

const buildTokenListMapFromEntities = (
  addresses: string[],
  tokens: TokenItemEntity[],
) => {
  const result = Object.fromEntries(
    addresses.map(address => [address, [] as ITokenItem[]]),
  );

  tokens.forEach(token => {
    const transformedToken = tokenItemEntityToTokenItem(token);
    const address = transformedToken.owner_addr.toLowerCase();
    if (result[address]) {
      result[address].push(transformedToken);
    }
  });

  return result;
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
  getTokenList(
    address: string,
    force?: boolean,
    chainServerId?: string,
  ): Promise<void>;
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

const getTokenUniqueKey = (token: ITokenItem) =>
  `${token.chain.toLowerCase()}:${token.id.toLowerCase()}`;

const replacePreviousCoreTokensWithCacheTokens = (
  previousTokens: ITokenItem[],
  cacheTokens: ITokenItem[],
  cacheNoCoreTokens?: ITokenItem[],
) => {
  // 优先用内存态的noCore数据，如果内存态没有noCore数据，则用db的noCore数据
  if (
    cacheNoCoreTokens &&
    cacheNoCoreTokens.length > 0 &&
    previousTokens.every(token => token.is_core)
  ) {
    const filteredTokens = cacheNoCoreTokens.filter(token => !token.is_core);
    return uniqBy([...cacheTokens, ...filteredTokens], getTokenUniqueKey);
  }
  const previousNonCoreTokens = previousTokens.filter(token => !token.is_core);

  return uniqBy([...cacheTokens, ...previousNonCoreTokens], getTokenUniqueKey);
};

const replaceTokensByChain = (
  previousTokens: ITokenItem[],
  nextTokens: ITokenItem[],
  chainServerId: string,
) => {
  const normalizedChainServerId = chainServerId.toLowerCase();
  const previousOtherChainTokens = previousTokens.filter(
    token => token.chain.toLowerCase() !== normalizedChainServerId,
  );
  const nextChainTokens = nextTokens.filter(
    token => token.chain.toLowerCase() === normalizedChainServerId,
  );

  return [...previousOtherChainTokens, ...nextChainTokens];
};

const filterInterfaceTokenList = (tokens: ITokenItem[]) =>
  tokens.filter(commonTokenFilter);

const isDataExpired = async (address: string) => {
  const isExpired = await TokenItemEntity.isExpired(address);
  return isExpired;
};

const isDataExpiredBatch = async (addresses: string[]) => {
  const res = await Promise.all(addresses.map(isDataExpired));
  return res.some(item => !!item);
};

const normalizeAddress = (address: string) => address.toLowerCase();

const normalizeAddresses = (addresses: string[]) =>
  addresses.map(normalizeAddress);

const normalizeAddressSet = (addresses: string[]) =>
  new Set(normalizeAddresses(addresses));

const getAddressesKey = (addresses: string[]) =>
  normalizeAddresses(addresses).slice().sort().join('|');

const getOrderedAddressesKey = (addresses: string[]) =>
  normalizeAddresses(addresses).join('|');

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
  `${normalizeAddress(address)}::${chainServerId ?? ''}::${
    isLpTokenEnabled ? '1' : '0'
  }`;

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

export type TokenSelectIndexResult = {
  tokenIds: TokenEntityId[];
  rows: TokenSelectIndexRow[];
};

export type TokenStaticIndexItem = {
  tokenId: TokenEntityId;
  ownerAddr: string;
  chain: string;
  id: string;
  symbol?: string;
  isCore: boolean | null;
  isVerified?: boolean | null;
  isSuspicious?: boolean | null;
  protocolId?: string;
  searchText: string;
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
export const EMPTY_TOKEN_ENTITY_IDS: TokenEntityId[] = [];
const EMPTY_TOKEN_ASSETS_INDEX_ROWS: TokenAssetsIndexRow[] = [];
const EMPTY_TOKEN_SELECT_INDEX_ROWS: TokenSelectIndexRow[] = [];
const EMPTY_STRING_LIST: string[] = [];

export const EMPTY_TOKEN_ASSETS_INDEX_RESULT: TokenAssetsIndexResult = {
  unFoldRows: EMPTY_TOKEN_ASSETS_INDEX_ROWS,
  foldRows: EMPTY_TOKEN_ASSETS_INDEX_ROWS,
  scamRows: EMPTY_TOKEN_ASSETS_INDEX_ROWS,
  unFoldTokenIds: EMPTY_TOKEN_ENTITY_IDS,
  foldTokenIds: EMPTY_TOKEN_ENTITY_IDS,
  scamTokenIds: EMPTY_TOKEN_ENTITY_IDS,
  scamTokenPreviewLogoUrls: EMPTY_STRING_LIST,
  foldCoreUsdValue: 0,
  hasFoldTokens: false,
};

const EMPTY_TOKEN_SELECT_INDEX_RESULT: TokenSelectIndexResult = {
  tokenIds: EMPTY_TOKEN_ENTITY_IDS,
  rows: EMPTY_TOKEN_SELECT_INDEX_ROWS,
};

const createEmptyAssetsIndexResult = (): TokenAssetsIndexResult =>
  EMPTY_TOKEN_ASSETS_INDEX_RESULT;

export const buildTokenEntityId = (
  token: Pick<ITokenItem, 'owner_addr' | 'chain' | 'id'>,
): TokenEntityId =>
  [
    token.owner_addr.toLowerCase(),
    token.chain.toLowerCase(),
    token.id.toLowerCase(),
  ].join(':') as TokenEntityId;

const getTokenEntityIdAddress = (tokenId: string) => tokenId.split(':', 1)[0];

const getChangedTokenKeys = (
  previousToken: ITokenItem | undefined,
  nextToken: ITokenItem,
) => {
  if (!previousToken) {
    return null;
  }

  const keys = new Set([
    ...Object.keys(previousToken),
    ...Object.keys(nextToken),
  ] as Array<keyof ITokenItem>);
  const changedKeys: Array<keyof ITokenItem> = [];

  keys.forEach(key => {
    if (!Object.is(previousToken[key], nextToken[key])) {
      changedKeys.push(key);
    }
  });

  return changedKeys;
};

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
      pruneMissingAddresses?: Set<string>;
    },
  ) => {
    if (
      !tokens.length &&
      !options?.pruneMissing &&
      !options?.pruneMissingAddresses?.size
    ) {
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
      changedKeys: Array<keyof ITokenItem> | null;
      meta: (typeof prev.metaMap)[string];
    }> = [];

    entries.forEach((token, tokenId) => {
      const prevToken = prev.valueMap[tokenId];
      const prevMeta = prev.metaMap[tokenId];
      const changedKeys = getChangedTokenKeys(prevToken, token);
      const isTokenChanged = !prevToken || !!changedKeys?.length;

      if (!prevMeta || isTokenChanged) {
        changedTokens.push({
          tokenId,
          token,
          changedKeys,
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

    const pruneMissingAddresses = options?.pruneMissingAddresses;
    const previousTokenIds = Array.from(
      new Set([...Object.keys(prev.valueMap), ...Object.keys(prev.metaMap)]),
    );
    const removedTokenIds = options?.pruneMissing
      ? previousTokenIds.filter(
          tokenId => !entries.has(tokenId as TokenEntityId),
        )
      : pruneMissingAddresses?.size
      ? previousTokenIds.filter(
          tokenId =>
            pruneMissingAddresses.has(getTokenEntityIdAddress(tokenId)) &&
            !entries.has(tokenId as TokenEntityId),
        )
      : [];

    if (!changedTokens.length && !removedTokenIds.length) {
      return;
    }

    this.mutateState(draft => {
      changedTokens.forEach(({ tokenId, token, changedKeys, meta }) => {
        const previousToken = draft.valueMap[tokenId];
        if (!previousToken || !changedKeys) {
          draft.valueMap[tokenId] = token;
        } else {
          changedKeys.forEach(key => {
            if (Object.prototype.hasOwnProperty.call(token, key)) {
              previousToken[key] = token[key] as never;
            } else {
              delete previousToken[key];
            }
          });
        }
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

  syncAddressesFromTokenListMap = (
    tokenListMap: TokenListState['tokenListMap'],
    addresses: string[],
    source: ObservableResourceValueSource = 'remote',
  ) => {
    const addressSet = normalizeAddressSet(addresses);
    if (!addressSet.size) {
      return;
    }

    const tokens = Array.from(addressSet).flatMap(
      address => tokenListMap[address] || [],
    );
    this.upsertTokens(tokens, source, {
      pruneMissingAddresses: addressSet,
    });
  };

  syncChangedAddressesFromTokenListMap = (
    tokenListMap: TokenListState['tokenListMap'],
    changedAddresses: Set<string>,
    source: ObservableResourceValueSource = 'remote',
  ) => {
    this.syncAddressesFromTokenListMap(
      tokenListMap,
      Array.from(changedAddresses),
      source,
    );
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

const buildStableTokenEntityIds = (
  tokens: ITokenItem[],
  previousIds?: TokenEntityId[],
) => {
  if (!tokens.length) {
    return previousIds?.length ? EMPTY_TOKEN_ENTITY_IDS : previousIds || [];
  }

  const canReusePrevious = previousIds?.length === tokens.length;
  let nextIds: TokenEntityId[] | undefined = canReusePrevious ? undefined : [];

  tokens.forEach((token, index) => {
    const tokenId = buildTokenEntityId(token);
    if (canReusePrevious && !nextIds) {
      if (previousIds![index] === tokenId) {
        return;
      }
      nextIds = previousIds!.slice(0, index);
    }
    nextIds!.push(tokenId);
  });

  return nextIds || previousIds!;
};

const buildStableTokenEntityIdList = (
  tokenIds: TokenEntityId[],
  previousIds?: TokenEntityId[],
) => {
  if (!tokenIds.length) {
    return previousIds?.length ? EMPTY_TOKEN_ENTITY_IDS : previousIds || [];
  }

  const canReusePrevious = previousIds?.length === tokenIds.length;
  let nextIds: TokenEntityId[] | undefined = canReusePrevious ? undefined : [];

  tokenIds.forEach((tokenId, index) => {
    if (canReusePrevious && !nextIds) {
      if (previousIds![index] === tokenId) {
        return;
      }
      nextIds = previousIds!.slice(0, index);
    }
    nextIds!.push(tokenId);
  });

  return nextIds || previousIds!;
};

const buildStableStringList = (list: string[], previousList?: string[]) => {
  if (!list.length) {
    return previousList?.length ? EMPTY_STRING_LIST : previousList || [];
  }

  const canReusePrevious = previousList?.length === list.length;
  let nextList: string[] | undefined = canReusePrevious ? undefined : [];

  list.forEach((item, index) => {
    if (canReusePrevious && !nextList) {
      if (previousList![index] === item) {
        return;
      }
      nextList = previousList!.slice(0, index);
    }
    nextList!.push(item);
  });

  return nextList || previousList!;
};

const buildTokenStaticIndexItem = (token: ITokenItem): TokenStaticIndexItem => {
  const id = token.id || '';
  const symbol = token.symbol || '';

  return {
    tokenId: buildTokenEntityId(token),
    ownerAddr: normalizeAddress(token.owner_addr),
    chain: token.chain,
    id,
    symbol,
    isCore: token.is_core,
    isVerified: token.is_verified,
    isSuspicious: token.is_suspicious,
    protocolId: token.protocol_id,
    searchText: `${id.toLowerCase()} ${symbol.toLowerCase()}`,
  };
};

const isTokenStaticIndexItemSame = (
  previousItem: TokenStaticIndexItem | undefined,
  nextItem: TokenStaticIndexItem,
) => {
  if (!previousItem) {
    return false;
  }

  return (
    previousItem.tokenId === nextItem.tokenId &&
    previousItem.ownerAddr === nextItem.ownerAddr &&
    previousItem.chain === nextItem.chain &&
    previousItem.id === nextItem.id &&
    previousItem.symbol === nextItem.symbol &&
    previousItem.isCore === nextItem.isCore &&
    previousItem.isVerified === nextItem.isVerified &&
    previousItem.isSuspicious === nextItem.isSuspicious &&
    previousItem.protocolId === nextItem.protocolId &&
    previousItem.searchText === nextItem.searchText
  );
};

type TokenIndexState = {
  addressTokenIds: Record<string, TokenEntityId[]>;
  addressVersions: Record<string, number>;
  tokenStaticMap: Record<string, TokenStaticIndexItem>;
  syncAddressTokens(address: string, tokens: ITokenItem[]): void;
  syncFromTokenListMap(
    tokenListMap: TokenListState['tokenListMap'],
    addresses?: string[],
  ): void;
};

export const useTokenIndexStore = zCreate(
  zMutative<TokenIndexState>((set, get) => ({
    addressTokenIds: {},
    addressVersions: {},
    tokenStaticMap: {},
    syncAddressTokens(address, tokens) {
      const normalizedAddress = normalizeAddress(address);
      const nextTokenIds = buildStableTokenEntityIds(
        sortByUsdValueDesc(tokens),
        get().addressTokenIds[normalizedAddress],
      );
      const nextStaticItems = tokens.map(buildTokenStaticIndexItem);
      const nextStaticTokenIds = new Set(
        nextStaticItems.map(item => item.tokenId),
      );

      set(draft => {
        let didChange = false;
        if (draft.addressTokenIds[normalizedAddress] !== nextTokenIds) {
          draft.addressTokenIds[normalizedAddress] = nextTokenIds;
          didChange = true;
        }

        nextStaticItems.forEach(item => {
          if (
            !isTokenStaticIndexItemSame(
              draft.tokenStaticMap[item.tokenId],
              item,
            )
          ) {
            draft.tokenStaticMap[item.tokenId] = item;
            didChange = true;
          }
        });

        Object.keys(draft.tokenStaticMap).forEach(tokenId => {
          if (
            getTokenEntityIdAddress(tokenId) === normalizedAddress &&
            !nextStaticTokenIds.has(tokenId as TokenEntityId)
          ) {
            delete draft.tokenStaticMap[tokenId];
            didChange = true;
          }
        });

        if (didChange) {
          draft.addressVersions[normalizedAddress] =
            (draft.addressVersions[normalizedAddress] || 0) + 1;
        }
      });
    },
    syncFromTokenListMap(tokenListMap, addresses) {
      const addressSet = addresses
        ? normalizeAddressSet(addresses)
        : new Set(Object.keys(tokenListMap).map(normalizeAddress));

      addressSet.forEach(address => {
        get().syncAddressTokens(address, tokenListMap[address] || []);
      });
    },
  })),
);

const getTokenSelectSearchScore = (
  item: TokenStaticIndexItem,
  keyword: string,
) => {
  const idLower = item.id.toLowerCase();
  const symbolLower = item.symbol?.toLowerCase() || '';
  const isExactMatch = idLower === keyword || symbolLower === keyword;

  if (isExactMatch && item.isCore) {
    return 4;
  }
  if (isExactMatch && !item.isCore) {
    return 3;
  }
  if (!isExactMatch && item.isCore) {
    return 2;
  }
  return 1;
};

const isTokenStaticMatchedByKeyword = (
  item: TokenStaticIndexItem,
  keyword: string,
) => {
  if (item.isVerified === false) {
    return false;
  }
  if (item.isCore === false && !item.protocolId) {
    return false;
  }
  return item.searchText.includes(keyword);
};

export const selectTokenIdsForTokenSelector = (
  state: Pick<TokenIndexState, 'addressTokenIds' | 'tokenStaticMap'>,
  addresses: string[],
  chainServerId?: string,
  keyword?: string,
  isLpTokenEnabled?: boolean,
) => {
  const tokenIds = normalizeAddresses(addresses).flatMap(
    address => state.addressTokenIds[address] || EMPTY_TOKEN_ENTITY_IDS,
  );
  const normalizedKeyword = keyword?.toLowerCase();
  const seen = new Set<TokenEntityId>();
  const matchedIds: TokenEntityId[] = [];

  tokenIds.forEach(tokenId => {
    if (seen.has(tokenId)) {
      return;
    }
    seen.add(tokenId);

    const item = state.tokenStaticMap[tokenId];
    if (!item) {
      return;
    }
    if (chainServerId && item.chain !== chainServerId) {
      return;
    }

    if (normalizedKeyword) {
      if (!isTokenStaticMatchedByKeyword(item, normalizedKeyword)) {
        return;
      }
      matchedIds.push(tokenId);
      return;
    }

    if (
      !lpTokenFilter(
        {
          is_core: item.isCore,
          is_verified: item.isVerified,
          is_suspicious: item.isSuspicious,
          protocol_id: item.protocolId,
        },
        isLpTokenEnabled,
      )
    ) {
      return;
    }
    matchedIds.push(tokenId);
  });

  if (!normalizedKeyword) {
    return matchedIds;
  }

  return matchedIds.sort((a, b) => {
    const aItem = state.tokenStaticMap[a]!;
    const bItem = state.tokenStaticMap[b]!;
    const aScore = getTokenSelectSearchScore(aItem, normalizedKeyword);
    const bScore = getTokenSelectSearchScore(bItem, normalizedKeyword);

    if (aScore !== bScore) {
      return bScore - aScore;
    }
    if (aItem.isSuspicious !== bItem.isSuspicious) {
      return aItem.isSuspicious ? 1 : -1;
    }
    return 0;
  });
};

export const buildTokenSelectIndexRowsFromIds = (
  tokenIds: TokenEntityId[],
): TokenSelectIndexRow[] => {
  if (!tokenIds.length) {
    return EMPTY_TOKEN_SELECT_INDEX_ROWS;
  }
  return tokenIds.map(tokenId => ({
    type: 'token',
    tokenId,
  }));
};

const buildStableTokenSelectIndexRowsFromIds = (
  tokenIds: TokenEntityId[],
  previousRows?: TokenSelectIndexRow[],
): TokenSelectIndexRow[] => {
  if (!tokenIds.length) {
    return previousRows?.length
      ? EMPTY_TOKEN_SELECT_INDEX_ROWS
      : previousRows || EMPTY_TOKEN_SELECT_INDEX_ROWS;
  }

  const canReusePrevious = previousRows?.length === tokenIds.length;
  let nextRows: TokenSelectIndexRow[] | undefined = canReusePrevious
    ? undefined
    : [];

  tokenIds.forEach((tokenId, index) => {
    if (canReusePrevious && !nextRows) {
      if (previousRows![index]?.tokenId === tokenId) {
        return;
      }
      nextRows = previousRows!.slice(0, index);
    }
    nextRows!.push({
      type: 'token',
      tokenId,
    });
  });

  return nextRows || previousRows!;
};

const buildTokenSelectIndexResultFromIds = (
  tokenIds: TokenEntityId[],
  previousResult?: TokenSelectIndexResult,
): TokenSelectIndexResult => {
  if (!tokenIds.length) {
    return previousResult?.tokenIds.length
      ? EMPTY_TOKEN_SELECT_INDEX_RESULT
      : previousResult || EMPTY_TOKEN_SELECT_INDEX_RESULT;
  }

  const stableTokenIds = buildStableTokenEntityIdList(
    tokenIds,
    previousResult?.tokenIds,
  );
  const rows = buildStableTokenSelectIndexRowsFromIds(
    stableTokenIds,
    previousResult?.rows,
  );

  if (
    previousResult &&
    previousResult.tokenIds === stableTokenIds &&
    previousResult.rows === rows
  ) {
    return previousResult;
  }

  return {
    tokenIds: stableTokenIds,
    rows,
  };
};

const getTokenSelectIndexCacheKey = ({
  addresses,
  chainServerId,
  keyword,
  isLpTokenEnabled,
}: {
  addresses: string[];
  chainServerId?: string;
  keyword?: string;
  isLpTokenEnabled?: boolean;
}) =>
  `${getOrderedAddressesKey(addresses)}::${chainServerId ?? ''}::${
    keyword?.toLowerCase() ?? ''
  }::${isLpTokenEnabled ? '1' : '0'}`;

const getTokenSelectIndexAddressVersionKey = (
  state: Pick<TokenIndexState, 'addressVersions'>,
  addresses: string[],
) =>
  normalizeAddresses(addresses)
    .map(address => `${address}:${state.addressVersions[address] || 0}`)
    .join('|');

const tokenSelectIndexResultCache: Record<
  string,
  {
    addressVersionKey: string;
    result: TokenSelectIndexResult;
  }
> = {};
const TOKEN_SELECT_INDEX_RESULT_CACHE_LIMIT = 80;

const setTokenSelectIndexResultCache = (
  cacheKey: string,
  value: {
    addressVersionKey: string;
    result: TokenSelectIndexResult;
  },
) => {
  tokenSelectIndexResultCache[cacheKey] = value;

  const cacheKeys = Object.keys(tokenSelectIndexResultCache);
  if (cacheKeys.length <= TOKEN_SELECT_INDEX_RESULT_CACHE_LIMIT) {
    return;
  }

  delete tokenSelectIndexResultCache[cacheKeys[0]!];
};

export const selectTokenSelectIndexResult = (
  state: Pick<
    TokenIndexState,
    'addressTokenIds' | 'addressVersions' | 'tokenStaticMap'
  >,
  addresses: string[],
  chainServerId?: string,
  keyword?: string,
  isLpTokenEnabled?: boolean,
): TokenSelectIndexResult => {
  if (!addresses.length) {
    return EMPTY_TOKEN_SELECT_INDEX_RESULT;
  }

  const cacheKey = getTokenSelectIndexCacheKey({
    addresses,
    chainServerId,
    keyword,
    isLpTokenEnabled,
  });
  const addressVersionKey = getTokenSelectIndexAddressVersionKey(
    state,
    addresses,
  );
  const cached = tokenSelectIndexResultCache[cacheKey];

  if (cached?.addressVersionKey === addressVersionKey) {
    return cached.result;
  }

  const tokenIds = selectTokenIdsForTokenSelector(
    state,
    addresses,
    chainServerId,
    keyword,
    isLpTokenEnabled,
  );
  const result = buildTokenSelectIndexResultFromIds(tokenIds, cached?.result);

  setTokenSelectIndexResultCache(cacheKey, {
    addressVersionKey,
    result,
  });

  return result;
};

const isTokenAssetsIndexRowSame = (
  row: TokenAssetsIndexRow | undefined,
  nextType: TokenAssetsIndexRow['type'],
  nextId: TokenEntityId | TokenGroupId,
) => {
  if (!row || row.type !== nextType) {
    return false;
  }
  return row.type === 'group' ? row.groupId === nextId : row.tokenId === nextId;
};

const buildTokenAssetsIndexRows = (
  tokens: ITokenItem[],
  section: 'unfold' | 'fold' | 'scam',
  listKey?: string,
  previousRows?: TokenAssetsIndexRow[],
) => {
  if (!tokens.length) {
    return previousRows?.length
      ? EMPTY_TOKEN_ASSETS_INDEX_ROWS
      : previousRows || [];
  }

  const groups: Array<{
    groupId: TokenGroupId;
    value: TokenGroupResourceValue;
  }> = [];
  const canReusePrevious = previousRows?.length === tokens.length;
  let nextRows: TokenAssetsIndexRow[] | undefined = canReusePrevious
    ? undefined
    : [];

  tokens.forEach((token, index) => {
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

      if (canReusePrevious && !nextRows) {
        if (isTokenAssetsIndexRowSame(previousRows![index], 'group', groupId)) {
          return;
        }
        nextRows = previousRows!.slice(0, index);
      }

      nextRows!.push({
        type: 'group',
        groupId,
      });
      return;
    }

    const tokenId = buildTokenEntityId(token);
    if (canReusePrevious && !nextRows) {
      if (isTokenAssetsIndexRowSame(previousRows![index], 'token', tokenId)) {
        return;
      }
      nextRows = previousRows!.slice(0, index);
    }

    nextRows!.push({
      type: 'token',
      tokenId,
    });
  });

  if (groups.length) {
    const groupTokens = tokens.flatMap(token => {
      return getTokenRuntimeGroupItems(token) || [];
    });
    tokenEntityResourceStore.upsertTokens(groupTokens);
    tokenGroupResourceStore.upsertGroups(groups);
  }

  return nextRows || previousRows!;
};

const buildTokenAssetsIndexResult = (
  result: TokenAssetsResult,
  listKey?: string,
  previousResult?: TokenAssetsIndexResult,
): TokenAssetsIndexResult => {
  const unFoldRows = buildTokenAssetsIndexRows(
    result.unFoldTokens,
    'unfold',
    listKey,
    previousResult?.unFoldRows,
  );
  const foldRows = buildTokenAssetsIndexRows(
    result.foldTokens,
    'fold',
    listKey,
    previousResult?.foldRows,
  );
  const scamRows = buildTokenAssetsIndexRows(
    result.scamTokens,
    'scam',
    listKey,
    previousResult?.scamRows,
  );

  const nextResult = {
    unFoldRows,
    foldRows,
    scamRows,
    unFoldTokenIds: buildStableTokenEntityIds(
      result.unFoldTokens,
      previousResult?.unFoldTokenIds,
    ),
    foldTokenIds: buildStableTokenEntityIds(
      result.foldTokens,
      previousResult?.foldTokenIds,
    ),
    scamTokenIds: buildStableTokenEntityIds(
      result.scamTokens,
      previousResult?.scamTokenIds,
    ),
    scamTokenPreviewLogoUrls: buildStableStringList(
      result.scamTokens.slice(0, 3).map(token => token.logo_url),
      previousResult?.scamTokenPreviewLogoUrls,
    ),
    foldCoreUsdValue: result.foldTokens
      .filter(token => token.is_core)
      .reduce((total, token) => total + (token.usd_value || 0), 0),
    hasFoldTokens: result.hasFoldTokens,
  };

  if (
    previousResult &&
    previousResult.unFoldRows === nextResult.unFoldRows &&
    previousResult.foldRows === nextResult.foldRows &&
    previousResult.scamRows === nextResult.scamRows &&
    previousResult.unFoldTokenIds === nextResult.unFoldTokenIds &&
    previousResult.foldTokenIds === nextResult.foldTokenIds &&
    previousResult.scamTokenIds === nextResult.scamTokenIds &&
    previousResult.scamTokenPreviewLogoUrls ===
      nextResult.scamTokenPreviewLogoUrls &&
    previousResult.foldCoreUsdValue === nextResult.foldCoreUsdValue &&
    previousResult.hasFoldTokens === nextResult.hasFoldTokens
  ) {
    return previousResult;
  }

  return nextResult;
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

const computeMultiAssetsFromTokens = (
  allTokens: ITokenItem[],
  chainServerId?: string,
  isLpTokenEnabled?: boolean,
  tokenDisplayMode?: TokenDisplayMode,
): TokenAssetsResult => {
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
    hasFoldTokens:
      foldedTokens.some(includeLpTokensFilter) ||
      aggregatedScamTokens.some(includeLpTokensFilter),
    foldTokens: foldedTokens.filter(i => lpTokenFilter(i, isLpTokenEnabled)),
    scamTokens: aggregatedScamTokens.filter(i =>
      lpTokenFilter(i, isLpTokenEnabled),
    ),
  };
};

export const buildMultiAssetsIndexFromTokenIds = (
  tokenIds: TokenEntityId[],
  chainServerId?: string,
  isLpTokenEnabled?: boolean,
  tokenDisplayMode?: TokenDisplayMode,
  listKey?: string,
  previousResult?: TokenAssetsIndexResult,
): TokenAssetsIndexResult => {
  if (!tokenIds.length) {
    return createEmptyAssetsIndexResult();
  }

  const tokens = tokenIds
    .map(tokenId => tokenEntityResourceStore.getValue(tokenId))
    .filter((token): token is ITokenItem => !!token);

  return buildTokenAssetsIndexResult(
    computeMultiAssetsFromTokens(
      tokens,
      chainServerId,
      isLpTokenEnabled,
      tokenDisplayMode,
    ),
    listKey,
    previousResult,
  );
};

const computeSingleAssetsFromTokens = (
  tokens: ITokenItem[],
  chainServerId?: string,
  isLpTokenEnabled?: boolean,
): TokenAssetsResult => {
  const scamTokens: ITokenItem[] = [];
  const nonScamTokens: ITokenItem[] = [];
  const coreTokens: ITokenItem[] = [];
  let totalValue = 0;
  tokens.forEach(token => {
    if (chainServerId && token.chain !== chainServerId) {
      return;
    }
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
  return {
    unFoldTokens: unfoldedTokens,
    hasFoldTokens:
      foldedTokens.some(includeLpTokensFilter) ||
      scamTokens.some(includeLpTokensFilter),
    foldTokens: foldedTokens.filter(i => lpTokenFilter(i, isLpTokenEnabled)),
    scamTokens: scamTokens.filter(i => lpTokenFilter(i, isLpTokenEnabled)),
  };
};

export const buildSingleAssetsIndexFromTokenIds = (
  tokenIds: TokenEntityId[],
  chainServerId?: string,
  isLpTokenEnabled?: boolean,
  previousResult?: TokenAssetsIndexResult,
): TokenAssetsIndexResult => {
  if (!tokenIds.length) {
    return createEmptyAssetsIndexResult();
  }

  const tokens = tokenIds
    .map(tokenId => tokenEntityResourceStore.getValue(tokenId))
    .filter((token): token is ITokenItem => !!token);

  return buildTokenAssetsIndexResult(
    computeSingleAssetsFromTokens(tokens, chainServerId, isLpTokenEnabled),
    undefined,
    previousResult,
  );
};

type TokenAssetsIndexStoreState = {
  singleAssetsResultByKey: Record<string, TokenAssetsIndexResult>;
  multiAssetsResultByKey: Record<string, TokenAssetsIndexResult>;
  singleAssetsConfigByKey: Record<string, SingleTokenAssetsIndexConfig>;
  multiAssetsConfigByKey: Record<string, MultiTokenAssetsIndexConfig>;
  syncSingleAssetsResult(input: {
    key: string;
    tokenIds: TokenEntityId[];
    chainServerId?: string;
    isLpTokenEnabled?: boolean;
  }): void;
  syncMultiAssetsResult(input: {
    key: string;
    tokenIds: TokenEntityId[];
    chainServerId?: string;
    isLpTokenEnabled?: boolean;
    tokenDisplayMode?: TokenDisplayMode;
  }): void;
  syncChangedTokenAssetsResults(tokenIds: TokenEntityId[]): void;
};

type SingleTokenAssetsIndexConfig = {
  key: string;
  tokenIds: TokenEntityId[];
  chainServerId?: string;
  isLpTokenEnabled?: boolean;
};

type MultiTokenAssetsIndexConfig = SingleTokenAssetsIndexConfig & {
  tokenDisplayMode?: TokenDisplayMode;
};

const hasTokenAssetsConfigToken = (
  tokenIds: TokenEntityId[],
  changedTokenIdSet: ReadonlySet<TokenEntityId>,
) => tokenIds.some(tokenId => changedTokenIdSet.has(tokenId));

const isSingleTokenAssetsIndexConfigSame = (
  previousConfig: SingleTokenAssetsIndexConfig | undefined,
  nextConfig: SingleTokenAssetsIndexConfig,
) =>
  previousConfig?.tokenIds === nextConfig.tokenIds &&
  previousConfig.chainServerId === nextConfig.chainServerId &&
  previousConfig.isLpTokenEnabled === nextConfig.isLpTokenEnabled;

const isMultiTokenAssetsIndexConfigSame = (
  previousConfig: MultiTokenAssetsIndexConfig | undefined,
  nextConfig: MultiTokenAssetsIndexConfig,
) =>
  isSingleTokenAssetsIndexConfigSame(previousConfig, nextConfig) &&
  previousConfig?.tokenDisplayMode === nextConfig.tokenDisplayMode;

export const useTokenAssetsIndexStore = zCreate(
  zMutative<TokenAssetsIndexStoreState>((set, get) => ({
    singleAssetsResultByKey: {},
    multiAssetsResultByKey: {},
    singleAssetsConfigByKey: {},
    multiAssetsConfigByKey: {},
    syncSingleAssetsResult({ key, tokenIds, chainServerId, isLpTokenEnabled }) {
      const nextConfig = {
        key,
        tokenIds,
        chainServerId,
        isLpTokenEnabled,
      };
      const previousConfig = get().singleAssetsConfigByKey[key];
      const previousResult = get().singleAssetsResultByKey[key];
      const nextResult = buildSingleAssetsIndexFromTokenIds(
        tokenIds,
        chainServerId,
        isLpTokenEnabled,
        previousResult,
      );
      const isConfigSame = isSingleTokenAssetsIndexConfigSame(
        previousConfig,
        nextConfig,
      );

      if (isConfigSame && previousResult === nextResult) {
        return;
      }

      set(draft => {
        if (!isConfigSame) {
          draft.singleAssetsConfigByKey[key] = nextConfig;
        }
        draft.singleAssetsResultByKey[key] = nextResult;
      });
    },
    syncMultiAssetsResult({
      key,
      tokenIds,
      chainServerId,
      isLpTokenEnabled,
      tokenDisplayMode,
    }) {
      const nextConfig = {
        key,
        tokenIds,
        chainServerId,
        isLpTokenEnabled,
        tokenDisplayMode,
      };
      const previousConfig = get().multiAssetsConfigByKey[key];
      const previousResult = get().multiAssetsResultByKey[key];
      const nextResult = buildMultiAssetsIndexFromTokenIds(
        tokenIds,
        chainServerId,
        isLpTokenEnabled,
        tokenDisplayMode,
        key,
        previousResult,
      );
      const isConfigSame = isMultiTokenAssetsIndexConfigSame(
        previousConfig,
        nextConfig,
      );

      if (isConfigSame && previousResult === nextResult) {
        return;
      }

      set(draft => {
        if (!isConfigSame) {
          draft.multiAssetsConfigByKey[key] = nextConfig;
        }
        draft.multiAssetsResultByKey[key] = nextResult;
      });
    },
    syncChangedTokenAssetsResults(tokenIds) {
      if (!tokenIds.length) {
        return;
      }

      const changedTokenIdSet = new Set(tokenIds);
      const state = get();
      const singleResultUpdates: Record<string, TokenAssetsIndexResult> = {};
      const multiResultUpdates: Record<string, TokenAssetsIndexResult> = {};

      Object.values(state.singleAssetsConfigByKey).forEach(config => {
        if (!hasTokenAssetsConfigToken(config.tokenIds, changedTokenIdSet)) {
          return;
        }

        const previousResult = state.singleAssetsResultByKey[config.key];
        const nextResult = buildSingleAssetsIndexFromTokenIds(
          config.tokenIds,
          config.chainServerId,
          config.isLpTokenEnabled,
          previousResult,
        );

        if (previousResult !== nextResult) {
          singleResultUpdates[config.key] = nextResult;
        }
      });

      Object.values(state.multiAssetsConfigByKey).forEach(config => {
        if (!hasTokenAssetsConfigToken(config.tokenIds, changedTokenIdSet)) {
          return;
        }

        const previousResult = state.multiAssetsResultByKey[config.key];
        const nextResult = buildMultiAssetsIndexFromTokenIds(
          config.tokenIds,
          config.chainServerId,
          config.isLpTokenEnabled,
          config.tokenDisplayMode,
          config.key,
          previousResult,
        );

        if (previousResult !== nextResult) {
          multiResultUpdates[config.key] = nextResult;
        }
      });

      if (
        !Object.keys(singleResultUpdates).length &&
        !Object.keys(multiResultUpdates).length
      ) {
        return;
      }

      set(draft => {
        Object.entries(singleResultUpdates).forEach(([key, result]) => {
          draft.singleAssetsResultByKey[key] = result;
        });
        Object.entries(multiResultUpdates).forEach(([key, result]) => {
          draft.multiAssetsResultByKey[key] = result;
        });
      });
    },
  })),
);

let lastTokenListMapSyncedToRuntime: TokenListState['tokenListMap'] | undefined;

const syncTokenRuntimeStoresFromTokenListMap = (
  tokenListMap: TokenListState['tokenListMap'],
  addresses: string[],
  source: ObservableResourceValueSource = 'remote',
  options?: {
    markTokenListMapSynced?: boolean;
  },
) => {
  const normalizedAddresses = Array.from(normalizeAddressSet(addresses));

  if (!normalizedAddresses.length) {
    if (options?.markTokenListMapSynced) {
      lastTokenListMapSyncedToRuntime = tokenListMap;
    }
    return;
  }

  tokenEntityResourceStore.syncAddressesFromTokenListMap(
    tokenListMap,
    normalizedAddresses,
    source,
  );
  useTokenIndexStore
    .getState()
    .syncFromTokenListMap(tokenListMap, normalizedAddresses);

  if (options?.markTokenListMapSynced) {
    lastTokenListMapSyncedToRuntime = tokenListMap;
  }
};

const tokenListStore = zCreate<TokenListState>((set, get) => ({
  tokenListMap: {},
  isLoading: false, // 整体的 loading 状态
  tokenDisplayMode: getTokenDisplayModeSnapshot(),
  // 单个地址的 loading 状态：cache token拿到loading设置false，等所有token都拿到allLoading才设置false
  isLoadingByAddress: {},
  setTokenDisplayMode(mode) {
    set(() => ({ tokenDisplayMode: mode }));
    void setPreferenceTokenDisplayMode(mode).catch(console.error);
  },
  async initStore() {
    const startedAt = Date.now();
    markStartupPerf('tokenListStore', 'initStore_start');

    // 在 App 启动时执行，初始化冷备数据
    // 取 Top10 地址
    const addressesStartedAt = Date.now();
    const top10Addresses = getSelectedBalanceAddressesSnapshot();
    markStartupPerf('tokenListStore', 'selected_addresses_snapshot_end', {
      elapsedMs: Date.now() - addressesStartedAt,
      count: top10Addresses.length,
    });

    const lowerAddresses = Array.from(
      new Set(top10Addresses.map(item => item.toLowerCase())),
    );
    const loadStartedAt = Date.now();
    const tokenMap = await TokenItemEntity.getDefaultTokensByAddresses(
      lowerAddresses,
    );
    markStartupPerf('tokenListStore', 'load_cache_end', {
      elapsedMs: Date.now() - loadStartedAt,
      count: lowerAddresses.length,
      tokenCount: Object.values(tokenMap).reduce(
        (acc, tokens) => acc + tokens.length,
        0,
      ),
    });

    // 写入 Store
    syncTokenRuntimeStoresFromTokenListMap(
      tokenMap,
      lowerAddresses,
      'hydrate',
      {
        markTokenListMapSynced: true,
      },
    );
    set(() => ({ tokenListMap: tokenMap }));
    markStartupPerf('tokenListStore', 'initStore_end', {
      elapsedMs: Date.now() - startedAt,
      count: lowerAddresses.length,
    });
  },

  async batchGetTokenList(addresses: string[], force = false) {
    const requestId = multiAddressTokenRequests.next();
    const lowerAddresses = Array.from(
      new Set(addresses.map(item => item.toLowerCase())),
    );
    const trace = beginAssetDataLoadDiagnostic(
      'multi-address-token',
      lowerAddresses.join('|'),
      {
        addressCount: lowerAddresses.length,
        force,
      },
    );
    const isCurrentRequest = () =>
      multiAddressTokenRequests.isCurrent(requestId);

    if (!lowerAddresses.length) {
      set(() => ({ isLoading: true }));
      await new Promise(resolve => setTimeout(resolve, 0));
      if (isCurrentRequest()) {
        set(() => ({ tokenListMap: {}, isLoading: false }));
      }
      trace.finish({ path: 'empty-addresses' });
      return;
    }

    try {
      if (!force) {
        const isExpired = await isDataExpiredBatch(lowerAddresses);
        trace.mark('expiry-resolved', { isExpired });
        if (!isCurrentRequest()) {
          trace.finish({ path: 'stale-before-hydrate' });
          return;
        }
        if (!isExpired) {
          const tokens = await TokenItemEntity.batchMultiAddressTokens(
            lowerAddresses,
          );
          const localTokenMap = buildTokenListMapFromEntities(
            lowerAddresses,
            tokens as TokenItemEntity[],
          );
          trace.mark('local-db-loaded', { itemCount: tokens.length });
          if (!isCurrentRequest()) {
            trace.finish({ path: 'stale-after-hydrate' });
            return;
          }
          syncTokenRuntimeStoresFromTokenListMap(
            localTokenMap,
            lowerAddresses,
            'hydrate',
            {
              markTokenListMapSynced: true,
            },
          );
          set(() => ({ tokenListMap: localTokenMap, isLoading: false }));
          trace.finish({ path: 'local-db', itemCount: tokens.length });
          return;
        }
      }

      if (isCurrentRequest()) {
        set(() => ({ isLoading: true }));
      }

      const cacheTokenQueue = new PQueue({
        concurrency: 5,
      });
      const cacheTokenMap: Record<string, ITokenItem[]> = {};
      const cacheTokensPromise = Promise.allSettled(
        lowerAddresses.map(address =>
          cacheTokenQueue.add(async () => {
            const list = await queryTokensCache(address);
            cacheTokenMap[address] = filterInterfaceTokenList(
              list.map(item => tokenItemToITokenItem(item, address)),
            );
          }),
        ),
      );

      const currentTokenListMap = get().tokenListMap;
      const hasMemorySnapshot = lowerAddresses.every(address =>
        Object.prototype.hasOwnProperty.call(currentTokenListMap, address),
      );
      if (!force && !hasMemorySnapshot) {
        const localTokens = await TokenItemEntity.batchMultiAddressTokens(
          lowerAddresses,
        );
        trace.mark('stale-local-db-loaded', {
          itemCount: localTokens.length,
        });
        if (isCurrentRequest()) {
          const localTokenMap = buildTokenListMapFromEntities(
            lowerAddresses,
            localTokens as TokenItemEntity[],
          );
          syncTokenRuntimeStoresFromTokenListMap(
            localTokenMap,
            lowerAddresses,
            'hydrate',
            {
              markTokenListMapSynced: true,
            },
          );
          set(() => ({ tokenListMap: localTokenMap }));
          trace.mark('stale-local-store-published', {
            itemCount: localTokens.length,
          });
        }
      } else {
        trace.mark('memory-snapshot-retained', {
          hasMemorySnapshot,
        });
      }

      await cacheTokensPromise;
      trace.mark('cache-responses-completed', {
        itemCount: Object.values(cacheTokenMap).reduce(
          (count, tokens) => count + tokens.length,
          0,
        ),
      });
      if (!isCurrentRequest()) {
        trace.finish({ path: 'stale-after-cache' });
        return;
      }

      const latestTokenListMap = get().tokenListMap;
      const mergedCacheTokenMap = { ...latestTokenListMap };
      lowerAddresses.forEach(address => {
        const previousTokens = latestTokenListMap[address] || [];
        const cacheTokens = cacheTokenMap[address] || [];
        mergedCacheTokenMap[address] = replacePreviousCoreTokensWithCacheTokens(
          previousTokens,
          cacheTokens,
        );
      });
      syncTokenRuntimeStoresFromTokenListMap(
        mergedCacheTokenMap,
        lowerAddresses,
        'remote',
        {
          markTokenListMapSynced: true,
        },
      );
      set(() => ({ tokenListMap: mergedCacheTokenMap }));
      trace.mark('cache-store-published');

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
                  return filterInterfaceTokenList(
                    chainTokensRes.map(item =>
                      tokenItemToITokenItem(item, address),
                    ),
                  );
                }),
            ),
          );
          realTimeTokenMap[address] = res
            .map(result => (result.status === 'fulfilled' ? result.value : []))
            .flat() as ITokenItem[];
        }),
      );

      syncRemoteTokensForAddresses(realTimeTokenMap);
      trace.mark('remote-responses-completed', {
        itemCount: Object.values(realTimeTokenMap).reduce(
          (count, tokens) => count + tokens.length,
          0,
        ),
      });
      if (!isCurrentRequest()) {
        trace.finish({ path: 'stale-after-remote' });
        return;
      }

      syncTokenRuntimeStoresFromTokenListMap(
        realTimeTokenMap,
        lowerAddresses,
        'remote',
        {
          markTokenListMapSynced: true,
        },
      );
      set(() => ({ tokenListMap: realTimeTokenMap, isLoading: false }));
      trace.finish({ path: 'cache-then-remote' });
    } catch (error) {
      trace.fail({ phase: 'load' });
      throw error;
    } finally {
      if (isCurrentRequest() && get().isLoading) {
        set(() => ({ isLoading: false }));
      }
    }
  },

  async getTokenList(address: string, force = false, chainServerId?: string) {
    const normalizedAddress = address.toLowerCase();
    const trace = beginAssetDataLoadDiagnostic(
      'single-address-token',
      normalizedAddress,
      {
        force,
        chainServerId: chainServerId || null,
      },
    );
    let isExpired: boolean;
    try {
      isExpired = await isDataExpired(normalizedAddress);
      trace.mark('expiry-resolved', { isExpired });
    } catch (error) {
      trace.fail({ phase: 'expiry' });
      throw error;
    }
    const currentStateTokens = get().tokenListMap[normalizedAddress] || [];
    const hasCurrentAddressTokens = currentStateTokens.length > 0;
    const targetChainServerId = chainServerId || undefined;

    // 如果本地有数据且未过期（目的：避免缓存接口的延迟问题），或者本地有数据且指定了链（目的：单链刷新就一个接口，没必要走缓存接口），可跳过缓存接口
    const isRefreshingWithValidLocalTokens =
      hasCurrentAddressTokens && (!isExpired || !!targetChainServerId);

    /**
     * 阶段一： 校验有效期，有效期内直接用本地数据
     */
    if (!force && !isExpired) {
      try {
        const tokens = (await TokenItemEntity.batchQueryTokens(
          normalizedAddress,
        )) as TokenItemEntity[];
        trace.mark('local-db-loaded', { itemCount: tokens.length });
        const res = tokens.map(tokenItemEntityToTokenItem);
        const nextTokenListMap = {
          ...get().tokenListMap,
          [normalizedAddress]: res,
        };
        syncTokenRuntimeStoresFromTokenListMap(
          nextTokenListMap,
          [normalizedAddress],
          'hydrate',
          {
            markTokenListMapSynced: true,
          },
        );
        set(() => ({ tokenListMap: nextTokenListMap }));
        trace.mark('local-store-published', { itemCount: res.length });
        trace.finish({ path: 'local-db' });
        return;
      } catch (error) {
        trace.fail({ phase: 'local-db' });
        throw error;
      }
    }

    set(state => ({
      isLoadingByAddress: {
        ...state.isLoadingByAddress,
        [normalizedAddress]: { loading: true, allLoading: true },
      },
    }));

    try {
      const shouldHydrateStaleLocalTokens =
        !force && isExpired && !hasCurrentAddressTokens;
      const cacheListPromise = isRefreshingWithValidLocalTokens
        ? null
        : queryTokensCache(address);

      if (shouldHydrateStaleLocalTokens) {
        try {
          const localTokenEntities = await TokenItemEntity.batchQueryTokens(
            normalizedAddress,
          );
          trace.mark('stale-local-db-loaded', {
            itemCount: localTokenEntities.length,
          });

          if (localTokenEntities.length > 0) {
            const localTokens = localTokenEntities.map(
              tokenItemEntityToTokenItem,
            );
            const nextTokenListMap = {
              ...get().tokenListMap,
              [normalizedAddress]: localTokens,
            };
            syncTokenRuntimeStoresFromTokenListMap(
              nextTokenListMap,
              [normalizedAddress],
              'hydrate',
              {
                markTokenListMapSynced: true,
              },
            );
            set(state => ({
              tokenListMap: nextTokenListMap,
              isLoadingByAddress: {
                ...state.isLoadingByAddress,
                [normalizedAddress]: { loading: false, allLoading: true },
              },
            }));
            trace.mark('stale-local-store-published', {
              itemCount: localTokens.length,
            });
          }
        } catch (error) {
          trace.mark('stale-local-hydrate-failed');
          console.error('hydrate stale local token snapshot failed', error);
        }
      }

      /**
       * 阶段二： 从缓存接口中获取数据，注意缓存接口有30s延迟，且不完整（只包含核心token）
       */
      if (isRefreshingWithValidLocalTokens) {
        set(state => ({
          isLoadingByAddress: {
            ...state.isLoadingByAddress,
            [normalizedAddress]: { loading: false, allLoading: true },
          },
        }));
        trace.mark('cache-skipped', {
          itemCount: currentStateTokens.length,
        });
      } else {
        const cacheList = await cacheListPromise!;
        trace.mark('cache-response', { itemCount: cacheList.length });
        const cacheTokens = filterInterfaceTokenList(
          cacheList.map(item => tokenItemToITokenItem(item, address)),
        );
        const currentState = get();
        const previousTokens =
          currentState.tokenListMap[normalizedAddress] || [];

        // 以此弥补cache接口数据不完整，带来的接口列表闪动
        let noCoreDBTokens: ITokenItem[] = [];
        if (!previousTokens.some(token => !token.is_core)) {
          const noCoreDBTokensList =
            await TokenItemEntity.batchQueryNoCoreTokens(normalizedAddress);
          noCoreDBTokens = filterInterfaceTokenList(
            noCoreDBTokensList.map(tokenItemEntityToTokenItem),
          );
          trace.mark('non-core-db-loaded', {
            itemCount: noCoreDBTokens.length,
          });
        }

        const mergedCacheTokens = replacePreviousCoreTokensWithCacheTokens(
          previousTokens,
          cacheTokens,
          noCoreDBTokens,
        );
        const nextTokenListMap = {
          ...currentState.tokenListMap,
          [normalizedAddress]: mergedCacheTokens,
        };
        syncTokenRuntimeStoresFromTokenListMap(
          nextTokenListMap,
          [normalizedAddress],
          'remote',
          {
            markTokenListMapSynced: true,
          },
        );
        set(state => ({
          tokenListMap: nextTokenListMap,
          isLoadingByAddress: {
            ...state.isLoadingByAddress,
            // cache已经拿到，但是不是所有token都拿到
            [normalizedAddress]: { loading: false, allLoading: true },
          },
        }));
        trace.mark('cache-store-published', {
          itemCount: mergedCacheTokens.length,
        });
      }

      /**
       * 阶段三： 从链接口中获取数据
       */
      let chainIdList: string[] = [];
      if (targetChainServerId) {
        chainIdList = [targetChainServerId];
      } else {
        // 单地址的查询还是使用 usedChainList，不然担心 token 选择器之类的地方用户找不到自己的 token
        const chains = await openapi.usedChainList(address);
        chainIdList = chains.map(item => item.id);
      }
      trace.mark('remote-chains-resolved', {
        chainCount: chainIdList.length,
      });
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
              const tokenList = filterInterfaceTokenList(
                chainTokensRes.map(item =>
                  tokenItemToITokenItem(item, address),
                ),
              );
              return tokenList;
            }),
        ),
      );
      const results = res
        .map(result => (result.status === 'fulfilled' ? result.value : []))
        .flat() as ITokenItem[];
      trace.mark('remote-token-responses', { itemCount: results.length });

      if (targetChainServerId) {
        const currentState = get();
        const previousTokens =
          currentState.tokenListMap[normalizedAddress] || [];
        const nextTokenListMap = {
          ...currentState.tokenListMap,
          [normalizedAddress]: replaceTokensByChain(
            previousTokens,
            results,
            targetChainServerId,
          ),
        };
        syncTokenRuntimeStoresFromTokenListMap(
          nextTokenListMap,
          [normalizedAddress],
          'remote',
          {
            markTokenListMapSynced: true,
          },
        );
        set(() => ({
          tokenListMap: nextTokenListMap,
        }));
      } else {
        const nextTokenListMap = {
          ...get().tokenListMap,
          [normalizedAddress]: results,
        };
        syncTokenRuntimeStoresFromTokenListMap(
          nextTokenListMap,
          [normalizedAddress],
          'remote',
          {
            markTokenListMapSynced: true,
          },
        );
        set(() => ({
          tokenListMap: nextTokenListMap,
        }));
        syncRemoteTokens(normalizedAddress, results);
      }
      trace.mark('remote-store-published', { itemCount: results.length });
      trace.finish({ path: 'remote' });
    } catch (error) {
      trace.fail({ phase: 'refresh' });
      throw error;
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

const patchSingleTokenInStore = (address: string, token: ITokenItem) => {
  const normalizedAddress = normalizeAddress(address);
  const nextToken = tokenItemToITokenItem(token, normalizedAddress);

  const currentState = tokenListStore.getState();
  const currentTokens = currentState.tokenListMap[normalizedAddress] || [];
  const matchedIndex = currentTokens.findIndex(
    item =>
      item.chain.toLowerCase() === nextToken.chain.toLowerCase() &&
      isSameAddress(item.id, nextToken.id),
  );
  const hasPositiveAmount = (nextToken.amount || 0) > 0;
  let nextTokens = currentTokens;

  if (matchedIndex > -1) {
    if (hasPositiveAmount) {
      nextTokens = currentTokens.slice();
      nextTokens[matchedIndex] = nextToken;
    } else {
      nextTokens = currentTokens.filter((_, index) => index !== matchedIndex);
    }
  } else if (hasPositiveAmount) {
    nextTokens = [...currentTokens, nextToken];
  }

  if (nextTokens === currentTokens) {
    return;
  }

  const nextTokenListMap = {
    ...currentState.tokenListMap,
    [normalizedAddress]: nextTokens,
  };
  syncTokenRuntimeStoresFromTokenListMap(
    nextTokenListMap,
    [normalizedAddress],
    'remote',
    {
      markTokenListMapSynced: true,
    },
  );
  tokenListStore.setState({
    tokenListMap: nextTokenListMap,
  });
};

eventBus.on(EVENT_PATCH_SINGLE_TOKEN, detail => {
  patchSingleTokenInStore(
    detail.address,
    tokenItemToITokenItem(detail.token, detail.address),
  );
});

const getTokenListMapChangedAddresses = (
  previousTokenListMap: TokenListState['tokenListMap'],
  nextTokenListMap: TokenListState['tokenListMap'],
) => {
  const changedAddresses = new Set<string>();
  const addresses = new Set([
    ...Object.keys(previousTokenListMap).map(normalizeAddress),
    ...Object.keys(nextTokenListMap).map(normalizeAddress),
  ]);

  addresses.forEach(address => {
    if (previousTokenListMap[address] !== nextTokenListMap[address]) {
      changedAddresses.add(address);
    }
  });

  return changedAddresses;
};

let lastComputedTokenListMap = tokenListStore.getState().tokenListMap;
tokenListStore.subscribe(state => {
  if (state.tokenListMap === lastComputedTokenListMap) {
    return;
  }
  if (state.tokenListMap === lastTokenListMapSyncedToRuntime) {
    lastComputedTokenListMap = state.tokenListMap;
    lastTokenListMapSyncedToRuntime = undefined;
    return;
  }
  const previousTokenListMap = lastComputedTokenListMap;
  const changedAddresses = getTokenListMapChangedAddresses(
    previousTokenListMap,
    state.tokenListMap,
  );
  lastComputedTokenListMap = state.tokenListMap;
  if (!changedAddresses.size) {
    return;
  }
  tokenEntityResourceStore.syncChangedAddressesFromTokenListMap(
    state.tokenListMap,
    changedAddresses,
  );
  useTokenIndexStore
    .getState()
    .syncFromTokenListMap(state.tokenListMap, Array.from(changedAddresses));
});

const getChangedTokenEntityIdsFromMetaMap = (
  previousMetaMap: ReturnType<typeof tokenEntityResourceStore.getMetaMap>,
  nextMetaMap: ReturnType<typeof tokenEntityResourceStore.getMetaMap>,
) => {
  const changedTokenIds: TokenEntityId[] = [];
  const tokenIds = new Set([
    ...Object.keys(previousMetaMap),
    ...Object.keys(nextMetaMap),
  ]);

  tokenIds.forEach(tokenId => {
    if (previousMetaMap[tokenId]?.version !== nextMetaMap[tokenId]?.version) {
      changedTokenIds.push(tokenId as TokenEntityId);
    }
  });

  return changedTokenIds;
};

let lastTokenEntityMetaMap = tokenEntityResourceStore.getMetaMap();
tokenEntityResourceStore.subscribe(state => {
  if (state.metaMap === lastTokenEntityMetaMap) {
    return;
  }

  const previousMetaMap = lastTokenEntityMetaMap;
  lastTokenEntityMetaMap = state.metaMap;
  const changedTokenIds = getChangedTokenEntityIdsFromMetaMap(
    previousMetaMap,
    state.metaMap,
  );

  useTokenAssetsIndexStore
    .getState()
    .syncChangedTokenAssetsResults(changedTokenIds);
});

export default tokenListStore;
