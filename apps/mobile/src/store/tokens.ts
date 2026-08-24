import { queryTokensCache } from '@/core/apis/tokenCache';
import { openapi } from '@/core/request';
import { zCreate, zMutative } from '@/core/utils/reexports';
import { mapWithJsBudget } from '@/core/utils/cooperativeWork';
import { TokenItemEntity } from '@/databases/entities/tokenitem';
import {
  syncRemoteTokens,
  syncRemoteTokensForAddresses,
} from '@/databases/sync/assets';
import { registerSyncAbortHandler } from '@/databases/sync/abort';
import { eventBus, EVENT_PATCH_SINGLE_TOKEN } from '@/utils/events';
import {
  commonTokenFilter,
  defaultTokenFilter,
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
import { isNonProductionDiagnosticsEnabled } from '@/core/utils/diagnosticEnv';
import { AddressBatchRefreshCoordinator } from '@/core/utils/addressBatchRefreshCoordinator';
import { LatestAsyncRequest } from '@/core/utils/latestAsyncRequest';
import { LatestAddressRequest } from '@/core/utils/latestAddressRequest';
import {
  createAddressListSnapshotHydrator,
  getAddressesWithoutListSnapshot,
  mergeAddressListSnapshots,
} from './_addressListSnapshot';
import type {
  AssetProjectionRowRange,
  RestoredAssetProjection,
  RestoredAssetProjectionRows,
} from '@/databases/assetProjection';
import type { TokenItemWithEntity } from '@rabby-wallet/rabby-api/dist/types';
import {
  isAssetProjectionPersistenceActive,
  restoreAssetProjection,
  restoreAssetProjectionRows,
  scheduleAssetProjectionPersistence,
  subscribeAssetProjectionDatabaseCommits,
} from './assetProjectionPersistence';
import {
  getAssetSourceReadinessChangedAddresses,
  hasConfirmedAssetProjectionSources,
  markAssetSourceSnapshotsReady,
  resolveAssetProjectionAvailability,
  type AssetProjectionAvailability,
  type AssetSourceSnapshotReadiness,
} from './assetProjectionAvailability';
import {
  TokenProjectionPersistenceGate,
  type AddressPersistenceTicket,
} from './tokenProjectionPersistenceGate';

export type { ITokenItem, TokenAssetsResult } from '@/types/assets';

type TokenAssetsProjectionSourceSections = {
  primary: ITokenItem[];
  additionalDefault: ITokenItem[];
  additionalLp: ITokenItem[];
  lowValueDefault: ITokenItem[];
  lowValueLp: ITokenItem[];
};

type TokenAssetsProjectionResult = TokenAssetsResult & {
  sourceSections: TokenAssetsProjectionSourceSections;
  lpLowValueTokenPreviewLogoUrls: string[];
};

const multiAddressTokenRequests = new LatestAsyncRequest();
const multiAddressTokenBatchRefreshes = new AddressBatchRefreshCoordinator();
const tokenAddressRequests = new LatestAddressRequest();
const tokenProjectionPersistenceGate = new TokenProjectionPersistenceGate();

registerSyncAbortHandler(() => tokenProjectionPersistenceGate.clear());

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
  sourceSnapshotReadyByAddress: AssetSourceSnapshotReadiness;
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
  batchGetTokenList(
    addresses: string[],
    force?: boolean,
    options?: {
      preferredMultiAssetsProjectionKey?: string;
    },
  ): Promise<void>;
  getTokenList(
    address: string,
    force?: boolean,
    chainServerId?: string,
  ): Promise<void>;
  setTokenDisplayMode(mode: TokenDisplayMode): void;
}

const partitionDefaultTokenProjection = ({
  defaultProjectionCandidates,
  coreTokens,
  totalValue,
}: {
  defaultProjectionCandidates: ITokenItem[];
  coreTokens: ITokenItem[];
  totalValue: number;
}) => {
  const threshold = Math.min((totalValue || 0) / 100, 1000);
  const thresholdIndex = coreTokens.findIndex(
    token => (token.usd_value || 0) < threshold,
  );
  const hasDefaultLimit =
    coreTokens.length > 3 &&
    thresholdIndex > -1 &&
    thresholdIndex <= coreTokens.length - 4;

  const sortedTokens = defaultProjectionCandidates
    .slice()
    .sort((a, b) => (b.usd_value || 0) - (a.usd_value || 0));
  const defaultTokens: ITokenItem[] = [];
  const hiddenTokens: ITokenItem[] = [];

  sortedTokens.forEach(token => {
    const isDefaultVisible =
      !!token.is_core &&
      (!hasDefaultLimit || (token.usd_value || 0) >= threshold);
    (isDefaultVisible ? defaultTokens : hiddenTokens).push(token);
  });

  const visibleTokens = defaultTokens.slice(0, 20);
  const remainingTokens = defaultTokens
    .slice(20)
    .concat(hiddenTokens)
    .sort((a, b) => {
      const aValue = a.usd_value || 0;
      const bValue = b.usd_value || 0;
      const aRank = a.is_core ? (aValue > 0 ? 0 : 2) : 1;
      const bRank = b.is_core ? (bValue > 0 ? 0 : 2) : 1;
      return aRank === bRank ? bValue - aValue : aRank - bRank;
    });

  return { visibleTokens, remainingTokens };
};

const buildDefaultTokenProjectionSections = (
  defaultProjectionCandidates: ITokenItem[],
  deferredCandidates: ITokenItem[],
) => {
  const coreTokens = defaultProjectionCandidates.filter(token => token.is_core);
  const totalValue = coreTokens.reduce(
    (sum, token) => sum + (token.usd_value || 0),
    0,
  );
  const { visibleTokens, remainingTokens } = partitionDefaultTokenProjection({
    defaultProjectionCandidates,
    coreTokens,
    totalValue,
  });
  const defaultAdditionalTokens = remainingTokens.filter(defaultTokenFilter);
  const defaultLowValueTokens = deferredCandidates.filter(defaultTokenFilter);
  const lpAdditionalTokens = remainingTokens.filter(
    token => includeLpTokensFilter(token) && !lpTokenFilter(token, false),
  );
  const lpLowValueTokens = deferredCandidates.filter(
    token => includeLpTokensFilter(token) && !lpTokenFilter(token, false),
  );

  return {
    defaultVisibleTokens: visibleTokens,
    defaultAdditionalTokens,
    defaultLowValueTokens,
    lpAdditionalTokens,
    lpLowValueTokens,
  };
};

const buildVisibleTokenAssetsResult = (
  defaultProjectionCandidates: ITokenItem[],
  deferredCandidates: ITokenItem[],
  isLpTokenEnabled?: boolean,
): TokenAssetsProjectionResult => {
  const {
    defaultVisibleTokens,
    defaultAdditionalTokens,
    defaultLowValueTokens,
    lpAdditionalTokens,
    lpLowValueTokens,
  } = buildDefaultTokenProjectionSections(
    defaultProjectionCandidates,
    deferredCandidates,
  );
  const additionalTokens = isLpTokenEnabled
    ? lpAdditionalTokens
    : defaultAdditionalTokens;
  const lowValueTokens = isLpTokenEnabled
    ? lpLowValueTokens
    : defaultLowValueTokens;
  const hasLpTokens = lpAdditionalTokens.length + lpLowValueTokens.length > 0;

  return {
    tokens: defaultVisibleTokens.concat(additionalTokens, lowValueTokens),
    sourceSections: {
      primary: defaultVisibleTokens,
      additionalDefault: defaultAdditionalTokens,
      additionalLp: lpAdditionalTokens,
      lowValueDefault: defaultLowValueTokens,
      lowValueLp: lpLowValueTokens,
    },
    defaultVisibleTokenCount: defaultVisibleTokens.length,
    additionalTokenCount: additionalTokens.length,
    lowValueTokenCount: lowValueTokens.length,
    additionalCoreUsdValue: defaultAdditionalTokens.reduce(
      (total, token) =>
        token.is_core ? total + (token.usd_value || 0) : total,
      0,
    ),
    lowValueTokenPreviewLogoUrls: lowValueTokens
      .slice(0, 3)
      .map(token => token.logo_url),
    lpLowValueTokenPreviewLogoUrls: lpLowValueTokens
      .slice(0, 3)
      .map(token => token.logo_url),
    hasAdditionalTokens:
      defaultAdditionalTokens.length + defaultLowValueTokens.length > 0 ||
      hasLpTokens,
    hasLpTokens,
  };
};

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

const normalizeRemoteTokenList = async (
  tokens: TokenItemWithEntity[],
  owner: string,
  shouldContinue?: () => boolean,
) => {
  const normalizedTokens = await mapWithJsBudget(
    tokens,
    token => tokenItemToITokenItem(token, owner),
    { shouldContinue },
  );

  return normalizedTokens ? filterInterfaceTokenList(normalizedTokens) : null;
};

const isDataExpired = async (address: string) => {
  const isExpired = await TokenItemEntity.isExpired(address);
  return isExpired;
};

const getDataExpirationByAddress = async (addresses: string[]) =>
  Object.fromEntries(
    await Promise.all(
      addresses.map(
        async address => [address, await isDataExpired(address)] as const,
      ),
    ),
  ) as Record<string, boolean>;

const normalizeAddress = (address: string) => address.toLowerCase();

const normalizeAddresses = (addresses: string[]) =>
  addresses.map(normalizeAddress);

const normalizeTokenProjectionChainServerId = (chainServerId?: string) =>
  chainServerId || undefined;

const normalizeTokenProjectionLpMode = (isLpTokenEnabled?: boolean) =>
  !!isLpTokenEnabled;

const normalizeTokenDisplayMode = (
  tokenDisplayMode?: TokenDisplayMode,
): TokenDisplayMode => tokenDisplayMode || 'byAddress';

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

export type SingleTokenAssetsProjectionInput = {
  address: string;
  chainServerId?: string;
  isLpTokenEnabled?: boolean;
};

export type MultiTokenAssetsProjectionInput = {
  addresses: string[];
  chainServerId?: string;
  isLpTokenEnabled?: boolean;
  tokenDisplayMode?: TokenDisplayMode;
};

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
  rows: TokenAssetsIndexRow[];
  tokenIds: TokenEntityId[];
  defaultVisibleTokenCount: number;
  additionalTokenCount: number;
  lowValueTokenCount: number;
  additionalCoreUsdValue: number;
  lowValueTokenPreviewLogoUrls: string[];
  lpLowValueTokenPreviewLogoUrls: string[];
  hasAdditionalTokens: boolean;
  hasLpTokens: boolean;
  segments: TokenAssetsIndexSegments;
};

export type TokenAssetsIndexSegment = {
  rows: TokenAssetsIndexRow[];
  tokenIds: TokenEntityId[];
};

export type TokenAssetsIndexSegments = {
  primary: TokenAssetsIndexSegment;
  additionalDefault: TokenAssetsIndexSegment;
  additionalLp: TokenAssetsIndexSegment;
  lowValueDefault: TokenAssetsIndexSegment;
  lowValueLp: TokenAssetsIndexSegment;
};

export type TokenAssetsIndexSegmentKey = keyof TokenAssetsIndexSegments;

const TOKEN_ASSETS_INDEX_SEGMENT_KEYS: TokenAssetsIndexSegmentKey[] = [
  'primary',
  'additionalDefault',
  'additionalLp',
  'lowValueDefault',
  'lowValueLp',
];

export type TokenGroupResourceValue = {
  groupKey: string;
  primaryTokenId: TokenEntityId;
  memberTokenIds: TokenEntityId[];
  summary: ITokenItem;
};

const TOKEN_ENTITY_RESOURCE_FAMILY = 'token.entity';
const TOKEN_GROUP_RESOURCE_FAMILY = 'token.group';
export const EMPTY_TOKEN_ENTITY_IDS: TokenEntityId[] = [];
const EMPTY_STRING_LIST: string[] = [];
const EMPTY_TOKEN_ASSETS_INDEX_ROWS: TokenAssetsIndexRow[] = [];
const EMPTY_TOKEN_SELECT_INDEX_ROWS: TokenSelectIndexRow[] = [];
const EMPTY_TOKEN_ASSETS_INDEX_SEGMENT: TokenAssetsIndexSegment = {
  rows: EMPTY_TOKEN_ASSETS_INDEX_ROWS,
  tokenIds: EMPTY_TOKEN_ENTITY_IDS,
};
export const EMPTY_TOKEN_ASSETS_INDEX_SEGMENTS: TokenAssetsIndexSegments = {
  primary: EMPTY_TOKEN_ASSETS_INDEX_SEGMENT,
  additionalDefault: EMPTY_TOKEN_ASSETS_INDEX_SEGMENT,
  additionalLp: EMPTY_TOKEN_ASSETS_INDEX_SEGMENT,
  lowValueDefault: EMPTY_TOKEN_ASSETS_INDEX_SEGMENT,
  lowValueLp: EMPTY_TOKEN_ASSETS_INDEX_SEGMENT,
};

export const EMPTY_TOKEN_ASSETS_INDEX_RESULT: TokenAssetsIndexResult = {
  rows: EMPTY_TOKEN_ASSETS_INDEX_ROWS,
  tokenIds: EMPTY_TOKEN_ENTITY_IDS,
  defaultVisibleTokenCount: 0,
  additionalTokenCount: 0,
  lowValueTokenCount: 0,
  additionalCoreUsdValue: 0,
  lowValueTokenPreviewLogoUrls: EMPTY_STRING_LIST,
  lpLowValueTokenPreviewLogoUrls: EMPTY_STRING_LIST,
  hasAdditionalTokens: false,
  hasLpTokens: false,
  segments: EMPTY_TOKEN_ASSETS_INDEX_SEGMENTS,
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
  private readonly tokenChangeListeners = new Set<
    (tokenIds: TokenEntityId[]) => void
  >();
  // Projection validation can check one address revision without scanning its tokens.
  private readonly addressVersions = new Map<string, number>();

  constructor() {
    super(TOKEN_ENTITY_RESOURCE_FAMILY, { mutative: true });
  }

  subscribeTokenChanges = (listener: (tokenIds: TokenEntityId[]) => void) => {
    this.tokenChangeListeners.add(listener);

    return () => {
      this.tokenChangeListeners.delete(listener);
    };
  };

  getAddressVersion = (address: string) =>
    this.addressVersions.get(normalizeAddress(address)) || 0;

  upsertTokens = (
    tokens: ITokenItem[],
    source: ObservableResourceValueSource = 'remote',
    options?: {
      pruneMissing?: boolean;
      pruneMissingAddresses?: Set<string>;
      skipDerivedUpdates?: boolean;
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

    const changedTokenIds = [
      ...changedTokens.map(({ tokenId }) => tokenId),
      ...removedTokenIds.map(tokenId => tokenId as TokenEntityId),
    ];
    if (!options?.skipDerivedUpdates) {
      new Set(changedTokenIds.map(getTokenEntityIdAddress)).forEach(address => {
        this.addressVersions.set(
          address,
          (this.addressVersions.get(address) || 0) + 1,
        );
      });
      this.tokenChangeListeners.forEach(listener => listener(changedTokenIds));
    }
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
      const isValueChanged =
        !prevValue ||
        prevValue.groupKey !== value.groupKey ||
        prevValue.primaryTokenId !== value.primaryTokenId ||
        prevValue.memberTokenIds.length !== value.memberTokenIds.length ||
        prevValue.memberTokenIds.some(
          (tokenId, index) => tokenId !== value.memberTokenIds[index],
        ) ||
        !!getChangedTokenKeys(prevValue.summary, value.summary)?.length;

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
  token: ITokenItem,
): TokenGroupId => {
  const groupKey = getTokenRuntimeGroupKey(token) || buildTokenEntityId(token);
  return `${listKey}::${groupKey}` as TokenGroupId;
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
      get().syncFromTokenListMap({ [normalizedAddress]: tokens }, [
        normalizedAddress,
      ]);
    },
    syncFromTokenListMap(tokenListMap, addresses) {
      const addressSet = addresses
        ? normalizeAddressSet(addresses)
        : new Set(Object.keys(tokenListMap).map(normalizeAddress));

      const currentState = get();
      const updates = Array.from(addressSet).map(address => {
        const tokens = tokenListMap[address] || [];
        const nextTokenIds = buildStableTokenEntityIds(
          sortByUsdValueDesc(tokens),
          currentState.addressTokenIds[address],
        );
        const nextStaticItems = tokens.map(buildTokenStaticIndexItem);
        const nextStaticTokenIds = new Set(
          nextStaticItems.map(item => item.tokenId),
        );
        const removedStaticTokenIds = (
          currentState.addressTokenIds[address] || EMPTY_TOKEN_ENTITY_IDS
        ).filter(tokenId => !nextStaticTokenIds.has(tokenId));

        return {
          address,
          nextTokenIds,
          nextStaticItems,
          removedStaticTokenIds,
        };
      });

      set(draft => {
        updates.forEach(
          ({
            address,
            nextTokenIds,
            nextStaticItems,
            removedStaticTokenIds,
          }) => {
            let didChange = false;
            if (draft.addressTokenIds[address] !== nextTokenIds) {
              draft.addressTokenIds[address] = nextTokenIds;
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

            removedStaticTokenIds.forEach(tokenId => {
              if (draft.tokenStaticMap[tokenId]) {
                delete draft.tokenStaticMap[tokenId];
                didChange = true;
              }
            });

            if (didChange) {
              draft.addressVersions[address] =
                (draft.addressVersions[address] || 0) + 1;
            }
          },
        );
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

const getTokenIndexAddressVersionKey = (
  state: Pick<TokenIndexState, 'addressVersions'>,
  addresses: string[],
) =>
  normalizeAddresses(addresses)
    .map(address => `${address}:${state.addressVersions[address] || 0}`)
    .join('|');

const getMultiTokenAssetsSourceVersionKey = (
  state: Pick<TokenIndexState, 'addressVersions'>,
  addresses: string[],
) =>
  normalizeAddresses(addresses)
    .map(
      address =>
        `${address}:${
          state.addressVersions[address] || 0
        }:${tokenEntityResourceStore.getAddressVersion(address)}`,
    )
    .join('|');

const getMultiTokenAssetsSourceVersionDiagnostics = (
  state: Pick<TokenIndexState, 'addressVersions'>,
  addresses: string[],
) => {
  if (!isNonProductionDiagnosticsEnabled) {
    return undefined;
  }

  return normalizeAddresses(addresses).reduce(
    (summary, address) => {
      const indexVersion = state.addressVersions[address] || 0;
      const entityVersion = tokenEntityResourceStore.getAddressVersion(address);
      summary.indexVersionTotal += indexVersion;
      summary.entityVersionTotal += entityVersion;
      summary.indexVersionAddressCount += Number(indexVersion > 0);
      summary.entityVersionAddressCount += Number(entityVersion > 0);
      return summary;
    },
    {
      indexVersionTotal: 0,
      entityVersionTotal: 0,
      indexVersionAddressCount: 0,
      entityVersionAddressCount: 0,
    },
  );
};

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
  const addressVersionKey = getTokenIndexAddressVersionKey(state, addresses);
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
      const groupId = buildTokenGroupId(listKey, token);
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

const buildTokenAssetsIndexSegment = (
  tokens: ITokenItem[],
  listKey: string | undefined,
  segmentKey: keyof TokenAssetsIndexSegments,
  previousSegment?: TokenAssetsIndexSegment,
): TokenAssetsIndexSegment => {
  const rows = buildTokenAssetsIndexRows(
    tokens,
    listKey ? `${listKey}::${segmentKey}` : undefined,
    previousSegment?.rows,
  );
  const tokenIds = buildStableTokenEntityIds(tokens, previousSegment?.tokenIds);

  if (
    previousSegment &&
    previousSegment.rows === rows &&
    previousSegment.tokenIds === tokenIds
  ) {
    return previousSegment;
  }

  return { rows, tokenIds };
};

const buildTokenAssetsIndexSegments = (
  sourceSections: TokenAssetsProjectionSourceSections,
  listKey: string | undefined,
  previousSegments?: TokenAssetsIndexSegments,
): TokenAssetsIndexSegments => {
  const segments: TokenAssetsIndexSegments = {
    primary: buildTokenAssetsIndexSegment(
      sourceSections.primary,
      listKey,
      'primary',
      previousSegments?.primary,
    ),
    additionalDefault: buildTokenAssetsIndexSegment(
      sourceSections.additionalDefault,
      listKey,
      'additionalDefault',
      previousSegments?.additionalDefault,
    ),
    additionalLp: buildTokenAssetsIndexSegment(
      sourceSections.additionalLp,
      listKey,
      'additionalLp',
      previousSegments?.additionalLp,
    ),
    lowValueDefault: buildTokenAssetsIndexSegment(
      sourceSections.lowValueDefault,
      listKey,
      'lowValueDefault',
      previousSegments?.lowValueDefault,
    ),
    lowValueLp: buildTokenAssetsIndexSegment(
      sourceSections.lowValueLp,
      listKey,
      'lowValueLp',
      previousSegments?.lowValueLp,
    ),
  };

  if (
    previousSegments &&
    previousSegments.primary === segments.primary &&
    previousSegments.additionalDefault === segments.additionalDefault &&
    previousSegments.additionalLp === segments.additionalLp &&
    previousSegments.lowValueDefault === segments.lowValueDefault &&
    previousSegments.lowValueLp === segments.lowValueLp
  ) {
    return previousSegments;
  }

  return segments;
};

const buildTokenAssetsIndexResult = (
  result: TokenAssetsProjectionResult,
  listKey?: string,
  previousResult?: TokenAssetsIndexResult,
): TokenAssetsIndexResult => {
  const rows = buildTokenAssetsIndexRows(
    result.tokens,
    listKey,
    previousResult?.rows,
  );
  const segments = buildTokenAssetsIndexSegments(
    result.sourceSections,
    listKey,
    previousResult?.segments,
  );

  const nextResult = {
    rows,
    tokenIds: buildStableTokenEntityIds(
      result.tokens,
      previousResult?.tokenIds,
    ),
    defaultVisibleTokenCount: result.defaultVisibleTokenCount,
    additionalTokenCount: result.additionalTokenCount,
    lowValueTokenCount: result.lowValueTokenCount,
    additionalCoreUsdValue: result.additionalCoreUsdValue,
    lowValueTokenPreviewLogoUrls: buildStableStringList(
      result.lowValueTokenPreviewLogoUrls,
      previousResult?.lowValueTokenPreviewLogoUrls,
    ),
    lpLowValueTokenPreviewLogoUrls: buildStableStringList(
      result.lpLowValueTokenPreviewLogoUrls,
      previousResult?.lpLowValueTokenPreviewLogoUrls,
    ),
    hasAdditionalTokens: result.hasAdditionalTokens,
    hasLpTokens: result.hasLpTokens,
    segments,
  };

  if (
    previousResult &&
    previousResult.rows === nextResult.rows &&
    previousResult.tokenIds === nextResult.tokenIds &&
    previousResult.defaultVisibleTokenCount ===
      nextResult.defaultVisibleTokenCount &&
    previousResult.additionalTokenCount === nextResult.additionalTokenCount &&
    previousResult.lowValueTokenCount === nextResult.lowValueTokenCount &&
    previousResult.additionalCoreUsdValue ===
      nextResult.additionalCoreUsdValue &&
    previousResult.lowValueTokenPreviewLogoUrls ===
      nextResult.lowValueTokenPreviewLogoUrls &&
    previousResult.lpLowValueTokenPreviewLogoUrls ===
      nextResult.lpLowValueTokenPreviewLogoUrls &&
    previousResult.hasAdditionalTokens === nextResult.hasAdditionalTokens &&
    previousResult.hasLpTokens === nextResult.hasLpTokens &&
    previousResult.segments === nextResult.segments
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
): TokenAssetsProjectionResult => {
  const tokens = chainServerId
    ? allTokens.filter(item => item.chain === chainServerId)
    : allTokens;
  const lowValueTokens: ITokenItem[] = [];
  const nonRiskTokens = tokens.filter(token => {
    const usdValue = token.usd_value || 0;
    const isLowValueToken = token.is_core === null && usdValue === 0;
    const isRiskToken = token.is_verified === false || token.is_suspicious;
    if (!isRiskToken && isLowValueToken) {
      lowValueTokens.push(token);
    }
    return !isRiskToken && !isLowValueToken;
  });
  const displayMode = tokenDisplayMode || 'byAddress';
  const aggregatedNonRiskTokens =
    displayMode === 'byAddress'
      ? nonRiskTokens
      : aggregateTokens(nonRiskTokens, displayMode);
  const aggregatedLowValueTokens =
    displayMode === 'byAddress'
      ? lowValueTokens
      : aggregateTokens(lowValueTokens, displayMode);

  return buildVisibleTokenAssetsResult(
    aggregatedNonRiskTokens,
    aggregatedLowValueTokens,
    isLpTokenEnabled,
  );
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

const partitionSingleAssetsTokens = (
  tokens: ITokenItem[],
  chainServerId?: string,
) => {
  const filteredTokens = tokens.filter(
    token => !chainServerId || token.chain === chainServerId,
  );
  const deferredCandidates: ITokenItem[] = [];
  const defaultProjectionCandidates = filteredTokens.filter(token => {
    const usdValue = token.usd_value || 0;
    const isZeroCore = !!token.is_core && usdValue === 0;
    const shouldDefer =
      token.is_verified === false ||
      (usdValue === 0 && !isZeroCore) ||
      token.is_suspicious;
    if (shouldDefer) {
      deferredCandidates.push(token);
    }
    return !shouldDefer;
  });

  return { defaultProjectionCandidates, deferredCandidates };
};

const computeSingleAssetsFromTokens = (
  tokens: ITokenItem[],
  chainServerId?: string,
  isLpTokenEnabled?: boolean,
): TokenAssetsProjectionResult => {
  const { defaultProjectionCandidates, deferredCandidates } =
    partitionSingleAssetsTokens(tokens, chainServerId);

  return buildVisibleTokenAssetsResult(
    defaultProjectionCandidates,
    deferredCandidates,
    isLpTokenEnabled,
  );
};

export const buildSingleAssetsEligibleTokenIdsFromTokenIds = (
  tokenIds: TokenEntityId[],
  chainServerId?: string,
) => {
  const tokens = tokenIds
    .map(tokenId => tokenEntityResourceStore.getValue(tokenId))
    .filter((token): token is ITokenItem => !!token);
  const { defaultProjectionCandidates, deferredCandidates } =
    partitionSingleAssetsTokens(tokens, chainServerId);
  const {
    defaultVisibleTokens,
    defaultAdditionalTokens,
    defaultLowValueTokens,
  } = buildDefaultTokenProjectionSections(
    defaultProjectionCandidates,
    deferredCandidates,
  );

  return defaultVisibleTokens
    .concat(defaultAdditionalTokens, defaultLowValueTokens)
    .map(buildTokenEntityId);
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
  singleAssetsAvailabilityByKey: Record<string, AssetProjectionAvailability>;
  multiAssetsAvailabilityByKey: Record<string, AssetProjectionAvailability>;
  singleAssetsConfigByKey: Record<string, SingleTokenAssetsIndexConfig>;
  multiAssetsConfigByKey: Record<string, MultiTokenAssetsIndexConfig>;
  syncSingleAssetsResult(input: {
    key: string;
    address: string;
    tokenIds: TokenEntityId[];
    chainServerId?: string;
    isLpTokenEnabled?: boolean;
  }): void;
  ensureSingleAssetsResult(input: SingleTokenAssetsProjectionInput): string;
  ensureMultiAssetsResult(input: MultiTokenAssetsProjectionInput): string;
  syncSingleAssetsResultsForAddresses(addresses: string[]): void;
  syncMultiAssetsResultsForAddresses(addresses: string[]): void;
  syncMultiAssetsResult(input: {
    key: string;
    addresses: string[];
    tokenIds: TokenEntityId[];
    chainServerId?: string;
    isLpTokenEnabled?: boolean;
    tokenDisplayMode?: TokenDisplayMode;
  }): void;
  syncChangedTokenAssetsResults(tokenIds: TokenEntityId[]): void;
};

type SingleTokenAssetsIndexConfig = {
  key: string;
  address: string;
  tokenIds: TokenEntityId[];
  chainServerId?: string;
  isLpTokenEnabled?: boolean;
};

type MultiTokenAssetsIndexConfig = {
  key: string;
  addresses: string[];
  tokenIds: TokenEntityId[];
  sourceVersionKey: string;
  chainServerId?: string;
  isLpTokenEnabled?: boolean;
  tokenDisplayMode?: TokenDisplayMode;
};

type TokenProjectionScene = 'single-address' | 'multi-address';
const TOKEN_ASSET_PROJECTION_RULE_VERSION = 4;
const TOKEN_ASSET_PROJECTION_ENTITY_RESTORE_MODE = 'staged-v1';
const TOKEN_ASSET_PROJECTION_ENTITY_RESTORE_BATCH_SIZE = 200;
const TOKEN_ASSET_PROJECTION_INITIAL_SEGMENT_RESTORE_BATCH_SIZE = 40;

const getTokenAssetsProjectionAvailability = (
  config:
    | SingleTokenAssetsIndexConfig
    | MultiTokenAssetsIndexConfig
    | undefined,
  result: TokenAssetsIndexResult | undefined,
  isRestoring = false,
) => {
  const addresses = config
    ? 'address' in config
      ? [config.address]
      : config.addresses
    : [];

  return resolveAssetProjectionAvailability({
    hasProjection: !!config && !!result,
    hasData: !!result?.rows.length,
    hasCompleteSource:
      !!config &&
      hasConfirmedAssetProjectionSources(
        addresses,
        tokenListStore.getState().sourceSnapshotReadyByAddress,
      ),
    isRestoring,
  });
};

const parsePersistedStringList = (value: unknown) => {
  if (
    !Array.isArray(value) ||
    !value.every(item => item == null || typeof item === 'string')
  ) {
    return null;
  }

  // Older JSON snapshots can contain null where an in-memory optional logo
  // was undefined. The preview is cosmetic, so keep the projection usable.
  return value.filter((item): item is string => typeof item === 'string');
};

const scheduleTokenAssetsProjectionPersistence = (
  key: string,
  scene: TokenProjectionScene,
  result: TokenAssetsIndexResult,
  tokenDisplayMode: TokenDisplayMode = 'byAddress',
) => {
  const state = useTokenAssetsIndexStore.getState();
  const config =
    scene === 'single-address'
      ? state.singleAssetsConfigByKey[key]
      : state.multiAssetsConfigByKey[key];
  if (!config) {
    return;
  }
  const addresses = 'address' in config ? [config.address] : config.addresses;
  const isSourceSnapshotReady = hasConfirmedAssetProjectionSources(
    addresses,
    tokenListStore.getState().sourceSnapshotReadyByAddress,
  );
  if (!result.rows.length && !isSourceSnapshotReady) {
    return;
  }

  tokenProjectionPersistenceGate.schedule(`${scene}:${key}`, addresses, () => {
    const persistedRows = TOKEN_ASSETS_INDEX_SEGMENT_KEYS.flatMap(
      segmentKey => result.segments[segmentKey].rows,
    );
    const persistedGroups = persistedRows.flatMap(row => {
      if (row.type !== 'group') {
        return [];
      }
      const group = tokenGroupResourceStore.getValue(row.groupId);
      return group
        ? [
            {
              id: row.groupId,
              memberIds: [...group.memberTokenIds],
              primaryTokenId: group.primaryTokenId,
            },
          ]
        : [];
    });
    const groupRowCount = persistedRows.filter(
      row => row.type === 'group',
    ).length;
    if (persistedGroups.length !== groupRowCount) {
      return;
    }

    const selectedSegmentMode = config?.isLpTokenEnabled ? 'lp' : 'default';

    scheduleAssetProjectionPersistence({
      runtimeKey: key,
      kind: 'token',
      scene,
      ruleVersion: TOKEN_ASSET_PROJECTION_RULE_VERSION,
      rows: persistedRows.map(row =>
        row.type === 'group'
          ? { type: 'token-group', id: row.groupId }
          : { type: 'token', id: row.tokenId },
      ),
      groups: persistedGroups.map(group => ({
        id: group.id,
        memberIds: group.memberIds,
      })),
      metadata: {
        entityRestoreMode: TOKEN_ASSET_PROJECTION_ENTITY_RESTORE_MODE,
        groupPrimaryTokenIds: Object.fromEntries(
          persistedGroups.map(group => [group.id, group.primaryTokenId]),
        ),
        defaultVisibleTokenCount: result.defaultVisibleTokenCount,
        additionalTokenCount: result.additionalTokenCount,
        lowValueTokenCount: result.lowValueTokenCount,
        additionalCoreUsdValue: result.additionalCoreUsdValue,
        lowValueTokenPreviewLogoUrls:
          parsePersistedStringList(result.lowValueTokenPreviewLogoUrls) || [],
        lpLowValueTokenPreviewLogoUrls:
          parsePersistedStringList(result.lpLowValueTokenPreviewLogoUrls) || [],
        hasAdditionalTokens: result.hasAdditionalTokens,
        hasLpTokens: result.hasLpTokens,
        tokenDisplayMode,
        selectedSegmentMode,
        segmentRowCounts: Object.fromEntries(
          TOKEN_ASSETS_INDEX_SEGMENT_KEYS.map(segmentKey => [
            segmentKey,
            result.segments[segmentKey].rows.length,
          ]),
        ),
      },
    });
  });
};

type StagedTokenProjectionRestoreMetadata = {
  groupPrimaryTokenIds: Record<string, TokenEntityId>;
  lowValueTokenPreviewLogoUrls: string[];
  lpLowValueTokenPreviewLogoUrls: string[];
  primaryRowCount: number;
  segmentRowCounts: Record<TokenAssetsIndexSegmentKey, number>;
};

const parseTokenProjectionSegmentRowCounts = (
  metadata: Record<string, unknown>,
) => {
  const rawSegmentRowCounts = metadata.segmentRowCounts;
  if (
    !rawSegmentRowCounts ||
    typeof rawSegmentRowCounts !== 'object' ||
    Array.isArray(rawSegmentRowCounts)
  ) {
    return null;
  }

  const segmentRowCounts = {} as Record<TokenAssetsIndexSegmentKey, number>;
  for (const segmentKey of TOKEN_ASSETS_INDEX_SEGMENT_KEYS) {
    const count = (rawSegmentRowCounts as Record<string, unknown>)[segmentKey];
    if (!Number.isInteger(count) || (count as number) < 0) {
      return null;
    }
    segmentRowCounts[segmentKey] = count as number;
  }
  return segmentRowCounts;
};

const buildTokenProjectionSegmentRowRanges = (
  segmentRowCounts: Record<TokenAssetsIndexSegmentKey, number>,
) => {
  let offset = 0;
  return TOKEN_ASSETS_INDEX_SEGMENT_KEYS.reduce((ranges, segmentKey) => {
    const count = segmentRowCounts[segmentKey];
    ranges[segmentKey] = { offset, count };
    offset += count;
    return ranges;
  }, {} as Record<TokenAssetsIndexSegmentKey, AssetProjectionRowRange>);
};

const parseStagedTokenProjectionRestoreMetadata = (
  restored: RestoredAssetProjection,
): StagedTokenProjectionRestoreMetadata | null => {
  if (
    restored.metadata.entityRestoreMode !==
    TOKEN_ASSET_PROJECTION_ENTITY_RESTORE_MODE
  ) {
    return null;
  }

  const rawGroupPrimaryTokenIds = restored.metadata.groupPrimaryTokenIds;
  const groupPrimaryTokenIds =
    rawGroupPrimaryTokenIds &&
    typeof rawGroupPrimaryTokenIds === 'object' &&
    !Array.isArray(rawGroupPrimaryTokenIds)
      ? (rawGroupPrimaryTokenIds as Record<string, unknown>)
      : null;
  const lowValueTokenPreviewLogoUrls = parsePersistedStringList(
    restored.metadata.lowValueTokenPreviewLogoUrls,
  );
  const lpLowValueTokenPreviewLogoUrls = parsePersistedStringList(
    restored.metadata.lpLowValueTokenPreviewLogoUrls,
  );
  const segmentRowCounts = parseTokenProjectionSegmentRowCounts(
    restored.metadata,
  );
  const primaryRowCount = segmentRowCounts?.primary;
  const persistedRowCount = segmentRowCounts
    ? TOKEN_ASSETS_INDEX_SEGMENT_KEYS.reduce(
        (count, segmentKey) => count + segmentRowCounts[segmentKey],
        0,
      )
    : -1;
  const totalRowCount = restored.totalRowCount ?? persistedRowCount;
  const hasSupportedRowSelection =
    restored.rows.length === (primaryRowCount as number) ||
    restored.rows.length === persistedRowCount;

  if (
    !groupPrimaryTokenIds ||
    !lowValueTokenPreviewLogoUrls ||
    !lpLowValueTokenPreviewLogoUrls ||
    !segmentRowCounts ||
    !Number.isInteger(primaryRowCount) ||
    (primaryRowCount as number) < 0 ||
    persistedRowCount !== totalRowCount ||
    !hasSupportedRowSelection
  ) {
    return null;
  }

  const groupMembers = new Map(
    restored.groups.map(group => [group.id, group.memberIds]),
  );
  const parsedGroupPrimaryTokenIds: Record<string, TokenEntityId> = {};
  for (const row of restored.rows) {
    if (row.type !== 'token-group') {
      continue;
    }
    const primaryTokenId = groupPrimaryTokenIds[row.id];
    const memberIds = groupMembers.get(row.id) || [];
    if (
      typeof primaryTokenId !== 'string' ||
      !primaryTokenId ||
      !memberIds.includes(primaryTokenId)
    ) {
      return null;
    }
    parsedGroupPrimaryTokenIds[row.id] = primaryTokenId as TokenEntityId;
  }

  return {
    groupPrimaryTokenIds: parsedGroupPrimaryTokenIds,
    lowValueTokenPreviewLogoUrls,
    lpLowValueTokenPreviewLogoUrls,
    primaryRowCount: primaryRowCount as number,
    segmentRowCounts,
  };
};

const collectRestoredTokenEntityIds = (
  restored: RestoredAssetProjection,
  rows: RestoredAssetProjection['rows'] = restored.rows,
) => {
  const groupMembers = new Map(
    restored.groups.map(group => [group.id, group.memberIds]),
  );
  const tokenIds = new Set<TokenEntityId>();

  rows.forEach(row => {
    if (row.type === 'token') {
      tokenIds.add(row.id as TokenEntityId);
      return;
    }
    if (row.type === 'token-group') {
      (groupMembers.get(row.id) || []).forEach(memberId => {
        tokenIds.add(memberId as TokenEntityId);
      });
    }
  });

  return tokenIds;
};

type StagedTokenProjectionHydrationContext = {
  projectionKey: string;
  generation: number;
  groupMemberIdsById: Map<TokenGroupId, TokenEntityId[]>;
  groupPrimaryTokenIds: Record<string, TokenEntityId>;
  segmentRanges: Record<TokenAssetsIndexSegmentKey, AssetProjectionRowRange>;
  loadedSegmentKeys: Set<TokenAssetsIndexSegmentKey>;
  selectedSegmentMode: 'default' | 'lp';
  tokenDisplayMode: TokenDisplayMode;
};

const stagedTokenProjectionHydrationContexts = new WeakMap<
  TokenAssetsIndexResult,
  StagedTokenProjectionHydrationContext
>();

const tokenProjectionSegmentHydrationRequests = new Map<
  string,
  {
    result: TokenAssetsIndexResult;
    promise: Promise<boolean>;
  }
>();

const createStagedTokenProjectionHydrationContext = (
  restored: RestoredAssetProjection,
  metadata: StagedTokenProjectionRestoreMetadata,
  tokenDisplayMode: TokenDisplayMode,
): StagedTokenProjectionHydrationContext => ({
  projectionKey: restored.projectionKey,
  generation: restored.generation,
  groupMemberIdsById: new Map(
    restored.groups.map(group => [
      group.id as TokenGroupId,
      group.memberIds.map(memberId => memberId as TokenEntityId),
    ]),
  ),
  groupPrimaryTokenIds: metadata.groupPrimaryTokenIds,
  segmentRanges: buildTokenProjectionSegmentRowRanges(
    metadata.segmentRowCounts,
  ),
  loadedSegmentKeys: new Set<TokenAssetsIndexSegmentKey>(
    restored.rows.length ===
    TOKEN_ASSETS_INDEX_SEGMENT_KEYS.reduce(
      (count, segmentKey) => count + metadata.segmentRowCounts[segmentKey],
      0,
    )
      ? TOKEN_ASSETS_INDEX_SEGMENT_KEYS
      : ['primary'],
  ),
  selectedSegmentMode:
    restored.metadata.selectedSegmentMode === 'lp' ? 'lp' : 'default',
  tokenDisplayMode,
});

const collectTokenProjectionSegmentEntityIds = (
  segment: TokenAssetsIndexSegment,
  context: StagedTokenProjectionHydrationContext,
) => {
  const tokenIds = new Set<TokenEntityId>();

  segment.rows.forEach(row => {
    if (row.type === 'token') {
      tokenIds.add(row.tokenId);
      return;
    }
    (context.groupMemberIdsById.get(row.groupId) || []).forEach(tokenId => {
      tokenIds.add(tokenId);
    });
  });

  return tokenIds;
};

const buildStagedTokenProjectionSegment = (
  restored: RestoredAssetProjectionRows,
  context: StagedTokenProjectionHydrationContext,
): TokenAssetsIndexSegment | null => {
  restored.groups.forEach(group => {
    context.groupMemberIdsById.set(
      group.id as TokenGroupId,
      group.memberIds.map(memberId => memberId as TokenEntityId),
    );
  });

  const rows: TokenAssetsIndexRow[] = [];
  const tokenIds: TokenEntityId[] = [];
  for (const row of restored.rows) {
    if (row.type === 'token') {
      const tokenId = row.id as TokenEntityId;
      rows.push({ type: 'token', tokenId });
      tokenIds.push(tokenId);
      continue;
    }
    if (row.type !== 'token-group') {
      return null;
    }
    const groupId = row.id as TokenGroupId;
    const primaryTokenId = context.groupPrimaryTokenIds[groupId];
    const memberIds = context.groupMemberIdsById.get(groupId) || [];
    if (!primaryTokenId || !memberIds.includes(primaryTokenId)) {
      return null;
    }
    rows.push({ type: 'group', groupId });
    tokenIds.push(primaryTokenId);
  }

  return { rows, tokenIds };
};

const buildTokenProjectionResultWithSegments = (
  result: TokenAssetsIndexResult,
  segments: TokenAssetsIndexSegments,
  selectedSegmentMode: 'default' | 'lp',
): TokenAssetsIndexResult => {
  const selectedAdditionalSegment =
    selectedSegmentMode === 'lp'
      ? segments.additionalLp
      : segments.additionalDefault;
  const selectedLowValueSegment =
    selectedSegmentMode === 'lp'
      ? segments.lowValueLp
      : segments.lowValueDefault;

  return {
    ...result,
    rows: segments.primary.rows.concat(
      selectedAdditionalSegment.rows,
      selectedLowValueSegment.rows,
    ),
    tokenIds: segments.primary.tokenIds.concat(
      selectedAdditionalSegment.tokenIds,
      selectedLowValueSegment.tokenIds,
    ),
    segments,
  };
};

const publishHydratedTokenProjectionGroups = (
  segments: TokenAssetsIndexSegment[],
  context: StagedTokenProjectionHydrationContext,
) => {
  const groups: Array<{
    groupId: TokenGroupId;
    value: TokenGroupResourceValue;
  }> = [];

  for (const segment of segments) {
    for (const row of segment.rows) {
      if (row.type !== 'group') {
        continue;
      }
      const memberTokenIds = context.groupMemberIdsById.get(row.groupId) || [];
      const memberTokens = memberTokenIds.map(tokenId =>
        tokenEntityResourceStore.getValue(tokenId),
      );
      if (
        !memberTokenIds.length ||
        !memberTokens.every((token): token is ITokenItem => !!token)
      ) {
        return false;
      }
      const [summary] = aggregateTokens(memberTokens, context.tokenDisplayMode);
      const primaryTokenId = context.groupPrimaryTokenIds[row.groupId];
      if (!summary || buildTokenEntityId(summary) !== primaryTokenId) {
        return false;
      }
      groups.push({
        groupId: row.groupId,
        value: {
          groupKey: summary.groupKey,
          primaryTokenId,
          memberTokenIds,
          summary: stripTokenRuntimeGroupFields(summary),
        },
      });
    }
  }

  tokenGroupResourceStore.upsertGroups(groups, 'hydrate');
  return true;
};

const buildRestoredTokenAssetsIndexResult = (
  restored: RestoredAssetProjection,
  tokenDisplayMode: TokenDisplayMode,
  options: {
    requiredEntityIds?: ReadonlySet<TokenEntityId>;
    stagedMetadata?: StagedTokenProjectionRestoreMetadata;
  } = {},
): TokenAssetsIndexResult | null => {
  const groupMembers = new Map(
    restored.groups.map(group => [group.id, group.memberIds]),
  );
  const rows: TokenAssetsIndexRow[] = [];
  const tokenIds: TokenEntityId[] = [];
  const groups: Array<{
    groupId: TokenGroupId;
    value: TokenGroupResourceValue;
  }> = [];

  for (const row of restored.rows) {
    if (row.type === 'token') {
      const tokenId = row.id as TokenEntityId;
      if (
        (!options.stagedMetadata || options.requiredEntityIds?.has(tokenId)) &&
        !tokenEntityResourceStore.getValue(tokenId)
      ) {
        return null;
      }
      rows.push({ type: 'token', tokenId });
      tokenIds.push(tokenId);
      continue;
    }

    if (row.type !== 'token-group') {
      return null;
    }
    const groupId = row.id as TokenGroupId;
    const memberTokenIds = (groupMembers.get(groupId) || []).map(
      memberId => memberId as TokenEntityId,
    );
    const memberTokens = memberTokenIds.map(tokenId =>
      tokenEntityResourceStore.getValue(tokenId),
    );
    if (!memberTokenIds.length) {
      return null;
    }
    const hasEveryMember = memberTokens.every(
      (token): token is ITokenItem => !!token,
    );
    const requiresEveryMember = memberTokenIds.some(tokenId =>
      options.requiredEntityIds?.has(tokenId),
    );
    if (!options.stagedMetadata || requiresEveryMember) {
      if (!hasEveryMember) {
        return null;
      }
    }
    const [summary] = hasEveryMember
      ? aggregateTokens(memberTokens, tokenDisplayMode)
      : [];
    const primaryTokenId = options.stagedMetadata
      ? options.stagedMetadata.groupPrimaryTokenIds[groupId]
      : summary
      ? buildTokenEntityId(summary)
      : undefined;
    if (!primaryTokenId) {
      return null;
    }
    if (hasEveryMember) {
      if (!summary || buildTokenEntityId(summary) !== primaryTokenId) {
        return null;
      }
      groups.push({
        groupId,
        value: {
          groupKey: summary.groupKey,
          primaryTokenId,
          memberTokenIds,
          summary: stripTokenRuntimeGroupFields(summary),
        },
      });
    }
    rows.push({ type: 'group', groupId });
    tokenIds.push(primaryTokenId);
  }

  tokenGroupResourceStore.upsertGroups(groups, 'hydrate');
  const defaultVisibleTokenCount =
    typeof restored.metadata.defaultVisibleTokenCount === 'number'
      ? restored.metadata.defaultVisibleTokenCount
      : -1;
  const additionalTokenCount =
    typeof restored.metadata.additionalTokenCount === 'number'
      ? restored.metadata.additionalTokenCount
      : -1;
  const lowValueTokenCount =
    typeof restored.metadata.lowValueTokenCount === 'number'
      ? restored.metadata.lowValueTokenCount
      : -1;
  const additionalCoreUsdValue =
    typeof restored.metadata.additionalCoreUsdValue === 'number'
      ? restored.metadata.additionalCoreUsdValue
      : Number.NaN;
  const hasAdditionalTokens = restored.metadata.hasAdditionalTokens;
  const hasLpTokens = restored.metadata.hasLpTokens;
  const selectedSegmentMode = restored.metadata.selectedSegmentMode;
  const parsedSegmentRowCounts = parseTokenProjectionSegmentRowCounts(
    restored.metadata,
  );
  const persistedRowCount = TOKEN_ASSETS_INDEX_SEGMENT_KEYS.reduce(
    (count, segmentKey) => count + (parsedSegmentRowCounts?.[segmentKey] || 0),
    0,
  );
  const selectedAdditionalTokenCount =
    selectedSegmentMode === 'lp'
      ? parsedSegmentRowCounts?.additionalLp
      : parsedSegmentRowCounts?.additionalDefault;
  const selectedLowValueTokenCount =
    selectedSegmentMode === 'lp'
      ? parsedSegmentRowCounts?.lowValueLp
      : parsedSegmentRowCounts?.lowValueDefault;
  const isStagedPrimaryOnly =
    !!options.stagedMetadata && rows.length === parsedSegmentRowCounts?.primary;
  if (
    !parsedSegmentRowCounts ||
    persistedRowCount !== (restored.totalRowCount ?? restored.rows.length) ||
    (!isStagedPrimaryOnly && persistedRowCount !== rows.length) ||
    (selectedSegmentMode !== 'default' && selectedSegmentMode !== 'lp') ||
    !Number.isInteger(defaultVisibleTokenCount) ||
    defaultVisibleTokenCount < 0 ||
    !Number.isInteger(additionalTokenCount) ||
    additionalTokenCount < 0 ||
    !Number.isInteger(lowValueTokenCount) ||
    lowValueTokenCount < 0 ||
    defaultVisibleTokenCount !== parsedSegmentRowCounts?.primary ||
    additionalTokenCount !== selectedAdditionalTokenCount ||
    lowValueTokenCount !== selectedLowValueTokenCount ||
    !Number.isFinite(additionalCoreUsdValue) ||
    typeof hasAdditionalTokens !== 'boolean' ||
    typeof hasLpTokens !== 'boolean'
  ) {
    return null;
  }
  let segmentStart = 0;
  const segments = TOKEN_ASSETS_INDEX_SEGMENT_KEYS.reduce(
    (result, segmentKey) => {
      const count = parsedSegmentRowCounts[segmentKey];
      const segmentEnd = segmentStart + count;
      const hasLoadedRows = !isStagedPrimaryOnly || segmentKey === 'primary';
      result[segmentKey] = hasLoadedRows
        ? {
            rows: rows.slice(segmentStart, segmentEnd),
            tokenIds: tokenIds.slice(segmentStart, segmentEnd),
          }
        : EMPTY_TOKEN_ASSETS_INDEX_SEGMENT;
      if (hasLoadedRows) {
        segmentStart = segmentEnd;
      }
      return result;
    },
    {} as TokenAssetsIndexSegments,
  );
  const selectedAdditionalSegment =
    selectedSegmentMode === 'lp'
      ? segments.additionalLp
      : segments.additionalDefault;
  const selectedLowValueSegment =
    selectedSegmentMode === 'lp'
      ? segments.lowValueLp
      : segments.lowValueDefault;
  const selectedRows = segments.primary.rows.concat(
    selectedAdditionalSegment.rows,
    selectedLowValueSegment.rows,
  );
  const selectedTokenIds = segments.primary.tokenIds.concat(
    selectedAdditionalSegment.tokenIds,
    selectedLowValueSegment.tokenIds,
  );
  const lowValueTokenPreviewLogoUrls = options.stagedMetadata
    ? options.stagedMetadata.lowValueTokenPreviewLogoUrls
    : segments.lowValueDefault.tokenIds
        .slice(0, 3)
        .map(
          tokenId => tokenEntityResourceStore.getValue(tokenId)?.logo_url || '',
        );
  const lpLowValueTokenPreviewLogoUrls = options.stagedMetadata
    ? options.stagedMetadata.lpLowValueTokenPreviewLogoUrls
    : segments.lowValueLp.tokenIds
        .slice(0, 3)
        .map(
          tokenId => tokenEntityResourceStore.getValue(tokenId)?.logo_url || '',
        );
  return {
    rows: selectedRows,
    tokenIds: selectedTokenIds,
    defaultVisibleTokenCount,
    additionalTokenCount,
    lowValueTokenCount,
    additionalCoreUsdValue,
    lowValueTokenPreviewLogoUrls,
    lpLowValueTokenPreviewLogoUrls,
    hasAdditionalTokens,
    hasLpTokens,
    segments,
  };
};

const tokenProjectionRestoreRequests = new Map<string, Promise<boolean>>();

const yieldTokenProjectionEntityRestore = () =>
  new Promise<void>(resolve => setTimeout(resolve, 0));

const restoreTokenAssetsProjectionIfEmpty = (
  key: string,
  scene: TokenProjectionScene,
): Promise<boolean> => {
  if (
    isAssetProjectionPersistenceActive({
      runtimeKey: key,
      kind: 'token',
      scene,
    })
  ) {
    return Promise.resolve(false);
  }
  const requestKey = `${scene}:${key}`;
  const activeRequest = tokenProjectionRestoreRequests.get(requestKey);
  if (activeRequest) {
    return activeRequest;
  }

  const startedState = useTokenAssetsIndexStore.getState();
  const startedResult =
    scene === 'single-address'
      ? startedState.singleAssetsResultByKey[key]
      : startedState.multiAssetsResultByKey[key];
  const startedConfig =
    scene === 'single-address'
      ? startedState.singleAssetsConfigByKey[key]
      : startedState.multiAssetsConfigByKey[key];
  if (!startedConfig) {
    return Promise.resolve(false);
  }
  if (startedResult?.rows.length) {
    return Promise.resolve(true);
  }
  const startedSourceMap = tokenListStore.getState().tokenListMap;
  const addresses =
    'address' in startedConfig
      ? [startedConfig.address]
      : startedConfig.addresses;
  if (
    addresses.every(address =>
      Object.prototype.hasOwnProperty.call(
        startedSourceMap,
        normalizeAddress(address),
      ),
    )
  ) {
    return Promise.resolve(true);
  }

  useTokenAssetsIndexStore.setState(draft => {
    if (scene === 'single-address') {
      draft.singleAssetsAvailabilityByKey[key] = 'restoring';
    } else {
      draft.multiAssetsAvailabilityByKey[key] = 'restoring';
    }
  });
  const trace = beginAssetDataLoadDiagnostic(
    'asset-projection-token-restore',
    scene,
    {
      addressCount: addresses.length,
      chainServerId: startedConfig.chainServerId || 'all',
      isLpTokenEnabled: !!startedConfig.isLpTokenEnabled,
      tokenDisplayMode:
        'tokenDisplayMode' in startedConfig
          ? startedConfig.tokenDisplayMode || 'byAddress'
          : 'byAddress',
      ...getMultiTokenAssetsSourceVersionDiagnostics(
        useTokenIndexStore.getState(),
        addresses,
      ),
    },
  );

  const request = (async () => {
    const restored = await restoreAssetProjection(
      {
        runtimeKey: key,
        kind: 'token',
        scene,
      },
      {
        ruleVersion: TOKEN_ASSET_PROJECTION_RULE_VERSION,
        selectRowRanges: snapshot => {
          if (
            snapshot.metadata.entityRestoreMode !==
            TOKEN_ASSET_PROJECTION_ENTITY_RESTORE_MODE
          ) {
            return undefined;
          }
          const segmentRowCounts = parseTokenProjectionSegmentRowCounts(
            snapshot.metadata,
          );
          if (!segmentRowCounts) {
            return null;
          }
          const segmentRanges =
            buildTokenProjectionSegmentRowRanges(segmentRowCounts);
          const persistedRowCount = TOKEN_ASSETS_INDEX_SEGMENT_KEYS.reduce(
            (count, segmentKey) => count + segmentRowCounts[segmentKey],
            0,
          );
          return persistedRowCount === snapshot.itemCount
            ? [segmentRanges.primary]
            : null;
        },
      },
    );
    if (!restored) {
      trace.finish({ reason: 'projection-missing' });
      return false;
    }
    trace.mark('projection-restored', {
      itemCount: restored.rows.length,
      totalItemCount: restored.totalRowCount,
    });

    const usesStagedEntityRestore =
      restored.metadata.entityRestoreMode ===
      TOKEN_ASSET_PROJECTION_ENTITY_RESTORE_MODE;
    const stagedMetadata = usesStagedEntityRestore
      ? parseStagedTokenProjectionRestoreMetadata(restored) || undefined
      : undefined;
    if (usesStagedEntityRestore && !stagedMetadata) {
      trace.finish({ reason: 'staged-metadata-invalid' });
      return false;
    }

    const beforeHydrate = useTokenAssetsIndexStore.getState();
    const beforeHydrateResult =
      scene === 'single-address'
        ? beforeHydrate.singleAssetsResultByKey[key]
        : beforeHydrate.multiAssetsResultByKey[key];
    const beforeHydrateConfig =
      scene === 'single-address'
        ? beforeHydrate.singleAssetsConfigByKey[key]
        : beforeHydrate.multiAssetsConfigByKey[key];
    if (
      beforeHydrateConfig !== startedConfig ||
      beforeHydrateResult !== startedResult ||
      tokenListStore.getState().tokenListMap !== startedSourceMap
    ) {
      trace.finish({ reason: 'state-changed-before-hydrate' });
      return false;
    }

    const allTokenIds = collectRestoredTokenEntityIds(restored);
    const requiredTokenIds = stagedMetadata
      ? collectRestoredTokenEntityIds(
          restored,
          restored.rows.slice(0, stagedMetadata.primaryRowCount),
        )
      : allTokenIds;
    const missingTokenIds = Array.from(requiredTokenIds).filter(
      tokenId => !tokenEntityResourceStore.getValue(tokenId),
    );
    trace.mark('entity-selection-ready', {
      itemCount: requiredTokenIds.size,
      deferredItemCount: allTokenIds.size - requiredTokenIds.size,
      path: stagedMetadata ? 'staged' : 'legacy-full',
    });
    if (missingTokenIds.length) {
      trace.mark('entity-query-started', { itemCount: missingTokenIds.length });
      const cachedTokens =
        await TokenItemEntity.batchMultiAddressTokensByResourceIds(
          missingTokenIds,
        );
      trace.mark('entity-query-finished', { itemCount: cachedTokens.length });
      const latestBeforeEntityPublish = useTokenAssetsIndexStore.getState();
      const latestBeforeEntityResult =
        scene === 'single-address'
          ? latestBeforeEntityPublish.singleAssetsResultByKey[key]
          : latestBeforeEntityPublish.multiAssetsResultByKey[key];
      const latestBeforeEntityConfig =
        scene === 'single-address'
          ? latestBeforeEntityPublish.singleAssetsConfigByKey[key]
          : latestBeforeEntityPublish.multiAssetsConfigByKey[key];
      if (
        latestBeforeEntityConfig !== startedConfig ||
        latestBeforeEntityResult !== startedResult ||
        tokenListStore.getState().tokenListMap !== startedSourceMap
      ) {
        trace.finish({ reason: 'state-changed-before-entity-publish' });
        return false;
      }
      const missingTokens = cachedTokens
        .map(token => tokenItemEntityToTokenItem(token))
        .filter(token => {
          const tokenId = buildTokenEntityId(token);
          return (
            requiredTokenIds.has(tokenId) &&
            !tokenEntityResourceStore.getValue(tokenId)
          );
        });
      tokenEntityResourceStore.upsertTokens(missingTokens, 'hydrate', {
        // These entities belong to the projection being restored. Treating
        // their hydration as a source revision would immediately invalidate
        // that projection and trigger the same SQLite restore again.
        skipDerivedUpdates: true,
      });
      trace.mark('entities-published', { itemCount: missingTokens.length });
    }

    const result = buildRestoredTokenAssetsIndexResult(
      restored,
      scene === 'multi-address'
        ? (startedConfig as MultiTokenAssetsIndexConfig).tokenDisplayMode ||
            'byAddress'
        : 'byAddress',
      {
        requiredEntityIds: requiredTokenIds,
        stagedMetadata,
      },
    );
    if (!result) {
      trace.finish({ reason: 'projection-invalid' });
      return false;
    }

    const latest = useTokenAssetsIndexStore.getState();
    const latestResult =
      scene === 'single-address'
        ? latest.singleAssetsResultByKey[key]
        : latest.multiAssetsResultByKey[key];
    const latestConfig =
      scene === 'single-address'
        ? latest.singleAssetsConfigByKey[key]
        : latest.multiAssetsConfigByKey[key];
    if (
      latestConfig !== startedConfig ||
      latestResult !== startedResult ||
      tokenListStore.getState().tokenListMap !== startedSourceMap
    ) {
      trace.finish({ reason: 'state-changed-before-projection-publish' });
      return false;
    }

    useTokenAssetsIndexStore.setState(draft => {
      if (scene === 'single-address') {
        draft.singleAssetsResultByKey[key] = result;
        draft.singleAssetsAvailabilityByKey[key] = 'ready';
      } else {
        draft.multiAssetsResultByKey[key] = result;
        draft.multiAssetsAvailabilityByKey[key] = 'ready';
      }
    });
    trace.finish({
      itemCount: result.rows.length,
      restoredEntityCount: requiredTokenIds.size,
      path: stagedMetadata ? 'staged' : 'legacy-full',
    });

    if (stagedMetadata) {
      stagedTokenProjectionHydrationContexts.set(
        result,
        createStagedTokenProjectionHydrationContext(
          restored,
          stagedMetadata,
          scene === 'multi-address'
            ? (startedConfig as MultiTokenAssetsIndexConfig).tokenDisplayMode ||
                'byAddress'
            : 'byAddress',
        ),
      );
    }
    return true;
  })()
    .catch(error => {
      trace.fail({ reason: 'restore-error' });
      console.error('[tokenProjection] restore failed', error);
      return false;
    })
    .finally(() => {
      tokenProjectionRestoreRequests.delete(requestKey);
      const state = useTokenAssetsIndexStore.getState();
      const availability =
        scene === 'single-address'
          ? state.singleAssetsAvailabilityByKey[key]
          : state.multiAssetsAvailabilityByKey[key];
      if (availability !== 'restoring') {
        return;
      }
      const config =
        scene === 'single-address'
          ? state.singleAssetsConfigByKey[key]
          : state.multiAssetsConfigByKey[key];
      const result =
        scene === 'single-address'
          ? state.singleAssetsResultByKey[key]
          : state.multiAssetsResultByKey[key];
      const nextAvailability = getTokenAssetsProjectionAvailability(
        config,
        result,
      );
      useTokenAssetsIndexStore.setState(draft => {
        if (scene === 'single-address') {
          draft.singleAssetsAvailabilityByKey[key] = nextAvailability;
        } else {
          draft.multiAssetsAvailabilityByKey[key] = nextAvailability;
        }
      });
    });

  tokenProjectionRestoreRequests.set(requestKey, request);
  return request;
};

const restoreMultiAssetsProjectionForAddresses = (
  key: string | undefined,
  addresses: string[],
) => {
  if (!key) {
    return Promise.resolve(false);
  }
  const config =
    useTokenAssetsIndexStore.getState().multiAssetsConfigByKey[key];
  if (
    !config ||
    getAddressesKey(config.addresses) !== getAddressesKey(addresses)
  ) {
    return Promise.resolve(false);
  }

  return restoreTokenAssetsProjectionIfEmpty(key, 'multi-address');
};

subscribeAssetProjectionDatabaseCommits(() => {
  const state = useTokenAssetsIndexStore.getState();
  Object.keys(state.singleAssetsConfigByKey).forEach(key => {
    restoreTokenAssetsProjectionIfEmpty(key, 'single-address');
  });
  Object.keys(state.multiAssetsConfigByKey).forEach(key => {
    restoreTokenAssetsProjectionIfEmpty(key, 'multi-address');
  });
});

const hasTokenAssetsConfigToken = (
  tokenIds: TokenEntityId[],
  changedTokenIdSet: ReadonlySet<TokenEntityId>,
) => tokenIds.some(tokenId => changedTokenIdSet.has(tokenId));

const isSingleTokenAssetsIndexConfigSame = (
  previousConfig: SingleTokenAssetsIndexConfig | undefined,
  nextConfig: SingleTokenAssetsIndexConfig,
) =>
  previousConfig?.address === nextConfig.address &&
  previousConfig.tokenIds === nextConfig.tokenIds &&
  previousConfig.chainServerId === nextConfig.chainServerId &&
  previousConfig.isLpTokenEnabled === nextConfig.isLpTokenEnabled;

const areTokenEntityIdListsSame = (
  previousTokenIds: TokenEntityId[],
  nextTokenIds: TokenEntityId[],
) =>
  previousTokenIds === nextTokenIds ||
  (previousTokenIds.length === nextTokenIds.length &&
    previousTokenIds.every(
      (tokenId, index) => tokenId === nextTokenIds[index],
    ));

const areOrderedAddressListsSame = (
  previousAddresses: string[],
  nextAddresses: string[],
) =>
  previousAddresses === nextAddresses ||
  (previousAddresses.length === nextAddresses.length &&
    previousAddresses.every(
      (address, index) =>
        normalizeAddress(address) === normalizeAddress(nextAddresses[index]!),
    ));

const isMultiTokenAssetsIndexSourceSame = (
  previousConfig: MultiTokenAssetsIndexConfig | undefined,
  nextConfig: Omit<MultiTokenAssetsIndexConfig, 'tokenIds'>,
) =>
  previousConfig?.key === nextConfig.key &&
  areOrderedAddressListsSame(previousConfig.addresses, nextConfig.addresses) &&
  previousConfig.sourceVersionKey === nextConfig.sourceVersionKey &&
  previousConfig.chainServerId === nextConfig.chainServerId &&
  previousConfig.isLpTokenEnabled === nextConfig.isLpTokenEnabled &&
  previousConfig.tokenDisplayMode === nextConfig.tokenDisplayMode;

const isMultiTokenAssetsIndexConfigSame = (
  previousConfig: MultiTokenAssetsIndexConfig | undefined,
  nextConfig: MultiTokenAssetsIndexConfig,
) => {
  if (!previousConfig) {
    return false;
  }

  return (
    isMultiTokenAssetsIndexSourceSame(previousConfig, nextConfig) &&
    areTokenEntityIdListsSame(previousConfig.tokenIds, nextConfig.tokenIds)
  );
};

export const useTokenAssetsIndexStore = zCreate(
  zMutative<TokenAssetsIndexStoreState>((set, get) => ({
    singleAssetsResultByKey: {},
    multiAssetsResultByKey: {},
    singleAssetsAvailabilityByKey: {},
    multiAssetsAvailabilityByKey: {},
    singleAssetsConfigByKey: {},
    multiAssetsConfigByKey: {},
    syncSingleAssetsResult({
      key,
      address,
      tokenIds,
      chainServerId,
      isLpTokenEnabled,
    }) {
      const normalizedChainServerId =
        normalizeTokenProjectionChainServerId(chainServerId);
      const normalizedIsLpTokenEnabled =
        normalizeTokenProjectionLpMode(isLpTokenEnabled);
      const nextConfig = {
        key,
        address: normalizeAddress(address),
        tokenIds,
        chainServerId: normalizedChainServerId,
        isLpTokenEnabled: normalizedIsLpTokenEnabled,
      };
      const previousConfig = get().singleAssetsConfigByKey[key];
      const previousResult = get().singleAssetsResultByKey[key];
      const nextResult = buildSingleAssetsIndexFromTokenIds(
        tokenIds,
        normalizedChainServerId,
        normalizedIsLpTokenEnabled,
        previousResult,
      );
      const isConfigSame = isSingleTokenAssetsIndexConfigSame(
        previousConfig,
        nextConfig,
      );

      if (isConfigSame && previousResult === nextResult) {
        const availability = getTokenAssetsProjectionAvailability(
          nextConfig,
          nextResult,
        );
        if (get().singleAssetsAvailabilityByKey[key] !== availability) {
          set(draft => {
            draft.singleAssetsAvailabilityByKey[key] = availability;
          });
        }
        scheduleTokenAssetsProjectionPersistence(
          key,
          'single-address',
          nextResult,
        );
        if (!nextResult.rows.length) {
          restoreTokenAssetsProjectionIfEmpty(key, 'single-address');
        }
        return;
      }

      set(draft => {
        if (!isConfigSame) {
          draft.singleAssetsConfigByKey[key] = nextConfig;
        }
        draft.singleAssetsResultByKey[key] = nextResult;
        draft.singleAssetsAvailabilityByKey[key] =
          getTokenAssetsProjectionAvailability(nextConfig, nextResult);
      });
      scheduleTokenAssetsProjectionPersistence(
        key,
        'single-address',
        nextResult,
      );
      if (!nextResult.rows.length) {
        restoreTokenAssetsProjectionIfEmpty(key, 'single-address');
      }
    },
    ensureSingleAssetsResult({ address, chainServerId, isLpTokenEnabled }) {
      const normalizedAddress = normalizeAddress(address);
      const normalizedChainServerId =
        normalizeTokenProjectionChainServerId(chainServerId);
      const normalizedIsLpTokenEnabled =
        normalizeTokenProjectionLpMode(isLpTokenEnabled);
      const key = getSingleAssetsCacheKey(
        normalizedAddress,
        normalizedChainServerId,
        normalizedIsLpTokenEnabled,
      );
      const tokenIds =
        useTokenIndexStore.getState().addressTokenIds[normalizedAddress] ||
        EMPTY_TOKEN_ENTITY_IDS;
      const nextConfig = {
        key,
        address: normalizedAddress,
        tokenIds,
        chainServerId: normalizedChainServerId,
        isLpTokenEnabled: normalizedIsLpTokenEnabled,
      };
      const state = get();

      if (
        state.singleAssetsResultByKey[key] &&
        isSingleTokenAssetsIndexConfigSame(
          state.singleAssetsConfigByKey[key],
          nextConfig,
        )
      ) {
        const availability = getTokenAssetsProjectionAvailability(
          nextConfig,
          state.singleAssetsResultByKey[key],
        );
        if (state.singleAssetsAvailabilityByKey[key] !== availability) {
          set(draft => {
            draft.singleAssetsAvailabilityByKey[key] = availability;
          });
        }
        return key;
      }

      get().syncSingleAssetsResult(nextConfig);

      return key;
    },
    ensureMultiAssetsResult({
      addresses,
      chainServerId,
      isLpTokenEnabled,
      tokenDisplayMode,
    }) {
      const normalizedAddresses = normalizeAddresses(addresses);
      const normalizedChainServerId =
        normalizeTokenProjectionChainServerId(chainServerId);
      const normalizedIsLpTokenEnabled =
        normalizeTokenProjectionLpMode(isLpTokenEnabled);
      const normalizedTokenDisplayMode =
        normalizeTokenDisplayMode(tokenDisplayMode);
      const key = getMultiAssetsCacheKey(
        normalizedAddresses,
        normalizedChainServerId,
        normalizedIsLpTokenEnabled,
        normalizedTokenDisplayMode,
      );
      const tokenIndexState = useTokenIndexStore.getState();
      const sourceVersionKey = getMultiTokenAssetsSourceVersionKey(
        tokenIndexState,
        normalizedAddresses,
      );
      const sourceConfig = {
        key,
        addresses: normalizedAddresses,
        sourceVersionKey,
        chainServerId: normalizedChainServerId,
        isLpTokenEnabled: normalizedIsLpTokenEnabled,
        tokenDisplayMode: normalizedTokenDisplayMode,
      };
      const state = get();

      // Registered projections are refreshed synchronously on entity changes;
      // this source key covers membership changes and makes mode reuse O(addresses).
      if (
        state.multiAssetsResultByKey[key] &&
        isMultiTokenAssetsIndexSourceSame(
          state.multiAssetsConfigByKey[key],
          sourceConfig,
        )
      ) {
        const availability = getTokenAssetsProjectionAvailability(
          state.multiAssetsConfigByKey[key],
          state.multiAssetsResultByKey[key],
        );
        if (state.multiAssetsAvailabilityByKey[key] !== availability) {
          set(draft => {
            draft.multiAssetsAvailabilityByKey[key] = availability;
          });
        }
        return key;
      }

      const seen = new Set<TokenEntityId>();
      const tokenIds = normalizedAddresses.flatMap(address =>
        (
          tokenIndexState.addressTokenIds[address] || EMPTY_TOKEN_ENTITY_IDS
        ).filter(tokenId => {
          if (seen.has(tokenId)) {
            return false;
          }
          seen.add(tokenId);
          return true;
        }),
      );
      const nextConfig = {
        ...sourceConfig,
        tokenIds,
      };

      get().syncMultiAssetsResult(nextConfig);

      return key;
    },
    syncSingleAssetsResultsForAddresses(addresses) {
      const normalizedAddresses = normalizeAddressSet(addresses);
      if (!normalizedAddresses.size) {
        return;
      }

      const state = get();
      const tokenIndexState = useTokenIndexStore.getState();
      const configUpdates: Record<string, SingleTokenAssetsIndexConfig> = {};
      const resultUpdates: Record<string, TokenAssetsIndexResult> = {};
      const availabilityUpdates: Record<string, AssetProjectionAvailability> =
        {};
      const projectionResults: Record<string, TokenAssetsIndexResult> = {};

      Object.values(state.singleAssetsConfigByKey).forEach(config => {
        if (!normalizedAddresses.has(config.address)) {
          return;
        }

        const tokenIds =
          tokenIndexState.addressTokenIds[config.address] ||
          EMPTY_TOKEN_ENTITY_IDS;
        const nextConfig = {
          ...config,
          tokenIds,
        };
        const previousResult = state.singleAssetsResultByKey[config.key];
        const nextResult = buildSingleAssetsIndexFromTokenIds(
          tokenIds,
          config.chainServerId,
          config.isLpTokenEnabled,
          previousResult,
        );

        if (!isSingleTokenAssetsIndexConfigSame(config, nextConfig)) {
          configUpdates[config.key] = nextConfig;
        }
        if (previousResult !== nextResult) {
          resultUpdates[config.key] = nextResult;
        }
        const availability = getTokenAssetsProjectionAvailability(
          nextConfig,
          nextResult,
        );
        if (state.singleAssetsAvailabilityByKey[config.key] !== availability) {
          availabilityUpdates[config.key] = availability;
        }
        projectionResults[config.key] = nextResult;
      });

      if (
        Object.keys(configUpdates).length ||
        Object.keys(resultUpdates).length ||
        Object.keys(availabilityUpdates).length
      ) {
        set(draft => {
          Object.entries(configUpdates).forEach(([key, config]) => {
            draft.singleAssetsConfigByKey[key] = config;
          });
          Object.entries(resultUpdates).forEach(([key, result]) => {
            draft.singleAssetsResultByKey[key] = result;
          });
          Object.entries(availabilityUpdates).forEach(([key, availability]) => {
            draft.singleAssetsAvailabilityByKey[key] = availability;
          });
        });
      }
      Object.entries(projectionResults).forEach(([key, result]) => {
        scheduleTokenAssetsProjectionPersistence(key, 'single-address', result);
        if (!result.rows.length) {
          restoreTokenAssetsProjectionIfEmpty(key, 'single-address');
        }
      });
    },
    syncMultiAssetsResultsForAddresses(addresses) {
      const normalizedAddresses = normalizeAddressSet(addresses);
      if (!normalizedAddresses.size) {
        return;
      }

      const state = get();
      const tokenIndexState = useTokenIndexStore.getState();
      Object.values(state.multiAssetsConfigByKey).forEach(config => {
        if (
          !config.addresses.some(address =>
            normalizedAddresses.has(normalizeAddress(address)),
          )
        ) {
          return;
        }
        const seen = new Set<TokenEntityId>();
        const tokenIds = config.addresses.flatMap(address =>
          (
            tokenIndexState.addressTokenIds[normalizeAddress(address)] || []
          ).filter(tokenId => {
            if (seen.has(tokenId)) {
              return false;
            }
            seen.add(tokenId);
            return true;
          }),
        );
        get().syncMultiAssetsResult({
          ...config,
          tokenIds,
        });
      });
    },
    syncMultiAssetsResult({
      key,
      addresses,
      tokenIds,
      chainServerId,
      isLpTokenEnabled,
      tokenDisplayMode,
    }) {
      const normalizedAddresses = normalizeAddresses(addresses);
      const normalizedChainServerId =
        normalizeTokenProjectionChainServerId(chainServerId);
      const normalizedIsLpTokenEnabled =
        normalizeTokenProjectionLpMode(isLpTokenEnabled);
      const normalizedTokenDisplayMode =
        normalizeTokenDisplayMode(tokenDisplayMode);
      const nextConfig = {
        key,
        addresses: normalizedAddresses,
        tokenIds,
        sourceVersionKey: getMultiTokenAssetsSourceVersionKey(
          useTokenIndexStore.getState(),
          normalizedAddresses,
        ),
        chainServerId: normalizedChainServerId,
        isLpTokenEnabled: normalizedIsLpTokenEnabled,
        tokenDisplayMode: normalizedTokenDisplayMode,
      };
      const previousConfig = get().multiAssetsConfigByKey[key];
      const previousResult = get().multiAssetsResultByKey[key];
      const isConfigSame = isMultiTokenAssetsIndexConfigSame(
        previousConfig,
        nextConfig,
      );

      const invalidationTrace =
        previousResult?.rows.length && !isConfigSame
          ? beginAssetDataLoadDiagnostic(
              'multi-address-token-projection',
              normalizedAddresses.join('|'),
              {
                reason: 'source-invalidated',
                previousRowCount: previousResult.rows.length,
                previousTokenIdCount: previousConfig?.tokenIds.length || 0,
                nextTokenIdCount: tokenIds.length,
                sourceVersionChanged:
                  previousConfig?.sourceVersionKey !==
                  nextConfig.sourceVersionKey,
                tokenIdsChanged: !areTokenEntityIdListsSame(
                  previousConfig?.tokenIds || EMPTY_TOKEN_ENTITY_IDS,
                  tokenIds,
                ),
                ...getMultiTokenAssetsSourceVersionDiagnostics(
                  useTokenIndexStore.getState(),
                  normalizedAddresses,
                ),
              },
            )
          : undefined;

      if (isConfigSame && previousResult) {
        const availability = getTokenAssetsProjectionAvailability(
          nextConfig,
          previousResult,
        );
        if (get().multiAssetsAvailabilityByKey[key] !== availability) {
          set(draft => {
            draft.multiAssetsAvailabilityByKey[key] = availability;
          });
        }
        return;
      }

      const nextResult = buildMultiAssetsIndexFromTokenIds(
        tokenIds,
        normalizedChainServerId,
        normalizedIsLpTokenEnabled,
        normalizedTokenDisplayMode,
        key,
        previousResult,
      );
      invalidationTrace?.finish({ nextRowCount: nextResult.rows.length });

      set(draft => {
        if (!isConfigSame) {
          draft.multiAssetsConfigByKey[key] = nextConfig;
        }
        draft.multiAssetsResultByKey[key] = nextResult;
        draft.multiAssetsAvailabilityByKey[key] =
          getTokenAssetsProjectionAvailability(nextConfig, nextResult);
      });
      scheduleTokenAssetsProjectionPersistence(
        key,
        'multi-address',
        nextResult,
        normalizedTokenDisplayMode,
      );
      if (!nextResult.rows.length) {
        restoreTokenAssetsProjectionIfEmpty(key, 'multi-address');
      }
    },
    syncChangedTokenAssetsResults(tokenIds) {
      if (!tokenIds.length) {
        return;
      }

      const changedTokenIdSet = new Set(tokenIds);
      const state = get();
      const singleResultUpdates: Record<string, TokenAssetsIndexResult> = {};
      const multiResultUpdates: Record<string, TokenAssetsIndexResult> = {};
      const multiConfigUpdates: Record<string, MultiTokenAssetsIndexConfig> =
        {};
      const tokenIndexState = useTokenIndexStore.getState();

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
        const sourceVersionKey = getMultiTokenAssetsSourceVersionKey(
          tokenIndexState,
          config.addresses,
        );
        if (config.sourceVersionKey !== sourceVersionKey) {
          multiConfigUpdates[config.key] = {
            ...config,
            sourceVersionKey,
          };
        }
      });

      if (
        !Object.keys(singleResultUpdates).length &&
        !Object.keys(multiResultUpdates).length &&
        !Object.keys(multiConfigUpdates).length
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
        Object.entries(multiConfigUpdates).forEach(([key, config]) => {
          draft.multiAssetsConfigByKey[key] = config;
        });
      });
      Object.entries(singleResultUpdates).forEach(([key, result]) => {
        scheduleTokenAssetsProjectionPersistence(key, 'single-address', result);
      });
      Object.entries(multiResultUpdates).forEach(([key, result]) => {
        const config = state.multiAssetsConfigByKey[key];
        scheduleTokenAssetsProjectionPersistence(
          key,
          'multi-address',
          result,
          config?.tokenDisplayMode,
        );
      });
    },
  })),
);

export const prepareSingleAddressTokenAssetsProjection = (
  input: SingleTokenAssetsProjectionInput,
) => useTokenAssetsIndexStore.getState().ensureSingleAssetsResult(input);

export const prepareMultiAddressTokenAssetsProjection = (
  input: MultiTokenAssetsProjectionInput,
) => useTokenAssetsIndexStore.getState().ensureMultiAssetsResult(input);

export const ensureTokenAssetsProjectionSegmentsHydrated = ({
  projectionKey,
  scene,
  segmentKeys,
}: {
  projectionKey: string;
  scene: TokenProjectionScene;
  segmentKeys: TokenAssetsIndexSegmentKey[];
}): Promise<boolean> => {
  const state = useTokenAssetsIndexStore.getState();
  const result =
    scene === 'single-address'
      ? state.singleAssetsResultByKey[projectionKey]
      : state.multiAssetsResultByKey[projectionKey];
  if (!result) {
    return Promise.resolve(false);
  }
  const context = stagedTokenProjectionHydrationContexts.get(result);
  if (!context) {
    return Promise.resolve(true);
  }

  const requestedSegmentKeySet = new Set(segmentKeys);
  const uniqueSegmentKeys = TOKEN_ASSETS_INDEX_SEGMENT_KEYS.filter(segmentKey =>
    requestedSegmentKeySet.has(segmentKey),
  );
  const requestKey = `${scene}:${projectionKey}`;
  const previousRequest =
    tokenProjectionSegmentHydrationRequests.get(requestKey);
  let request!: Promise<boolean>;
  request = (async () => {
    if (previousRequest?.result === result) {
      await previousRequest.promise.catch(() => false);
    }

    const getCurrentResult = () => {
      const currentState = useTokenAssetsIndexStore.getState();
      return scene === 'single-address'
        ? currentState.singleAssetsResultByKey[projectionKey]
        : currentState.multiAssetsResultByKey[projectionKey];
    };
    const isCurrent = () => getCurrentResult() === result;
    if (!isCurrent()) {
      return false;
    }

    const trace = beginAssetDataLoadDiagnostic(
      'asset-projection-token-segment-hydrate',
      requestKey,
      {
        segmentKeys: uniqueSegmentKeys.join(','),
      },
    );
    const unloadedSegmentKeys = uniqueSegmentKeys.filter(
      segmentKey => !context.loadedSegmentKeys.has(segmentKey),
    );
    let workingSegments = result.segments;
    if (unloadedSegmentKeys.length) {
      const ranges = unloadedSegmentKeys
        .map(segmentKey => context.segmentRanges[segmentKey])
        .filter(range => range.count > 0);
      const restoredRows = ranges.length
        ? await restoreAssetProjectionRows(
            context.projectionKey,
            context.generation,
            ranges,
          )
        : {
            projectionKey: context.projectionKey,
            generation: context.generation,
            rows: [],
            groups: [],
            loadedRowRanges: [],
          };
      if (!restoredRows || !isCurrent()) {
        trace.finish({ reason: 'projection-generation-unavailable' });
        return false;
      }

      const restoredSegments: Partial<TokenAssetsIndexSegments> = {};
      let restoredRowOffset = 0;
      for (const segmentKey of unloadedSegmentKeys) {
        const expectedRowCount = context.segmentRanges[segmentKey].count;
        const segmentRows = restoredRows.rows.slice(
          restoredRowOffset,
          restoredRowOffset + expectedRowCount,
        );
        restoredRowOffset += expectedRowCount;
        const groupIdSet = new Set(
          segmentRows
            .filter(row => row.type === 'token-group')
            .map(row => row.id),
        );
        const segment = buildStagedTokenProjectionSegment(
          {
            ...restoredRows,
            rows: segmentRows,
            groups: restoredRows.groups.filter(group =>
              groupIdSet.has(group.id),
            ),
          },
          context,
        );
        if (!segment || segment.rows.length !== expectedRowCount) {
          trace.finish({ reason: 'projection-segment-invalid' });
          return false;
        }
        restoredSegments[segmentKey] = segment;
      }
      if (restoredRowOffset !== restoredRows.rows.length) {
        trace.finish({ reason: 'projection-segment-count-mismatch' });
        return false;
      }
      workingSegments = {
        ...result.segments,
        ...restoredSegments,
      };
      trace.mark('projection-segments-restored', {
        itemCount: restoredRows.rows.length,
      });
    }

    const segments = uniqueSegmentKeys.map(
      segmentKey => workingSegments[segmentKey],
    );
    const requiredTokenIds = new Set<TokenEntityId>();
    segments.forEach(segment => {
      collectTokenProjectionSegmentEntityIds(segment, context).forEach(
        tokenId => requiredTokenIds.add(tokenId),
      );
    });
    const missingTokenIds = Array.from(requiredTokenIds).filter(
      tokenId => !tokenEntityResourceStore.getValue(tokenId),
    );
    trace.mark('entity-selection-ready', {
      itemCount: missingTokenIds.length,
    });
    let restoredCount = 0;

    for (let start = 0; start < missingTokenIds.length; ) {
      if (!isCurrent()) {
        trace.finish({
          reason: 'state-changed',
          restoredEntityCount: restoredCount,
        });
        return false;
      }
      const batchSize =
        start === 0
          ? TOKEN_ASSET_PROJECTION_INITIAL_SEGMENT_RESTORE_BATCH_SIZE
          : TOKEN_ASSET_PROJECTION_ENTITY_RESTORE_BATCH_SIZE;
      const batchIds = missingTokenIds.slice(start, start + batchSize);
      start += batchIds.length;
      const cachedTokens =
        await TokenItemEntity.batchMultiAddressTokensByResourceIds(batchIds);
      if (!isCurrent()) {
        trace.finish({
          reason: 'state-changed-after-query',
          restoredEntityCount: restoredCount,
        });
        return false;
      }
      const batchIdSet = new Set(batchIds);
      const mappedTokens = await mapWithJsBudget(
        cachedTokens,
        token => tokenItemEntityToTokenItem(token),
        { shouldContinue: isCurrent },
      );
      if (!mappedTokens || !isCurrent()) {
        trace.finish({
          reason: 'state-changed-during-conversion',
          restoredEntityCount: restoredCount,
        });
        return false;
      }
      const tokens = mappedTokens.filter(token =>
        batchIdSet.has(buildTokenEntityId(token)),
      );
      tokenEntityResourceStore.upsertTokens(tokens, 'hydrate', {
        // Persisted projection membership is already authoritative. Updating
        // exact row resources must not rebuild every registered projection.
        skipDerivedUpdates: true,
      });
      restoredCount += tokens.length;
      trace.mark('entity-batch-published', {
        batchItemCount: tokens.length,
        restoredEntityCount: restoredCount,
      });
      await yieldTokenProjectionEntityRestore();
    }

    if (!isCurrent()) {
      trace.finish({
        reason: 'state-changed-before-group-publish',
        restoredEntityCount: restoredCount,
      });
      return false;
    }
    const groupsReady = publishHydratedTokenProjectionGroups(segments, context);
    if (!groupsReady) {
      trace.finish({
        reason: 'projection-groups-invalid',
        restoredEntityCount: restoredCount,
      });
      return false;
    }
    let publishedResult = result;
    if (unloadedSegmentKeys.length) {
      unloadedSegmentKeys.forEach(segmentKey =>
        context.loadedSegmentKeys.add(segmentKey),
      );
      publishedResult = buildTokenProjectionResultWithSegments(
        result,
        workingSegments,
        context.selectedSegmentMode,
      );
      stagedTokenProjectionHydrationContexts.set(publishedResult, context);
      useTokenAssetsIndexStore.setState(draft => {
        if (scene === 'single-address') {
          draft.singleAssetsResultByKey[projectionKey] = publishedResult;
        } else {
          draft.multiAssetsResultByKey[projectionKey] = publishedResult;
        }
      });
    }
    trace.finish({
      restoredEntityCount: restoredCount,
      groupsReady,
    });
    return groupsReady;
  })()
    .catch(error => {
      console.error('[tokenProjection] segment hydrate failed', error);
      return false;
    })
    .finally(() => {
      if (
        tokenProjectionSegmentHydrationRequests.get(requestKey)?.promise ===
        request
      ) {
        tokenProjectionSegmentHydrationRequests.delete(requestKey);
      }
    });

  tokenProjectionSegmentHydrationRequests.set(requestKey, {
    result,
    promise: request,
  });
  return request;
};

const getChangedTokenIndexAddresses = (
  previousVersions: TokenIndexState['addressVersions'],
  nextVersions: TokenIndexState['addressVersions'],
) => {
  const changedAddresses = new Set([
    ...Object.keys(previousVersions),
    ...Object.keys(nextVersions),
  ]);

  return Array.from(changedAddresses).filter(
    address => previousVersions[address] !== nextVersions[address],
  );
};

let lastTokenIndexAddressVersions =
  useTokenIndexStore.getState().addressVersions;
useTokenIndexStore.subscribe(state => {
  if (state.addressVersions === lastTokenIndexAddressVersions) {
    return;
  }

  const previousVersions = lastTokenIndexAddressVersions;
  lastTokenIndexAddressVersions = state.addressVersions;
  const changedAddresses = getChangedTokenIndexAddresses(
    previousVersions,
    state.addressVersions,
  );

  useTokenAssetsIndexStore
    .getState()
    .syncSingleAssetsResultsForAddresses(changedAddresses);
  useTokenAssetsIndexStore
    .getState()
    .syncMultiAssetsResultsForAddresses(changedAddresses);
});

let lastTokenListMapSyncedToRuntime: TokenListState['tokenListMap'] | undefined;

const syncTokenRuntimeStoresFromTokenListMap = (
  tokenListMap: TokenListState['tokenListMap'],
  addresses: string[],
  source: ObservableResourceValueSource = 'remote',
  options?: {
    markTokenListMapSynced?: boolean;
    markPersistencePending?: boolean;
  },
) => {
  const normalizedAddresses = Array.from(normalizeAddressSet(addresses));
  const persistenceTicket = options?.markPersistencePending
    ? tokenProjectionPersistenceGate.markDirty(normalizedAddresses)
    : undefined;
  const trace = beginAssetDataLoadDiagnostic(
    'token-runtime-sync',
    normalizedAddresses.join('|'),
    {
      addressCount: normalizedAddresses.length,
      source,
    },
  );

  if (!normalizedAddresses.length) {
    if (options?.markTokenListMapSynced) {
      lastTokenListMapSyncedToRuntime = tokenListMap;
    }
    trace.finish({ path: 'empty-addresses' });
    return persistenceTicket;
  }

  tokenEntityResourceStore.syncAddressesFromTokenListMap(
    tokenListMap,
    normalizedAddresses,
    source,
  );
  trace.mark('entity-resources-synced', {
    tokenCount: normalizedAddresses.reduce(
      (count, address) => count + (tokenListMap[address]?.length || 0),
      0,
    ),
  });
  useTokenIndexStore
    .getState()
    .syncFromTokenListMap(tokenListMap, normalizedAddresses);
  trace.mark('index-and-projections-synced');

  if (options?.markTokenListMapSynced) {
    lastTokenListMapSyncedToRuntime = tokenListMap;
  }
  trace.finish();
  return persistenceTicket;
};

const settleTokenProjectionPersistence = (
  ticket: AddressPersistenceTicket | undefined,
  persistence: Promise<boolean>,
  addresses?: string[],
) => {
  void persistence
    .then(success => {
      tokenProjectionPersistenceGate.settle(ticket, {
        addresses,
        success,
      });
    })
    .catch(error => {
      tokenProjectionPersistenceGate.settle(ticket, {
        addresses,
        success: false,
      });
      console.error('Token entity persistence failed:', error);
    });
};

const tokenCacheHydrator = createAddressListSnapshotHydrator<ITokenItem>({
  load: async addresses => {
    const tokens = await TokenItemEntity.batchMultiAddressTokens(addresses);
    return buildTokenListMapFromEntities(
      addresses,
      tokens as TokenItemEntity[],
    );
  },
  apply: (snapshots, addresses) => {
    const nextTokenListMap = mergeAddressListSnapshots(
      tokenListStore.getState().tokenListMap,
      addresses,
      snapshots,
    );
    syncTokenRuntimeStoresFromTokenListMap(
      nextTokenListMap,
      addresses,
      'hydrate',
      {
        markTokenListMapSynced: true,
      },
    );
    tokenListStore.setState({ tokenListMap: nextTokenListMap });
  },
});

type TokenCacheHydrationReason =
  | 'store-init'
  | 'multi-address-fresh-local'
  | 'multi-address-stale-local'
  | 'multi-address-partial-chain-fallback'
  | 'single-address-fresh-local'
  | 'single-address-stale-local';

const hydrateTokenCache = async (
  addresses: string[],
  reason: TokenCacheHydrationReason,
) => {
  const trace = beginAssetDataLoadDiagnostic('token-cache-hydrate', reason, {
    addressCount: addresses.length,
  });
  try {
    await tokenCacheHydrator.hydrate(addresses);
    trace.finish();
  } catch (error) {
    trace.fail();
    throw error;
  }
};

const tokenListStore = zCreate<TokenListState>((set, get) => ({
  tokenListMap: {},
  sourceSnapshotReadyByAddress: {},
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
    const projectionKey = prepareMultiAddressTokenAssetsProjection({
      addresses: lowerAddresses,
      tokenDisplayMode: get().tokenDisplayMode,
    });
    const projectionRestored = await restoreMultiAssetsProjectionForAddresses(
      projectionKey,
      lowerAddresses,
    );
    if (projectionRestored) {
      const projection =
        useTokenAssetsIndexStore.getState().multiAssetsResultByKey[
          projectionKey
        ];
      markStartupPerf('tokenListStore', 'load_cache_end', {
        elapsedMs: Date.now() - loadStartedAt,
        count: lowerAddresses.length,
        loadedAddressCount: 0,
        tokenCount: projection?.tokenIds.length || 0,
        path: 'projection',
      });
      markStartupPerf('tokenListStore', 'initStore_end', {
        elapsedMs: Date.now() - startedAt,
        count: lowerAddresses.length,
      });
      return;
    }
    const missingAddresses = getAddressesWithoutListSnapshot(
      lowerAddresses,
      get().tokenListMap,
    );
    await hydrateTokenCache(missingAddresses, 'store-init');
    const tokenMap = get().tokenListMap;
    markStartupPerf('tokenListStore', 'load_cache_end', {
      elapsedMs: Date.now() - loadStartedAt,
      count: lowerAddresses.length,
      loadedAddressCount: missingAddresses.length,
      tokenCount: Object.values(tokenMap).reduce(
        (acc, tokens) => acc + tokens.length,
        0,
      ),
    });

    markStartupPerf('tokenListStore', 'initStore_end', {
      elapsedMs: Date.now() - startedAt,
      count: lowerAddresses.length,
    });
  },

  async batchGetTokenList(addresses: string[], force = false, options = {}) {
    const lowerAddresses = Array.from(
      new Set(addresses.map(item => item.toLowerCase())),
    );
    const preferredProjectionKey = options.preferredMultiAssetsProjectionKey;
    return multiAddressTokenBatchRefreshes.run(
      lowerAddresses,
      force,
      async ticket => {
        const requestId = multiAddressTokenRequests.next();
        const addressRequest = tokenAddressRequests.reserve(lowerAddresses);
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
        const getCurrentAddresses = () =>
          isCurrentRequest()
            ? tokenAddressRequests.getCurrentAddresses(addressRequest)
            : [];
        const isForceRequested = () => force || ticket.isForceRequested();
        const projectionRestorePromise =
          preferredProjectionKey && !force
            ? restoreMultiAssetsProjectionForAddresses(
                preferredProjectionKey,
                lowerAddresses,
              )
            : Promise.resolve(false);

        if (!lowerAddresses.length) {
          set(() => ({ isLoading: true }));
          await new Promise(resolve => setTimeout(resolve, 0));
          if (isCurrentRequest()) {
            set(() => ({
              tokenListMap: {},
              sourceSnapshotReadyByAddress: {},
              isLoading: false,
            }));
          }
          trace.finish({ path: 'empty-addresses' });
          return;
        }

        try {
          let confirmedLocalAddresses: string[] = [];
          if (!isForceRequested()) {
            const [expirationByAddress, projectionRestored] = await Promise.all(
              [
                getDataExpirationByAddress(lowerAddresses),
                projectionRestorePromise,
              ],
            );
            const isExpired = Object.values(expirationByAddress).some(Boolean);
            confirmedLocalAddresses = lowerAddresses.filter(
              address => !expirationByAddress[address],
            );
            trace.mark('expiry-resolved', {
              isExpired,
              projectionRestored,
            });
            if (!isExpired && !isForceRequested()) {
              if (projectionRestored && !ticket.isFullSnapshotRequested()) {
                set(state => ({
                  sourceSnapshotReadyByAddress: markAssetSourceSnapshotsReady(
                    state.sourceSnapshotReadyByAddress,
                    confirmedLocalAddresses,
                  ),
                }));
                const projection = preferredProjectionKey
                  ? useTokenAssetsIndexStore.getState().multiAssetsResultByKey[
                      preferredProjectionKey
                    ]
                  : undefined;
                const itemCount = projection?.tokenIds.length || 0;
                trace.mark('local-projection-loaded', { itemCount });
                trace.finish({ path: 'local-projection', itemCount });
                return;
              }
              const missingAddresses = getAddressesWithoutListSnapshot(
                lowerAddresses,
                get().tokenListMap,
              );
              await hydrateTokenCache(
                missingAddresses,
                'multi-address-fresh-local',
              );
              set(state => ({
                sourceSnapshotReadyByAddress: markAssetSourceSnapshotsReady(
                  state.sourceSnapshotReadyByAddress,
                  confirmedLocalAddresses,
                ),
              }));
              const itemCount = lowerAddresses.reduce(
                (count, address) =>
                  count + (get().tokenListMap[address]?.length || 0),
                0,
              );
              trace.mark('local-db-loaded', { itemCount });
              trace.finish({
                path: missingAddresses.length ? 'local-db' : 'memory-snapshot',
                itemCount,
                loadedAddressCount: missingAddresses.length,
              });
              return;
            }
            if (!isExpired) {
              confirmedLocalAddresses = [];
              trace.mark('force-refresh-coalesced');
            }
          }

          if (
            !isCurrentRequest() ||
            !tokenAddressRequests.activate(addressRequest).length
          ) {
            trace.finish({ path: 'stale-before-remote' });
            return;
          }
          tokenCacheHydrator.invalidate(lowerAddresses);

          if (isCurrentRequest()) {
            set(() => ({ isLoading: true }));
          }

          const cacheTokenQueue = new PQueue({
            concurrency: 5,
          });
          const cacheTokenMap: Record<string, ITokenItem[]> = {};
          const cacheSucceededAddresses = new Set<string>();
          trace.mark('cache-requests-dispatched', {
            addressCount: lowerAddresses.length,
            concurrency: 5,
          });
          const cacheTokensPromise = Promise.allSettled(
            lowerAddresses.map(address =>
              cacheTokenQueue.add(async () => {
                const list = await queryTokensCache(address);
                const normalizedList = await normalizeRemoteTokenList(
                  list,
                  address,
                  isCurrentRequest,
                );
                if (!normalizedList) {
                  return;
                }
                cacheTokenMap[address] = normalizedList;
                cacheSucceededAddresses.add(address);
              }),
            ),
          );

          const currentTokenListMap = get().tokenListMap;
          const hasMemorySnapshot = lowerAddresses.every(address =>
            Object.prototype.hasOwnProperty.call(currentTokenListMap, address),
          );
          const projectionRestored = await projectionRestorePromise;
          const canRetainProjectionOnly =
            projectionRestored && !ticket.isFullSnapshotRequested();
          if (!force && !hasMemorySnapshot && !canRetainProjectionOnly) {
            const missingAddresses = getAddressesWithoutListSnapshot(
              lowerAddresses,
              get().tokenListMap,
            );
            await hydrateTokenCache(
              missingAddresses,
              'multi-address-stale-local',
            );
            const localItemCount = lowerAddresses.reduce(
              (count, address) =>
                count + (get().tokenListMap[address]?.length || 0),
              0,
            );
            trace.mark('stale-local-db-loaded', {
              itemCount: localItemCount,
              loadedAddressCount: missingAddresses.length,
            });
            if (getCurrentAddresses().length) {
              trace.mark('stale-local-store-published', {
                itemCount: localItemCount,
              });
            }
          } else {
            trace.mark('memory-snapshot-retained', {
              hasMemorySnapshot,
              projectionRestored,
            });
          }
          if (confirmedLocalAddresses.length) {
            set(state => ({
              sourceSnapshotReadyByAddress: markAssetSourceSnapshotsReady(
                state.sourceSnapshotReadyByAddress,
                confirmedLocalAddresses,
              ),
            }));
          }

          await cacheTokensPromise;
          trace.mark('cache-responses-completed', {
            addressCount: lowerAddresses.length,
            succeededAddressCount: cacheSucceededAddresses.size,
            failedAddressCount:
              lowerAddresses.length - cacheSucceededAddresses.size,
            itemCount: Object.values(cacheTokenMap).reduce(
              (count, tokens) => count + tokens.length,
              0,
            ),
          });
          const currentAddressesAfterCache = getCurrentAddresses();
          if (!currentAddressesAfterCache.length) {
            trace.finish({ path: 'stale-after-cache' });
            return;
          }
          const latestTokenListMap = get().tokenListMap;
          const cacheApplicableAddresses = currentAddressesAfterCache.filter(
            address =>
              cacheSucceededAddresses.has(address) &&
              !Object.prototype.hasOwnProperty.call(
                latestTokenListMap,
                address,
              ),
          );

          if (cacheApplicableAddresses.length) {
            const mergedCacheTokenMap = { ...latestTokenListMap };
            cacheApplicableAddresses.forEach(address => {
              mergedCacheTokenMap[address] = cacheTokenMap[address] || [];
            });
            syncTokenRuntimeStoresFromTokenListMap(
              mergedCacheTokenMap,
              cacheApplicableAddresses,
              'remote',
              {
                markTokenListMapSynced: true,
                markPersistencePending: true,
              },
            );
            tokenCacheHydrator.invalidate(cacheApplicableAddresses);
            set(() => ({ tokenListMap: mergedCacheTokenMap }));
            trace.mark('cache-store-published', {
              addressCount: cacheApplicableAddresses.length,
            });
          } else {
            trace.mark('cache-store-skipped', {
              reason: 'memory-snapshot-retained',
            });
          }

          const realTimeTokenMap: Record<string, ITokenItem[]> = {};
          const completeRealTimeTokenMap: Record<string, ITokenItem[]> = {};
          const realTimeTokenQueue = new PQueue({
            concurrency: 15,
          });
          let usedChainListSucceededAddressCount = 0;
          let requestedChainCount = 0;
          trace.mark('remote-address-requests-dispatched', {
            addressCount: lowerAddresses.length,
            chainConcurrency: 15,
          });
          const remoteAddressResults = await Promise.allSettled(
            lowerAddresses.map(async address => {
              const chains = await openapi.usedChainList(address);
              const chainIdList = chains.map(item => item.id);
              usedChainListSucceededAddressCount += 1;
              requestedChainCount += chainIdList.length;
              const res = await Promise.allSettled(
                chainIdList.map(async serverId => {
                  const tokens =
                    (await realTimeTokenQueue.add(async () => {
                      const chainTokensRes = await requestOpenApiWithChainId(
                        ({ openapi }) =>
                          openapi.listToken(address, serverId, true),
                        {
                          isTestnet: false,
                        },
                      );
                      return (
                        (await normalizeRemoteTokenList(
                          chainTokensRes,
                          address,
                          isCurrentRequest,
                        )) || []
                      );
                    })) || [];
                  return { serverId, tokens };
                }),
              );

              const fulfilledChainSnapshots = res.flatMap(result =>
                result.status === 'fulfilled' ? [result.value] : [],
              );
              const hasFailedChain = res.some(
                result => result.status === 'rejected',
              );

              // A chain failure must not invalidate the other chains of this
              // address. Keep the last usable snapshot for failed chains and only
              // mark the address fresh when every requested chain succeeded.
              if (!fulfilledChainSnapshots.length && hasFailedChain) {
                return;
              }

              if (
                hasFailedChain &&
                canRetainProjectionOnly &&
                !hasMemorySnapshot
              ) {
                // Projection-first Home restores do not populate the complete
                // address map. Hydrate only this failure case so successful
                // chains can still merge with the last usable failed-chain data.
                await hydrateTokenCache(
                  [address],
                  'multi-address-partial-chain-fallback',
                );
              }
              const nextTokens = hasFailedChain
                ? fulfilledChainSnapshots.reduce(
                    (tokens, snapshot) =>
                      replaceTokensByChain(
                        tokens,
                        snapshot.tokens,
                        snapshot.serverId,
                      ),
                    get().tokenListMap[address] || [],
                  )
                : fulfilledChainSnapshots.flatMap(snapshot => snapshot.tokens);

              realTimeTokenMap[address] = nextTokens;
              if (!hasFailedChain) {
                completeRealTimeTokenMap[address] = nextTokens;
              }
            }),
          );
          trace.mark('remote-addresses-settled', {
            addressCount: lowerAddresses.length,
            succeededAddressCount: remoteAddressResults.filter(
              result => result.status === 'fulfilled',
            ).length,
            failedAddressCount: remoteAddressResults.filter(
              result => result.status === 'rejected',
            ).length,
            usedChainListSucceededAddressCount,
            requestedChainCount,
          });

          const remoteApplicableAddresses = getCurrentAddresses().filter(
            address =>
              Object.prototype.hasOwnProperty.call(realTimeTokenMap, address),
          );
          const applicableRealTimeTokenMap = Object.fromEntries(
            remoteApplicableAddresses.map(address => [
              address,
              realTimeTokenMap[address] || [],
            ]),
          );
          trace.mark('remote-responses-completed', {
            itemCount: Object.values(applicableRealTimeTokenMap).reduce(
              (count, tokens) => count + tokens.length,
              0,
            ),
          });
          if (!remoteApplicableAddresses.length) {
            trace.finish({ path: 'stale-after-remote' });
            return;
          }

          const nextTokenListMap = mergeAddressListSnapshots(
            get().tokenListMap,
            remoteApplicableAddresses,
            applicableRealTimeTokenMap,
          );
          const persistenceTicket = syncTokenRuntimeStoresFromTokenListMap(
            nextTokenListMap,
            remoteApplicableAddresses,
            'remote',
            {
              markTokenListMapSynced: true,
              markPersistencePending: true,
            },
          );
          tokenCacheHydrator.invalidate(remoteApplicableAddresses);
          const completeApplicableAddresses = remoteApplicableAddresses.filter(
            address =>
              Object.prototype.hasOwnProperty.call(
                completeRealTimeTokenMap,
                address,
              ),
          );
          set(state => ({
            tokenListMap: nextTokenListMap,
            sourceSnapshotReadyByAddress: markAssetSourceSnapshotsReady(
              state.sourceSnapshotReadyByAddress,
              completeApplicableAddresses,
            ),
            isLoading: false,
          }));
          const completeApplicableRealTimeTokenMap = Object.fromEntries(
            completeApplicableAddresses.map(address => [
              address,
              completeRealTimeTokenMap[address] || [],
            ]),
          );
          if (Object.keys(completeApplicableRealTimeTokenMap).length) {
            settleTokenProjectionPersistence(
              persistenceTicket,
              syncRemoteTokensForAddresses(completeApplicableRealTimeTokenMap),
              completeApplicableAddresses,
            );
          }
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
      {
        allowProjectionOnly: !!preferredProjectionKey && !force,
      },
    );
  },

  async getTokenList(address: string, force = false, chainServerId?: string) {
    const normalizedAddress = address.toLowerCase();
    const addressRequest = tokenAddressRequests.reserve([normalizedAddress]);
    const isCurrentRequest = () =>
      tokenAddressRequests.isCurrent(addressRequest, normalizedAddress);
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
    const hasCurrentAddressSnapshot = Object.prototype.hasOwnProperty.call(
      get().tokenListMap,
      normalizedAddress,
    );
    const targetChainServerId = chainServerId || undefined;

    // 如果本地有数据且未过期（目的：避免缓存接口的延迟问题），或者本地有数据且指定了链（目的：单链刷新就一个接口，没必要走缓存接口），可跳过缓存接口
    const isRefreshingWithValidLocalTokens =
      hasCurrentAddressTokens && (force || !isExpired || !!targetChainServerId);

    /**
     * 阶段一： 校验有效期，有效期内直接用本地数据
     */
    if (!force && !isExpired) {
      try {
        if (!hasCurrentAddressSnapshot) {
          await hydrateTokenCache(
            [normalizedAddress],
            'single-address-fresh-local',
          );
        }
        set(state => ({
          sourceSnapshotReadyByAddress: markAssetSourceSnapshotsReady(
            state.sourceSnapshotReadyByAddress,
            [normalizedAddress],
          ),
        }));
        const itemCount = get().tokenListMap[normalizedAddress]?.length || 0;
        trace.mark('local-db-loaded', { itemCount });
        trace.mark('local-store-published', { itemCount });
        trace.finish({ path: 'local-db' });
        return;
      } catch (error) {
        trace.fail({ phase: 'local-db' });
        throw error;
      }
    }

    if (!tokenAddressRequests.activate(addressRequest).length) {
      trace.finish({ path: 'stale-before-remote' });
      return;
    }
    tokenCacheHydrator.invalidate([normalizedAddress]);

    set(state => ({
      isLoadingByAddress: {
        ...state.isLoadingByAddress,
        [normalizedAddress]: { loading: true, allLoading: true },
      },
    }));

    try {
      const shouldHydrateStaleLocalTokens =
        !force && isExpired && !hasCurrentAddressSnapshot;
      const cacheListPromise = isRefreshingWithValidLocalTokens
        ? null
        : queryTokensCache(address);

      if (shouldHydrateStaleLocalTokens) {
        try {
          await hydrateTokenCache(
            [normalizedAddress],
            'single-address-stale-local',
          );
          if (!isCurrentRequest()) {
            trace.finish({ path: 'stale-after-hydrate' });
            return;
          }
          const localTokens = get().tokenListMap[normalizedAddress] || [];
          trace.mark('stale-local-db-loaded', {
            itemCount: localTokens.length,
          });

          if (localTokens.length > 0) {
            set(state => ({
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
        if (!isCurrentRequest()) {
          trace.finish({ path: 'stale-after-cache' });
          return;
        }
        trace.mark('cache-response', { itemCount: cacheList.length });
        const cacheTokens = await normalizeRemoteTokenList(
          cacheList,
          address,
          isCurrentRequest,
        );
        if (!cacheTokens) {
          trace.finish({ path: 'stale-during-cache-normalization' });
          return;
        }
        const currentState = get();
        const previousTokens =
          currentState.tokenListMap[normalizedAddress] || [];

        // 以此弥补cache接口数据不完整，带来的接口列表闪动
        let noCoreDBTokens: ITokenItem[] = [];
        if (!previousTokens.some(token => !token.is_core)) {
          const noCoreDBTokensList =
            await TokenItemEntity.batchQueryNoCoreTokens(normalizedAddress);
          if (!isCurrentRequest()) {
            trace.finish({ path: 'stale-after-non-core-cache' });
            return;
          }
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
            markPersistencePending: true,
          },
        );
        tokenCacheHydrator.invalidate([normalizedAddress]);
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
      if (!isCurrentRequest()) {
        trace.finish({ path: 'stale-after-chains' });
        return;
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
              const tokenList = await normalizeRemoteTokenList(
                chainTokensRes,
                address,
                isCurrentRequest,
              );
              return tokenList || [];
            }),
        ),
      );
      const failed = res.find(result => result.status === 'rejected');
      if (failed?.status === 'rejected') {
        trace.fail({ phase: 'remote-chain' });
        console.error('ServiceErrorType.Token', failed.reason);
        return;
      }
      const results = res
        .map(result => (result.status === 'fulfilled' ? result.value : []))
        .flat() as ITokenItem[];
      trace.mark('remote-token-responses', { itemCount: results.length });
      if (!isCurrentRequest()) {
        trace.finish({ path: 'stale-after-remote' });
        return;
      }

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
        const persistenceTicket = syncTokenRuntimeStoresFromTokenListMap(
          nextTokenListMap,
          [normalizedAddress],
          'remote',
          {
            markTokenListMapSynced: true,
            markPersistencePending: true,
          },
        );
        tokenCacheHydrator.invalidate([normalizedAddress]);
        set(() => ({
          tokenListMap: nextTokenListMap,
        }));
        settleTokenProjectionPersistence(
          persistenceTicket,
          syncRemoteTokens(
            normalizedAddress,
            nextTokenListMap[normalizedAddress],
            {
              cleanupStale: false,
            },
          ),
        );
      } else {
        const nextTokenListMap = {
          ...get().tokenListMap,
          [normalizedAddress]: results,
        };
        const persistenceTicket = syncTokenRuntimeStoresFromTokenListMap(
          nextTokenListMap,
          [normalizedAddress],
          'remote',
          {
            markTokenListMapSynced: true,
            markPersistencePending: true,
          },
        );
        tokenCacheHydrator.invalidate([normalizedAddress]);
        set(state => ({
          tokenListMap: nextTokenListMap,
          sourceSnapshotReadyByAddress: markAssetSourceSnapshotsReady(
            state.sourceSnapshotReadyByAddress,
            [normalizedAddress],
          ),
        }));
        settleTokenProjectionPersistence(
          persistenceTicket,
          syncRemoteTokens(normalizedAddress, results),
        );
      }
      trace.mark('remote-store-published', { itemCount: results.length });
      trace.finish({ path: 'remote' });
    } catch (error) {
      trace.fail({ phase: 'refresh' });
      throw error;
    } finally {
      if (isCurrentRequest()) {
        set(state => ({
          isLoadingByAddress: {
            ...state.isLoadingByAddress,
            [normalizedAddress]: { loading: false, allLoading: false },
          },
        }));
      }
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
  tokenCacheHydrator.invalidate([normalizedAddress]);
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

const syncKnownTokenProjectionsForAddresses = (
  changedAddresses: Set<string>,
) => {
  const state = useTokenAssetsIndexStore.getState();
  const singleAvailabilityUpdates: Record<string, AssetProjectionAvailability> =
    {};
  const multiAvailabilityUpdates: Record<string, AssetProjectionAvailability> =
    {};
  Object.values(state.singleAssetsConfigByKey).forEach(config => {
    if (!changedAddresses.has(config.address)) {
      return;
    }
    const result = state.singleAssetsResultByKey[config.key];
    if (result) {
      const availability = getTokenAssetsProjectionAvailability(config, result);
      if (state.singleAssetsAvailabilityByKey[config.key] !== availability) {
        singleAvailabilityUpdates[config.key] = availability;
      }
      scheduleTokenAssetsProjectionPersistence(
        config.key,
        'single-address',
        result,
      );
    }
  });
  Object.values(state.multiAssetsConfigByKey).forEach(config => {
    if (
      !config.addresses.some(address =>
        changedAddresses.has(normalizeAddress(address)),
      )
    ) {
      return;
    }
    const result = state.multiAssetsResultByKey[config.key];
    if (result) {
      const availability = getTokenAssetsProjectionAvailability(config, result);
      if (state.multiAssetsAvailabilityByKey[config.key] !== availability) {
        multiAvailabilityUpdates[config.key] = availability;
      }
      scheduleTokenAssetsProjectionPersistence(
        config.key,
        'multi-address',
        result,
        config.tokenDisplayMode,
      );
    }
  });
  if (
    Object.keys(singleAvailabilityUpdates).length ||
    Object.keys(multiAvailabilityUpdates).length
  ) {
    useTokenAssetsIndexStore.setState(draft => {
      Object.entries(singleAvailabilityUpdates).forEach(
        ([key, availability]) => {
          draft.singleAssetsAvailabilityByKey[key] = availability;
        },
      );
      Object.entries(multiAvailabilityUpdates).forEach(
        ([key, availability]) => {
          draft.multiAssetsAvailabilityByKey[key] = availability;
        },
      );
    });
  }
};

let lastComputedTokenListMap = tokenListStore.getState().tokenListMap;
let lastTokenSourceSnapshotReadiness =
  tokenListStore.getState().sourceSnapshotReadyByAddress;
tokenListStore.subscribe(state => {
  if (
    state.tokenListMap === lastComputedTokenListMap &&
    state.sourceSnapshotReadyByAddress === lastTokenSourceSnapshotReadiness
  ) {
    return;
  }
  const previousTokenListMap = lastComputedTokenListMap;
  const tokenListChangedAddresses = getTokenListMapChangedAddresses(
    previousTokenListMap,
    state.tokenListMap,
  );
  const readinessChangedAddresses = getAssetSourceReadinessChangedAddresses(
    lastTokenSourceSnapshotReadiness,
    state.sourceSnapshotReadyByAddress,
  );
  const projectionChangedAddresses = new Set([
    ...tokenListChangedAddresses,
    ...readinessChangedAddresses,
  ]);
  lastComputedTokenListMap = state.tokenListMap;
  lastTokenSourceSnapshotReadiness = state.sourceSnapshotReadyByAddress;
  if (state.tokenListMap === lastTokenListMapSyncedToRuntime) {
    lastTokenListMapSyncedToRuntime = undefined;
    syncKnownTokenProjectionsForAddresses(projectionChangedAddresses);
    return;
  }
  if (!tokenListChangedAddresses.size) {
    syncKnownTokenProjectionsForAddresses(readinessChangedAddresses);
    return;
  }
  tokenEntityResourceStore.syncChangedAddressesFromTokenListMap(
    state.tokenListMap,
    tokenListChangedAddresses,
  );
  useTokenIndexStore
    .getState()
    .syncFromTokenListMap(
      state.tokenListMap,
      Array.from(tokenListChangedAddresses),
    );
  syncKnownTokenProjectionsForAddresses(projectionChangedAddresses);
});

tokenEntityResourceStore.subscribeTokenChanges(changedTokenIds => {
  useTokenAssetsIndexStore
    .getState()
    .syncChangedTokenAssetsResults(changedTokenIds);
});

export default tokenListStore;
