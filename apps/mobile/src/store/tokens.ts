import { queryTokensCache } from '@/core/apis/tokenCache';
import { openapi } from '@/core/request';
import { zCreate, zMutative } from '@/core/utils/reexports';
import { TokenItemEntity } from '@/databases/entities/tokenitem';
import {
  compileTokenAssetSqlProjection,
  type TokenAssetSqlProjection,
  type TokenAssetSqlProjectionRow,
} from '@/databases/tokenAssetProjection';
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
import {
  ASSET_REMOTE_ADDRESS_CONCURRENCY,
  mapSettledWithConcurrency,
} from '@/core/utils/boundedConcurrency';
import { isHttpRateLimitedError } from '@/core/utils/rateLimitError';
import { LatestAsyncRequest } from '@/core/utils/latestAsyncRequest';
import { LatestAddressRequest } from '@/core/utils/latestAddressRequest';
import {
  createAddressListCommitBatcher,
  createAddressListSnapshotHydrator,
  mergeAddressListSnapshots,
} from './_addressListSnapshot';
import type { RestoredAssetProjection } from '@/databases/assetProjection';
import {
  isAssetProjectionPersistenceActive,
  restoreAssetProjection,
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
import {
  executeTokenChainSync,
  getTokenChainSyncMode,
} from './tokenChainSyncExecutor';
import {
  selectTokenCacheApplicableAddresses,
  selectTokenCacheRequestAddresses,
} from './tokenCacheRequestPolicy';
import {
  beginAssetReadModelRefresh,
  beginAssetReadModelRestore,
  ensureAssetReadModel,
  failAssetReadModel,
  getAssetReadModel,
  publishAssetReadModel,
  type AssetReadModelSource,
} from './assetReadModel';
import {
  AssetSyncCoordinator,
  type AssetSyncTicket,
  type AssetSyncTrigger,
} from './assetSyncCoordinator';
import {
  registerNativeAssetSyncHandler,
  type NativeAssetSyncCompletion,
} from './nativeAssetSyncReceipt';

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
const tokenAssetSyncCoordinator = new AssetSyncCoordinator();
const tokenAddressRequests = new LatestAddressRequest();
const tokenProjectionPersistenceGate = new TokenProjectionPersistenceGate();

let automaticTokenProjectionSyncSuppressionDepth = 0;

const isAutomaticTokenProjectionSyncSuppressed = () =>
  automaticTokenProjectionSyncSuppressionDepth > 0;

const withAutomaticTokenProjectionSyncSuppressed = <T>(callback: () => T) => {
  automaticTokenProjectionSyncSuppressionDepth += 1;
  try {
    return callback();
  } finally {
    automaticTokenProjectionSyncSuppressionDepth -= 1;
  }
};

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
    trigger?: AssetSyncTrigger,
  ): Promise<void>;
  getTokenList(
    address: string,
    force?: boolean,
    chainServerId?: string,
    trigger?: AssetSyncTrigger,
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

const TOKEN_ASSETS_INDEX_SEGMENT_KEYS: Array<keyof TokenAssetsIndexSegments> = [
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
    new Set(changedTokenIds.map(getTokenEntityIdAddress)).forEach(address => {
      this.addressVersions.set(
        address,
        (this.addressVersions.get(address) || 0) + 1,
      );
    });
    this.tokenChangeListeners.forEach(listener => listener(changedTokenIds));
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

        return {
          address,
          nextTokenIds,
          nextStaticItems,
          nextStaticTokenIds: new Set(
            nextStaticItems.map(item => item.tokenId),
          ),
        };
      });

      set(draft => {
        updates.forEach(
          ({ address, nextTokenIds, nextStaticItems, nextStaticTokenIds }) => {
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

            Object.keys(draft.tokenStaticMap).forEach(tokenId => {
              if (
                getTokenEntityIdAddress(tokenId) === address &&
                !nextStaticTokenIds.has(tokenId as TokenEntityId)
              ) {
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

const createEmptyTokenAssetsProjectionSourceSections =
  (): TokenAssetsProjectionSourceSections => ({
    primary: [],
    additionalDefault: [],
    additionalLp: [],
    lowValueDefault: [],
    lowValueLp: [],
  });

const buildTokenItemFromSqlProjectionRow = (
  row: TokenAssetSqlProjectionRow,
): ITokenItem => {
  const primaryToken = tokenEntityResourceStore.getValue(
    row.primaryResourceId as TokenEntityId,
  );
  if (!primaryToken) {
    throw new Error(
      `Token SQL projection primary entity is missing: ${row.primaryResourceId}`,
    );
  }
  if (!row.groupKey) {
    return primaryToken;
  }

  const groupItems = row.memberResourceIds.map(resourceId => {
    const token = tokenEntityResourceStore.getValue(
      resourceId as TokenEntityId,
    );
    if (!token) {
      throw new Error(
        `Token SQL projection member entity is missing: ${resourceId}`,
      );
    }
    return token;
  });
  if (
    !groupItems.some(
      token => buildTokenEntityId(token) === row.primaryResourceId,
    )
  ) {
    throw new Error(
      `Token SQL projection primary is not a group member: ${row.primaryResourceId}`,
    );
  }

  return {
    ...primaryToken,
    amount: row.totalAmount,
    usd_value: row.totalUsdValue,
    groupKey: row.groupKey,
    groupItems,
  } as AggregatedTokenItem;
};

const buildTokenAssetsIndexResultFromSqlProjection = ({
  projection,
  isLpTokenEnabled,
  listKey,
  previousResult,
}: {
  projection: TokenAssetSqlProjection;
  isLpTokenEnabled?: boolean;
  listKey?: string;
  previousResult?: TokenAssetsIndexResult;
}) => {
  const sourceSections = createEmptyTokenAssetsProjectionSourceSections();
  projection.rows.forEach(row => {
    sourceSections[row.segment].push(buildTokenItemFromSqlProjectionRow(row));
  });

  const additionalTokens = isLpTokenEnabled
    ? sourceSections.additionalLp
    : sourceSections.additionalDefault;
  const lowValueTokens = isLpTokenEnabled
    ? sourceSections.lowValueLp
    : sourceSections.lowValueDefault;
  const hasLpTokens =
    sourceSections.additionalLp.length + sourceSections.lowValueLp.length > 0;
  const result: TokenAssetsProjectionResult = {
    tokens: sourceSections.primary.concat(additionalTokens, lowValueTokens),
    sourceSections,
    defaultVisibleTokenCount: sourceSections.primary.length,
    additionalTokenCount: additionalTokens.length,
    lowValueTokenCount: lowValueTokens.length,
    additionalCoreUsdValue: sourceSections.additionalDefault.reduce(
      (total, token) =>
        token.is_core ? total + (token.usd_value || 0) : total,
      0,
    ),
    lowValueTokenPreviewLogoUrls: lowValueTokens
      .slice(0, 3)
      .map(token => token.logo_url),
    lpLowValueTokenPreviewLogoUrls: sourceSections.lowValueLp
      .slice(0, 3)
      .map(token => token.logo_url),
    hasAdditionalTokens:
      sourceSections.additionalDefault.length +
        sourceSections.lowValueDefault.length >
        0 || hasLpTokens,
    hasLpTokens,
  };

  return buildTokenAssetsIndexResult(result, listKey, previousResult);
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

const getTokenAssetReadModelIdentity = (
  runtimeKey: string,
  scene: TokenProjectionScene,
) => ({
  kind: 'token' as const,
  scene,
  runtimeKey,
});

const syncTokenAssetReadModel = ({
  key,
  scene,
  config,
  result,
  source = 'memory',
  generation,
  committedAt,
  committedRequestId,
  requestId,
}: {
  key: string;
  scene: TokenProjectionScene;
  config: SingleTokenAssetsIndexConfig | MultiTokenAssetsIndexConfig;
  result: TokenAssetsIndexResult;
  source?: Exclude<AssetReadModelSource, 'none'>;
  generation?: number;
  committedAt?: number;
  committedRequestId?: string;
  requestId?: string;
}) => {
  const identity = getTokenAssetReadModelIdentity(key, scene);
  ensureAssetReadModel(identity);
  const addresses = 'address' in config ? [config.address] : config.addresses;
  const sourceComplete = hasConfirmedAssetProjectionSources(
    addresses,
    tokenListStore.getState().sourceSnapshotReadyByAddress,
  );
  const availability = getTokenAssetsProjectionAvailability(config, result);

  if (availability !== 'ready') {
    return;
  }

  publishAssetReadModel(identity, {
    source,
    rowCount: result.rows.length,
    sourceComplete,
    generation,
    committedAt,
    committedRequestId,
    requestId,
  });
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
        lowValueTokenPreviewLogoUrls: result.lowValueTokenPreviewLogoUrls,
        lpLowValueTokenPreviewLogoUrls: result.lpLowValueTokenPreviewLogoUrls,
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
};

const parsePersistedStringList = (value: unknown) =>
  Array.isArray(value) && value.every(item => typeof item === 'string')
    ? (value as string[])
    : null;

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
  const segmentRowCounts = restored.metadata.segmentRowCounts;
  const primaryRowCount =
    segmentRowCounts &&
    typeof segmentRowCounts === 'object' &&
    !Array.isArray(segmentRowCounts)
      ? (segmentRowCounts as Record<string, unknown>).primary
      : null;

  if (
    !groupPrimaryTokenIds ||
    !lowValueTokenPreviewLogoUrls ||
    !lpLowValueTokenPreviewLogoUrls ||
    !Number.isInteger(primaryRowCount) ||
    (primaryRowCount as number) < 0 ||
    (primaryRowCount as number) > restored.rows.length
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
  const rawSegmentRowCounts = restored.metadata.segmentRowCounts;
  const segmentRowCounts =
    rawSegmentRowCounts &&
    typeof rawSegmentRowCounts === 'object' &&
    !Array.isArray(rawSegmentRowCounts)
      ? (rawSegmentRowCounts as Record<string, unknown>)
      : null;
  const parsedSegmentRowCounts = segmentRowCounts
    ? TOKEN_ASSETS_INDEX_SEGMENT_KEYS.reduce<
        Partial<Record<keyof TokenAssetsIndexSegments, number>>
      >((counts, segmentKey) => {
        const count = segmentRowCounts[segmentKey];
        if (Number.isInteger(count) && (count as number) >= 0) {
          counts[segmentKey] = count as number;
        }
        return counts;
      }, {})
    : null;
  const hasCompleteSegmentRowCounts = TOKEN_ASSETS_INDEX_SEGMENT_KEYS.every(
    segmentKey => Number.isInteger(parsedSegmentRowCounts?.[segmentKey]),
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
  if (
    !hasCompleteSegmentRowCounts ||
    persistedRowCount !== rows.length ||
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
      const count = parsedSegmentRowCounts![segmentKey]!;
      const segmentEnd = segmentStart + count;
      result[segmentKey] = {
        rows: rows.slice(segmentStart, segmentEnd),
        tokenIds: tokenIds.slice(segmentStart, segmentEnd),
      };
      segmentStart = segmentEnd;
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

const tokenProjectionRestoreRequests = new Map<string, Promise<void>>();

const yieldTokenProjectionEntityRestore = () =>
  new Promise<void>(resolve => setTimeout(resolve, 0));

const restoreTokenAssetsProjectionIfEmpty = (
  key: string,
  scene: TokenProjectionScene,
) => {
  if (
    isAssetProjectionPersistenceActive({
      runtimeKey: key,
      kind: 'token',
      scene,
    })
  ) {
    return;
  }
  const requestKey = `${scene}:${key}`;
  if (tokenProjectionRestoreRequests.has(requestKey)) {
    return;
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
  if (!startedConfig || startedResult?.rows.length) {
    return;
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
    return;
  }

  useTokenAssetsIndexStore.setState(draft => {
    if (scene === 'single-address') {
      draft.singleAssetsAvailabilityByKey[key] = 'restoring';
    } else {
      draft.multiAssetsAvailabilityByKey[key] = 'restoring';
    }
  });
  beginAssetReadModelRestore(getTokenAssetReadModelIdentity(key, scene));
  const trace = beginAssetDataLoadDiagnostic(
    'asset-projection-token-restore',
    scene,
    { addressCount: addresses.length },
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
      },
    );
    if (!restored) {
      trace.finish({ reason: 'projection-missing' });
      return;
    }
    trace.mark('projection-restored', { itemCount: restored.rows.length });

    const usesStagedEntityRestore =
      restored.metadata.entityRestoreMode ===
      TOKEN_ASSET_PROJECTION_ENTITY_RESTORE_MODE;
    const stagedMetadata = usesStagedEntityRestore
      ? parseStagedTokenProjectionRestoreMetadata(restored) || undefined
      : undefined;
    if (usesStagedEntityRestore && !stagedMetadata) {
      trace.finish({ reason: 'staged-metadata-invalid' });
      return;
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
      return;
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
        return;
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
      tokenEntityResourceStore.upsertTokens(missingTokens, 'hydrate');
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
      return;
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
      return;
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
    syncTokenAssetReadModel({
      key,
      scene,
      config: startedConfig,
      result,
      source: 'database',
      generation: restored.generation,
      committedAt: restored.committedAt,
    });
    trace.finish({
      itemCount: result.rows.length,
      restoredEntityCount: requiredTokenIds.size,
      path: stagedMetadata ? 'staged' : 'legacy-full',
    });

    if (!stagedMetadata) {
      return;
    }

    const remainingTokenIds = Array.from(allTokenIds).filter(
      tokenId => !tokenEntityResourceStore.getValue(tokenId),
    );
    if (!remainingTokenIds.length) {
      return;
    }

    const backgroundTrace = beginAssetDataLoadDiagnostic(
      'asset-projection-token-entity-background-restore',
      scene,
      {
        addressCount: addresses.length,
        itemCount: remainingTokenIds.length,
      },
    );
    const isBackgroundRestoreCurrent = () => {
      const currentState = useTokenAssetsIndexStore.getState();
      const currentConfig =
        scene === 'single-address'
          ? currentState.singleAssetsConfigByKey[key]
          : currentState.multiAssetsConfigByKey[key];
      const currentResult =
        scene === 'single-address'
          ? currentState.singleAssetsResultByKey[key]
          : currentState.multiAssetsResultByKey[key];
      return (
        currentConfig === startedConfig &&
        currentResult === result &&
        tokenListStore.getState().tokenListMap === startedSourceMap
      );
    };

    void (async () => {
      await yieldTokenProjectionEntityRestore();
      let restoredCount = 0;
      for (
        let start = 0;
        start < remainingTokenIds.length;
        start += TOKEN_ASSET_PROJECTION_ENTITY_RESTORE_BATCH_SIZE
      ) {
        if (!isBackgroundRestoreCurrent()) {
          backgroundTrace.finish({
            reason: 'state-changed',
            restoredEntityCount: restoredCount,
          });
          return;
        }
        const batchIds = remainingTokenIds.slice(
          start,
          start + TOKEN_ASSET_PROJECTION_ENTITY_RESTORE_BATCH_SIZE,
        );
        const cachedTokens =
          await TokenItemEntity.batchMultiAddressTokensByResourceIds(batchIds);
        if (!isBackgroundRestoreCurrent()) {
          backgroundTrace.finish({
            reason: 'state-changed-after-query',
            restoredEntityCount: restoredCount,
          });
          return;
        }
        const batchIdSet = new Set(batchIds);
        const tokens = cachedTokens
          .map(token => tokenItemEntityToTokenItem(token))
          .filter(token => batchIdSet.has(buildTokenEntityId(token)));
        tokenEntityResourceStore.upsertTokens(tokens, 'hydrate');
        restoredCount += tokens.length;
        backgroundTrace.mark('entity-batch-published', {
          batchItemCount: tokens.length,
          restoredEntityCount: restoredCount,
        });
        await yieldTokenProjectionEntityRestore();
      }

      if (!isBackgroundRestoreCurrent()) {
        backgroundTrace.finish({
          reason: 'state-changed-before-group-publish',
          restoredEntityCount: restoredCount,
        });
        return;
      }
      const completeResult = buildRestoredTokenAssetsIndexResult(
        restored,
        scene === 'multi-address'
          ? (startedConfig as MultiTokenAssetsIndexConfig).tokenDisplayMode ||
              'byAddress'
          : 'byAddress',
        {
          requiredEntityIds: allTokenIds,
          stagedMetadata,
        },
      );
      backgroundTrace.finish({
        itemCount: remainingTokenIds.length,
        restoredEntityCount: restoredCount,
        groupsReady: !!completeResult,
      });
    })().catch(error => {
      backgroundTrace.fail({ reason: 'background-restore-error' });
      console.error('[tokenProjection] background restore failed', error);
    });
  })()
    .catch(error => {
      trace.fail({ reason: 'restore-error' });
      console.error('[tokenProjection] restore failed', error);
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
      const nextConfig = {
        key,
        address: normalizeAddress(address),
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
        const availability = getTokenAssetsProjectionAvailability(
          nextConfig,
          nextResult,
        );
        if (get().singleAssetsAvailabilityByKey[key] !== availability) {
          set(draft => {
            draft.singleAssetsAvailabilityByKey[key] = availability;
          });
        }
        syncTokenAssetReadModel({
          key,
          scene: 'single-address',
          config: nextConfig,
          result: nextResult,
        });
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
      syncTokenAssetReadModel({
        key,
        scene: 'single-address',
        config: nextConfig,
        result: nextResult,
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
      const key = getSingleAssetsCacheKey(
        normalizedAddress,
        chainServerId,
        isLpTokenEnabled,
      );
      const tokenIds =
        useTokenIndexStore.getState().addressTokenIds[normalizedAddress] ||
        EMPTY_TOKEN_ENTITY_IDS;
      const nextConfig = {
        key,
        address: normalizedAddress,
        tokenIds,
        chainServerId,
        isLpTokenEnabled,
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
        syncTokenAssetReadModel({
          key,
          scene: 'single-address',
          config: nextConfig,
          result: state.singleAssetsResultByKey[key],
        });
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
      const key = getMultiAssetsCacheKey(
        normalizedAddresses,
        chainServerId,
        isLpTokenEnabled,
        tokenDisplayMode,
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
        chainServerId,
        isLpTokenEnabled,
        tokenDisplayMode,
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
        syncTokenAssetReadModel({
          key,
          scene: 'multi-address',
          config: state.multiAssetsConfigByKey[key],
          result: state.multiAssetsResultByKey[key],
        });
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
      const publishedState = get();
      Object.entries(projectionResults).forEach(([key, result]) => {
        const config = publishedState.singleAssetsConfigByKey[key];
        if (config) {
          syncTokenAssetReadModel({
            key,
            scene: 'single-address',
            config,
            result,
          });
        }
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
      const nextConfig = {
        key,
        addresses: normalizedAddresses,
        tokenIds,
        sourceVersionKey: getMultiTokenAssetsSourceVersionKey(
          useTokenIndexStore.getState(),
          normalizedAddresses,
        ),
        chainServerId,
        isLpTokenEnabled,
        tokenDisplayMode,
      };
      const previousConfig = get().multiAssetsConfigByKey[key];
      const previousResult = get().multiAssetsResultByKey[key];
      const isConfigSame = isMultiTokenAssetsIndexConfigSame(
        previousConfig,
        nextConfig,
      );

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
        syncTokenAssetReadModel({
          key,
          scene: 'multi-address',
          config: nextConfig,
          result: previousResult,
        });
        return;
      }

      const nextResult = buildMultiAssetsIndexFromTokenIds(
        tokenIds,
        chainServerId,
        isLpTokenEnabled,
        tokenDisplayMode,
        key,
        previousResult,
      );

      set(draft => {
        if (!isConfigSame) {
          draft.multiAssetsConfigByKey[key] = nextConfig;
        }
        draft.multiAssetsResultByKey[key] = nextResult;
        draft.multiAssetsAvailabilityByKey[key] =
          getTokenAssetsProjectionAvailability(nextConfig, nextResult);
      });
      syncTokenAssetReadModel({
        key,
        scene: 'multi-address',
        config: nextConfig,
        result: nextResult,
      });
      scheduleTokenAssetsProjectionPersistence(
        key,
        'multi-address',
        nextResult,
        tokenDisplayMode,
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
        const config = state.singleAssetsConfigByKey[key];
        if (config) {
          syncTokenAssetReadModel({
            key,
            scene: 'single-address',
            config,
            result,
          });
        }
        scheduleTokenAssetsProjectionPersistence(key, 'single-address', result);
      });
      Object.entries(multiResultUpdates).forEach(([key, result]) => {
        const config = state.multiAssetsConfigByKey[key];
        if (config) {
          syncTokenAssetReadModel({
            key,
            scene: 'multi-address',
            config,
            result,
          });
        }
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
  if (isAutomaticTokenProjectionSyncSuppressed()) {
    return;
  }
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

type TokenAssetSyncOutcome = {
  status: 'complete' | 'partial' | 'superseded';
  source?: Exclude<AssetReadModelSource, 'none'>;
};

type TokenAssetReadModelTarget = {
  key: string;
  scene: TokenProjectionScene;
};

const getTokenAssetReadModelTargets = (
  addresses: string[],
): TokenAssetReadModelTarget[] => {
  const addressSet = normalizeAddressSet(addresses);
  const state = useTokenAssetsIndexStore.getState();
  const targets: TokenAssetReadModelTarget[] = [];

  Object.values(state.singleAssetsConfigByKey).forEach(config => {
    if (addressSet.has(normalizeAddress(config.address))) {
      targets.push({ key: config.key, scene: 'single-address' });
    }
  });
  Object.values(state.multiAssetsConfigByKey).forEach(config => {
    if (
      config.addresses.some(address =>
        addressSet.has(normalizeAddress(address)),
      )
    ) {
      targets.push({ key: config.key, scene: 'multi-address' });
    }
  });

  return targets;
};

const beginTokenAssetReadModelRefresh = (
  addresses: string[],
  requestId: string,
) => {
  const targets = getTokenAssetReadModelTargets(addresses);
  targets.forEach(({ key, scene }) => {
    beginAssetReadModelRefresh(
      getTokenAssetReadModelIdentity(key, scene),
      requestId,
    );
  });
  return targets;
};

const failTokenAssetReadModelRefresh = (
  targets: TokenAssetReadModelTarget[],
  requestId: string,
  error: unknown,
) => {
  targets.forEach(({ key, scene }) => {
    failAssetReadModel(
      getTokenAssetReadModelIdentity(key, scene),
      error,
      requestId,
    );
  });
};

const completeTokenAssetReadModelRefresh = (
  targets: TokenAssetReadModelTarget[],
  requestId: string,
  source?: Exclude<AssetReadModelSource, 'none'>,
) => {
  const state = useTokenAssetsIndexStore.getState();
  targets.forEach(({ key, scene }) => {
    const config =
      scene === 'single-address'
        ? state.singleAssetsConfigByKey[key]
        : state.multiAssetsConfigByKey[key];
    const result =
      scene === 'single-address'
        ? state.singleAssetsResultByKey[key]
        : state.multiAssetsResultByKey[key];
    if (!config || !result) {
      failAssetReadModel(
        getTokenAssetReadModelIdentity(key, scene),
        'projection-unavailable',
        requestId,
      );
      return;
    }

    const identity = getTokenAssetReadModelIdentity(key, scene);
    const currentSource = getAssetReadModel(identity).source;
    syncTokenAssetReadModel({
      key,
      scene,
      config,
      result,
      source: source || (currentSource === 'none' ? 'memory' : currentSource),
      requestId,
    });

    if (getAssetReadModel(identity).activeRequestId === requestId) {
      failAssetReadModel(identity, 'source-incomplete', requestId);
    }
  });
};

const runTokenAssetSync = async ({
  addresses,
  variant,
  force,
  trigger,
  execute,
}: {
  addresses: string[];
  variant: string;
  force: boolean;
  trigger: AssetSyncTrigger;
  execute: (ticket: AssetSyncTicket) => Promise<TokenAssetSyncOutcome>;
}) => {
  let readModelTargets: TokenAssetReadModelTarget[] = [];

  await tokenAssetSyncCoordinator.run({
    scope: { kind: 'token', addresses, variant },
    force,
    trigger,
    onStart: ticket => {
      readModelTargets = beginTokenAssetReadModelRefresh(
        addresses,
        ticket.requestId,
      );
    },
    onSuccess: (ticket, outcome) => {
      if (outcome.status === 'complete') {
        completeTokenAssetReadModelRefresh(
          readModelTargets,
          ticket.requestId,
          outcome.source,
        );
        return;
      }
      failTokenAssetReadModelRefresh(
        readModelTargets,
        ticket.requestId,
        outcome.status === 'partial'
          ? 'source-incomplete'
          : 'request-superseded',
      );
    },
    onError: (ticket, error) => {
      failTokenAssetReadModelRefresh(
        readModelTargets,
        ticket.requestId,
        error instanceof Error ? error.name : 'asset-sync-failed',
      );
    },
    execute,
  });
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
    await tokenCacheHydrator.hydrate(lowerAddresses);
    const tokenMap = get().tokenListMap;
    markStartupPerf('tokenListStore', 'load_cache_end', {
      elapsedMs: Date.now() - loadStartedAt,
      count: lowerAddresses.length,
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

  async batchGetTokenList(
    addresses: string[],
    force = false,
    trigger: AssetSyncTrigger = 'on-demand',
  ) {
    const lowerAddresses = Array.from(
      new Set(addresses.map(item => item.toLowerCase())),
    );
    await runTokenAssetSync({
      addresses: lowerAddresses,
      variant: 'multi-address',
      force,
      trigger,
      execute: async ticket => {
        const requestId = multiAddressTokenRequests.next();
        const addressRequest = tokenAddressRequests.reserve(lowerAddresses);
        const trace = beginAssetDataLoadDiagnostic(
          'multi-address-token',
          lowerAddresses.join('|'),
          {
            addressCount: lowerAddresses.length,
            force,
            trigger: ticket.getTrigger(),
          },
        );
        const isCurrentRequest = () =>
          multiAddressTokenRequests.isCurrent(requestId);
        const getCurrentAddresses = () =>
          isCurrentRequest()
            ? tokenAddressRequests.getCurrentAddresses(addressRequest)
            : [];
        const isForceRequested = () => ticket.isForceRequested();

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
          return { status: 'complete', source: 'database' };
        }

        try {
          let confirmedLocalAddresses: string[] = [];
          const completedAddresses = new Set<string>();
          if (!isForceRequested()) {
            const expirationByAddress = await getDataExpirationByAddress(
              lowerAddresses,
            );
            const isExpired = Object.values(expirationByAddress).some(Boolean);
            confirmedLocalAddresses = lowerAddresses.filter(
              address => !expirationByAddress[address],
            );
            trace.mark('expiry-resolved', { isExpired });
            if (!isExpired && !isForceRequested()) {
              await tokenCacheHydrator.hydrate(lowerAddresses);
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
              trace.finish({ path: 'local-db', itemCount });
              return { status: 'complete', source: 'database' };
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
            return { status: 'superseded' };
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
          const tokenListMapBeforeCache = get().tokenListMap;
          const confirmedLocalAddressSet = new Set(confirmedLocalAddresses);
          const cacheRequestAddresses = selectTokenCacheRequestAddresses(
            lowerAddresses,
            tokenListMapBeforeCache,
            confirmedLocalAddressSet,
          );
          trace.mark('cache-requests-dispatched', {
            addressCount: cacheRequestAddresses.length,
            skippedAddressCount:
              lowerAddresses.length - cacheRequestAddresses.length,
            candidateAddressCount: lowerAddresses.length,
            concurrency: 5,
          });
          const cacheTokensPromise = Promise.allSettled(
            cacheRequestAddresses.map(address =>
              cacheTokenQueue.add(async () => {
                const list = await queryTokensCache(address);
                cacheTokenMap[address] = filterInterfaceTokenList(
                  list.map(item => tokenItemToITokenItem(item, address)),
                );
                cacheSucceededAddresses.add(address);
              }),
            ),
          );

          const currentTokenListMap = get().tokenListMap;
          const hasMemorySnapshot = lowerAddresses.every(address =>
            Object.prototype.hasOwnProperty.call(currentTokenListMap, address),
          );
          if (!force && !hasMemorySnapshot) {
            await tokenCacheHydrator.hydrate(lowerAddresses);
            const localItemCount = lowerAddresses.reduce(
              (count, address) =>
                count + (get().tokenListMap[address]?.length || 0),
              0,
            );
            trace.mark('stale-local-db-loaded', {
              itemCount: localItemCount,
            });
            if (getCurrentAddresses().length) {
              trace.mark('stale-local-store-published', {
                itemCount: localItemCount,
              });
            }
          } else {
            trace.mark('memory-snapshot-retained', {
              hasMemorySnapshot,
            });
          }
          if (confirmedLocalAddresses.length) {
            confirmedLocalAddresses.forEach(address =>
              completedAddresses.add(address),
            );
            set(state => ({
              sourceSnapshotReadyByAddress: markAssetSourceSnapshotsReady(
                state.sourceSnapshotReadyByAddress,
                confirmedLocalAddresses,
              ),
            }));
          }

          await cacheTokensPromise;
          trace.mark('cache-responses-completed', {
            addressCount: cacheRequestAddresses.length,
            skippedAddressCount:
              lowerAddresses.length - cacheRequestAddresses.length,
            candidateAddressCount: lowerAddresses.length,
            succeededAddressCount: cacheSucceededAddresses.size,
            failedAddressCount:
              cacheRequestAddresses.length - cacheSucceededAddresses.size,
            itemCount: Object.values(cacheTokenMap).reduce(
              (count, tokens) => count + tokens.length,
              0,
            ),
          });
          const currentAddressesAfterCache = getCurrentAddresses();
          if (!currentAddressesAfterCache.length) {
            trace.finish({ path: 'stale-after-cache' });
            return { status: 'superseded' };
          }
          const latestTokenListMap = get().tokenListMap;
          const cacheApplicableAddresses = selectTokenCacheApplicableAddresses(
            currentAddressesAfterCache,
            latestTokenListMap,
            cacheTokenMap,
            cacheSucceededAddresses,
            confirmedLocalAddressSet,
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
          const nativeCommittedAddresses = new Set<string>();
          const nativeCompleteAddresses = new Set<string>();
          const tokenChainSyncMode = getTokenChainSyncMode();
          const realTimeTokenQueue = new PQueue({
            concurrency: 15,
          });
          let usedChainListSucceededAddressCount = 0;
          let requestedChainCount = 0;
          trace.mark('remote-address-requests-dispatched', {
            addressCount: lowerAddresses.length,
            addressConcurrency: ASSET_REMOTE_ADDRESS_CONCURRENCY,
            chainConcurrency: 15,
          });
          const nativeProjectionBatch =
            tokenChainSyncMode === 'native'
              ? nativeTokenCommitBatcher.beginBatch()
              : undefined;
          let remoteAddressResults: PromiseSettledResult<void>[];
          try {
            remoteAddressResults = await mapSettledWithConcurrency(
              lowerAddresses,
              ASSET_REMOTE_ADDRESS_CONCURRENCY,
              async address => {
                const chains = await openapi.usedChainList(address);
                const chainIdList = chains.map(item => item.id);
                usedChainListSucceededAddressCount += 1;
                requestedChainCount += chainIdList.length;
                const syncExecution = await executeTokenChainSync({
                  mode: tokenChainSyncMode,
                  address,
                  chainIds: chainIdList,
                  replacementScope: 'address',
                  replaceExisting: true,
                  executeJs: () =>
                    Promise.allSettled(
                      chainIdList.map(async serverId => {
                        const tokens =
                          (await realTimeTokenQueue.add(async () => {
                            const chainTokensRes =
                              await requestOpenApiWithChainId(
                                ({ openapi }) =>
                                  openapi.listToken(address, serverId, true),
                                {
                                  isTestnet: false,
                                },
                              );
                            return filterInterfaceTokenList(
                              chainTokensRes.map(item =>
                                tokenItemToITokenItem(item, address),
                              ),
                            );
                          })) || [];
                        return { serverId, tokens };
                      }),
                    ),
                });

                if (syncExecution.mode === 'native') {
                  nativeCommittedAddresses.add(address);
                  if (syncExecution.result.outcome === 'complete') {
                    nativeCompleteAddresses.add(address);
                  }
                  return;
                }

                const res = syncExecution.value;

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
                  : fulfilledChainSnapshots.flatMap(
                      snapshot => snapshot.tokens,
                    );

                realTimeTokenMap[address] = nextTokens;
                if (!hasFailedChain) {
                  completeRealTimeTokenMap[address] = nextTokens;
                }
              },
              { stopOnError: isHttpRateLimitedError },
            );
          } finally {
            await nativeProjectionBatch?.finish();
          }
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
            syncMode: tokenChainSyncMode,
            nativePartialAddressCount:
              nativeCommittedAddresses.size - nativeCompleteAddresses.size,
          });

          const nativeApplicableAddresses = getCurrentAddresses().filter(
            address => nativeCommittedAddresses.has(address),
          );
          if (nativeApplicableAddresses.length) {
            trace.mark('native-snapshots-published', {
              addressCount: nativeApplicableAddresses.length,
              completeAddressCount: nativeApplicableAddresses.filter(address =>
                nativeCompleteAddresses.has(address),
              ).length,
              itemCount: nativeApplicableAddresses.reduce(
                (count, address) =>
                  count + (get().tokenListMap[address]?.length || 0),
                0,
              ),
            });
            nativeApplicableAddresses.forEach(address => {
              if (nativeCompleteAddresses.has(address)) {
                completedAddresses.add(address);
              }
            });
          }

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
            trace.finish({
              path: nativeApplicableAddresses.length
                ? 'native-remote'
                : 'stale-after-remote',
            });
            return {
              status: lowerAddresses.every(address =>
                completedAddresses.has(address),
              )
                ? 'complete'
                : 'partial',
              source: nativeApplicableAddresses.length ? 'native' : undefined,
            };
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
          completeApplicableAddresses.forEach(address =>
            completedAddresses.add(address),
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
          return {
            status: lowerAddresses.every(address =>
              completedAddresses.has(address),
            )
              ? 'complete'
              : 'partial',
            source: 'remote',
          };
        } catch (error) {
          trace.fail({ phase: 'load' });
          throw error;
        } finally {
          if (isCurrentRequest() && get().isLoading) {
            set(() => ({ isLoading: false }));
          }
        }
      },
    });
  },

  async getTokenList(
    address: string,
    force = false,
    chainServerId?: string,
    trigger: AssetSyncTrigger = 'on-demand',
  ) {
    const normalizedAddress = address.toLowerCase();
    await runTokenAssetSync({
      addresses: [normalizedAddress],
      // A cache-only read must not wait behind (or cancel) an active manual
      // refresh. Requests with the same strength still share one flight.
      variant: `single-address:${chainServerId || 'all'}:${
        force ? 'force' : 'standard'
      }`,
      force,
      trigger,
      execute: async ticket => {
        const addressRequest = tokenAddressRequests.reserve([
          normalizedAddress,
        ]);
        const isCurrentRequest = () =>
          tokenAddressRequests.isCurrent(addressRequest, normalizedAddress);
        const isForceRequested = () => ticket.isForceRequested();
        const trace = beginAssetDataLoadDiagnostic(
          'single-address-token',
          normalizedAddress,
          {
            force,
            trigger: ticket.getTrigger(),
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
          hasCurrentAddressTokens &&
          (isForceRequested() || !isExpired || !!targetChainServerId);

        /**
         * 阶段一： 校验有效期，有效期内直接用本地数据
         */
        if (!isForceRequested() && !isExpired) {
          try {
            if (!hasCurrentAddressSnapshot) {
              await tokenCacheHydrator.hydrate([normalizedAddress]);
            }
            set(state => ({
              sourceSnapshotReadyByAddress: markAssetSourceSnapshotsReady(
                state.sourceSnapshotReadyByAddress,
                [normalizedAddress],
              ),
            }));
            const itemCount =
              get().tokenListMap[normalizedAddress]?.length || 0;
            trace.mark('local-db-loaded', { itemCount });
            trace.mark('local-store-published', { itemCount });
            trace.finish({ path: 'local-db' });
            return { status: 'complete', source: 'database' };
          } catch (error) {
            trace.fail({ phase: 'local-db' });
            throw error;
          }
        }

        if (!tokenAddressRequests.activate(addressRequest).length) {
          trace.finish({ path: 'stale-before-remote' });
          return { status: 'superseded' };
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
            !isForceRequested() && isExpired && !hasCurrentAddressSnapshot;
          const cacheListPromise = isRefreshingWithValidLocalTokens
            ? null
            : queryTokensCache(address);

          if (shouldHydrateStaleLocalTokens) {
            try {
              await tokenCacheHydrator.hydrate([normalizedAddress]);
              if (!isCurrentRequest()) {
                trace.finish({ path: 'stale-after-hydrate' });
                return { status: 'superseded' };
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
              return { status: 'superseded' };
            }
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
              if (!isCurrentRequest()) {
                trace.finish({ path: 'stale-after-non-core-cache' });
                return { status: 'superseded' };
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
            return { status: 'superseded' };
          }
          trace.mark('remote-chains-resolved', {
            chainCount: chainIdList.length,
          });
          const tokenChainSyncMode = getTokenChainSyncMode();
          const realTimeTokenQueue = new PQueue({
            concurrency: 15,
          });
          const syncExecution = await executeTokenChainSync({
            mode: tokenChainSyncMode,
            address: normalizedAddress,
            chainIds: chainIdList,
            replacementScope: targetChainServerId ? 'chains' : 'address',
            replaceExisting: true,
            executeJs: async () => {
              const res = await Promise.allSettled(
                chainIdList.map(
                  async serverId =>
                    await realTimeTokenQueue.add(async () => {
                      const chainTokensRes = await requestOpenApiWithChainId(
                        ({ openapi }) =>
                          openapi.listToken(address, serverId, true),
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
              const failed = res.find(result => result.status === 'rejected');
              if (failed?.status === 'rejected') {
                console.error('ServiceErrorType.Token', failed.reason);
                return null;
              }
              return res
                .map(result =>
                  result.status === 'fulfilled' ? result.value : [],
                )
                .flat() as ITokenItem[];
            },
          });

          if (syncExecution.mode === 'native') {
            if (!isCurrentRequest()) {
              trace.finish({ path: 'stale-after-native-remote' });
              return { status: 'superseded' };
            }
            const itemCount =
              get().tokenListMap[normalizedAddress]?.length || 0;
            trace.mark('native-snapshot-published', {
              itemCount,
              committedRowCount: syncExecution.result.committedRowCount,
              outcome: syncExecution.result.outcome,
              failedChainCount: syncExecution.result.failedChainIds.length,
            });
            trace.finish({ path: 'native-remote', itemCount });
            return syncExecution.result.outcome === 'complete'
              ? { status: 'complete', source: 'native' }
              : { status: 'partial', source: 'native' };
          }

          const results = syncExecution.value;
          if (!results) {
            trace.fail({ phase: 'remote-chain' });
            return { status: 'partial' };
          }
          trace.mark('remote-token-responses', { itemCount: results.length });
          if (!isCurrentRequest()) {
            trace.finish({ path: 'stale-after-remote' });
            return { status: 'superseded' };
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
          return { status: 'complete', source: 'remote' };
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
    });
  },
}));

type NativeTokenProjectionTarget =
  | {
      key: string;
      scene: 'single-address';
      config: SingleTokenAssetsIndexConfig;
    }
  | {
      key: string;
      scene: 'multi-address';
      config: MultiTokenAssetsIndexConfig;
    };

type CompiledNativeTokenProjectionTarget = NativeTokenProjectionTarget & {
  projection: TokenAssetSqlProjection;
};

const selectCanonicalTokenEntities = (entities: TokenItemEntity[]) => {
  const entityByResourceId = new Map<TokenEntityId, TokenItemEntity>();
  entities.forEach(entity => {
    const resourceId = buildTokenEntityId(entity);
    const current = entityByResourceId.get(resourceId);
    if (
      !current ||
      entity._local_updated_at > current._local_updated_at ||
      (entity._local_updated_at === current._local_updated_at &&
        entity._db_id < current._db_id)
    ) {
      entityByResourceId.set(resourceId, entity);
    }
  });
  return Array.from(entityByResourceId.values());
};

const getNativeTokenProjectionTargets = (
  addresses: string[],
): NativeTokenProjectionTarget[] => {
  const state = useTokenAssetsIndexStore.getState();
  const targets: NativeTokenProjectionTarget[] = [];
  getTokenAssetReadModelTargets(addresses).forEach(({ key, scene }) => {
    if (scene === 'single-address') {
      const config = state.singleAssetsConfigByKey[key];
      if (config) {
        targets.push({ key, scene, config });
      }
      return;
    }
    const config = state.multiAssetsConfigByKey[key];
    if (config) {
      targets.push({ key, scene, config });
    }
  });
  return targets;
};

const getNativeTokenProjectionSelectorKey = (
  target: NativeTokenProjectionTarget,
) => {
  const addresses =
    target.scene === 'single-address'
      ? [target.config.address]
      : target.config.addresses;
  return JSON.stringify([
    target.scene,
    addresses.map(normalizeAddress),
    target.config.chainServerId || '',
    target.scene === 'multi-address'
      ? target.config.tokenDisplayMode || 'byAddress'
      : 'byAddress',
  ]);
};

const compileNativeTokenProjectionTargets = async (
  targets: NativeTokenProjectionTarget[],
) => {
  const projectionBySelector = new Map<string, TokenAssetSqlProjection>();
  const compiledTargets: CompiledNativeTokenProjectionTarget[] = [];

  for (const target of targets) {
    const selectorKey = getNativeTokenProjectionSelectorKey(target);
    let projection = projectionBySelector.get(selectorKey);
    if (!projection) {
      projection = await compileTokenAssetSqlProjection({
        addresses:
          target.scene === 'single-address'
            ? [target.config.address]
            : target.config.addresses,
        chainServerId: target.config.chainServerId,
        scene: target.scene,
        tokenDisplayMode:
          target.scene === 'multi-address'
            ? target.config.tokenDisplayMode
            : 'byAddress',
      });
      projectionBySelector.set(selectorKey, projection);
    }
    compiledTargets.push({ ...target, projection });
  }

  return compiledTargets;
};

const getLatestNativeTokenCompletion = (
  completions: NativeAssetSyncCompletion[],
) =>
  completions.reduce((latest, completion) =>
    completion.committedAt >= latest.committedAt ? completion : latest,
  );

const getNativeTokenCompletionForTarget = (
  target: NativeTokenProjectionTarget,
  completions: NativeAssetSyncCompletion[],
) => {
  const targetAddresses = new Set(
    (target.scene === 'single-address'
      ? [target.config.address]
      : target.config.addresses
    ).map(normalizeAddress),
  );
  const targetCompletions = completions.filter(completion =>
    targetAddresses.has(normalizeAddress(completion.address)),
  );
  return getLatestNativeTokenCompletion(
    targetCompletions.length ? targetCompletions : completions,
  );
};

const publishCompiledNativeTokenProjections = ({
  completions,
  compiledTargets,
  projectionTokens,
}: {
  completions: NativeAssetSyncCompletion[];
  compiledTargets: CompiledNativeTokenProjectionTarget[];
  projectionTokens: ITokenItem[];
}) => {
  const publications: Array<{
    target: NativeTokenProjectionTarget;
    config: SingleTokenAssetsIndexConfig | MultiTokenAssetsIndexConfig;
    result: TokenAssetsIndexResult;
  }> = [];
  const completedAddresses = completions
    .filter(completion => completion.replacementScope === 'address')
    .map(completion => normalizeAddress(completion.address));

  withAutomaticTokenProjectionSyncSuppressed(() => {
    tokenEntityResourceStore.upsertTokens(projectionTokens, 'hydrate');
    tokenListStore.setState(state => ({
      sourceSnapshotReadyByAddress: completedAddresses.length
        ? markAssetSourceSnapshotsReady(
            state.sourceSnapshotReadyByAddress,
            completedAddresses,
          )
        : state.sourceSnapshotReadyByAddress,
    }));

    const projectionState = useTokenAssetsIndexStore.getState();
    compiledTargets.forEach(target => {
      const currentConfig =
        target.scene === 'single-address'
          ? projectionState.singleAssetsConfigByKey[target.key]
          : projectionState.multiAssetsConfigByKey[target.key];
      if (currentConfig !== target.config) {
        throw new Error(
          `Token SQL projection config changed before publish: ${target.key}`,
        );
      }

      const projectedTokenIds = target.projection
        .resourceIds as TokenEntityId[];
      const tokenIds =
        target.config.tokenIds.length === projectedTokenIds.length &&
        target.config.tokenIds.every(
          (tokenId, index) => tokenId === projectedTokenIds[index],
        )
          ? target.config.tokenIds
          : projectedTokenIds;
      const nextConfig =
        target.scene === 'single-address'
          ? { ...target.config, tokenIds }
          : {
              ...target.config,
              tokenIds,
              sourceVersionKey: getMultiTokenAssetsSourceVersionKey(
                useTokenIndexStore.getState(),
                target.config.addresses,
              ),
            };
      const previousResult =
        target.scene === 'single-address'
          ? projectionState.singleAssetsResultByKey[target.key]
          : projectionState.multiAssetsResultByKey[target.key];
      const result = buildTokenAssetsIndexResultFromSqlProjection({
        projection: target.projection,
        isLpTokenEnabled: target.config.isLpTokenEnabled,
        listKey:
          target.scene === 'multi-address' ? target.config.key : undefined,
        previousResult,
      });
      publications.push({ target, config: nextConfig, result });
    });

    useTokenAssetsIndexStore.setState(draft => {
      publications.forEach(({ target, config, result }) => {
        const availability = getTokenAssetsProjectionAvailability(
          config,
          result,
        );
        if (target.scene === 'single-address') {
          draft.singleAssetsConfigByKey[target.key] =
            config as SingleTokenAssetsIndexConfig;
          draft.singleAssetsResultByKey[target.key] = result;
          draft.singleAssetsAvailabilityByKey[target.key] = availability;
        } else {
          draft.multiAssetsConfigByKey[target.key] =
            config as MultiTokenAssetsIndexConfig;
          draft.multiAssetsResultByKey[target.key] = result;
          draft.multiAssetsAvailabilityByKey[target.key] = availability;
        }
      });
    });
  });

  publications.forEach(({ target, config, result }) => {
    const completion = getNativeTokenCompletionForTarget(target, completions);
    syncTokenAssetReadModel({
      key: target.key,
      scene: target.scene,
      config,
      result,
      source: 'native',
      generation: completion.generation,
      committedAt: completion.committedAt,
      committedRequestId: completion.requestId,
    });
    scheduleTokenAssetsProjectionPersistence(
      target.key,
      target.scene,
      result,
      target.scene === 'multi-address'
        ? target.config.tokenDisplayMode
        : undefined,
    );
  });
};

const scheduleNativeTokenLegacyHydration = (addresses: string[]) => {
  (async () => {
    await yieldTokenProjectionEntityRestore();
    await tokenCacheHydrator.refresh(addresses);
  })().catch(error => {
    console.warn('[tokenProjection] deferred legacy hydration failed', error);
  });
};

const applyNativeTokenCommitWithJsProjection = async (
  completions: NativeAssetSyncCompletion[],
) => {
  const normalizedAddresses = Array.from(
    new Set(
      completions.map(completion => normalizeAddress(completion.address)),
    ),
  );
  await tokenCacheHydrator.refresh(normalizedAddresses);
  const completedAddresses = completions
    .filter(completion => completion.replacementScope === 'address')
    .map(completion => normalizeAddress(completion.address));
  if (completedAddresses.length) {
    tokenListStore.setState(state => ({
      sourceSnapshotReadyByAddress: markAssetSourceSnapshotsReady(
        state.sourceSnapshotReadyByAddress,
        completedAddresses,
      ),
    }));
  }
  useTokenAssetsIndexStore
    .getState()
    .syncSingleAssetsResultsForAddresses(normalizedAddresses);
  useTokenAssetsIndexStore
    .getState()
    .syncMultiAssetsResultsForAddresses(normalizedAddresses);

  const projectionState = useTokenAssetsIndexStore.getState();
  getTokenAssetReadModelTargets(normalizedAddresses).forEach(
    ({ key, scene }) => {
      const config =
        scene === 'single-address'
          ? projectionState.singleAssetsConfigByKey[key]
          : projectionState.multiAssetsConfigByKey[key];
      const result =
        scene === 'single-address'
          ? projectionState.singleAssetsResultByKey[key]
          : projectionState.multiAssetsResultByKey[key];
      if (!config || !result) {
        return;
      }
      const completion = getNativeTokenCompletionForTarget(
        { key, scene, config } as NativeTokenProjectionTarget,
        completions,
      );
      syncTokenAssetReadModel({
        key,
        scene,
        config,
        result,
        source: 'native',
        generation: completion.generation,
        committedAt: completion.committedAt,
        committedRequestId: completion.requestId,
      });
    },
  );
};

const publishNativeTokenBatch = async (
  completions: NativeAssetSyncCompletion[],
) => {
  const normalizedAddresses = Array.from(
    new Set(
      completions.map(completion => normalizeAddress(completion.address)),
    ),
  );
  const targets = getNativeTokenProjectionTargets(normalizedAddresses);
  if (!targets.length) {
    await applyNativeTokenCommitWithJsProjection(completions);
    return;
  }

  const latestCompletion = getLatestNativeTokenCompletion(completions);
  const trace = beginAssetDataLoadDiagnostic(
    'token-native-sql-projection',
    latestCompletion.requestId,
    { addressCount: normalizedAddresses.length, targetCount: targets.length },
  );
  try {
    const compiledTargets = await compileNativeTokenProjectionTargets(targets);
    trace.mark('projection-compiled', {
      projectionCount: new Set(
        compiledTargets.map(getNativeTokenProjectionSelectorKey),
      ).size,
      rowCount: compiledTargets.reduce(
        (count, target) => count + target.projection.rows.length,
        0,
      ),
    });

    tokenCacheHydrator.invalidate(normalizedAddresses);
    const requiredResourceIds = Array.from(
      new Set(compiledTargets.flatMap(target => target.projection.resourceIds)),
    );
    const projectionEntities = requiredResourceIds.length
      ? await TokenItemEntity.batchMultiAddressTokensByResourceIds(
          requiredResourceIds,
        )
      : [];
    const projectionTokensById = new Map(
      selectCanonicalTokenEntities(projectionEntities as TokenItemEntity[]).map(
        entity => {
          const token = tokenItemEntityToTokenItem(entity);
          return [buildTokenEntityId(token), token] as const;
        },
      ),
    );
    const projectionTokens = requiredResourceIds
      .map(resourceId => projectionTokensById.get(resourceId as TokenEntityId))
      .filter((token): token is ITokenItem => !!token);
    if (projectionTokens.length !== requiredResourceIds.length) {
      throw new Error(
        `Token SQL projection entities are incomplete: ${projectionTokens.length}/${requiredResourceIds.length}`,
      );
    }

    publishCompiledNativeTokenProjections({
      completions,
      compiledTargets,
      projectionTokens,
    });
    scheduleNativeTokenLegacyHydration(normalizedAddresses);
    trace.finish({
      path: 'sql-projection',
      itemCount: projectionTokens.length,
      deferredLegacyHydration: true,
    });
  } catch (error) {
    trace.fail({ path: 'js-fallback' });
    console.warn(
      '[tokenProjection] native SQL projection failed; using JS fallback',
      error,
    );
    await applyNativeTokenCommitWithJsProjection(completions);
  }
};

const pendingNativeTokenCompletions = new Map<
  string,
  NativeAssetSyncCompletion
>();

const nativeTokenCommitBatcher = createAddressListCommitBatcher({
  apply: async addresses => {
    const completions = addresses
      .map(address => pendingNativeTokenCompletions.get(address))
      .filter(
        (completion): completion is NativeAssetSyncCompletion => !!completion,
      );
    if (!completions.length) {
      return;
    }
    try {
      await publishNativeTokenBatch(completions);
    } finally {
      completions.forEach(completion => {
        const address = normalizeAddress(completion.address);
        if (pendingNativeTokenCompletions.get(address) === completion) {
          pendingNativeTokenCompletions.delete(address);
        }
      });
    }
  },
});

const applyNativeTokenCommit = (completion: NativeAssetSyncCompletion) => {
  const normalizedAddress = normalizeAddress(completion.address);
  pendingNativeTokenCompletions.set(normalizedAddress, completion);
  return nativeTokenCommitBatcher.enqueue([normalizedAddress]);
};

registerNativeAssetSyncHandler('token', applyNativeTokenCommit);

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
    if (isAutomaticTokenProjectionSyncSuppressed()) {
      return;
    }
    syncKnownTokenProjectionsForAddresses(projectionChangedAddresses);
    return;
  }
  if (isAutomaticTokenProjectionSyncSuppressed()) {
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
  if (isAutomaticTokenProjectionSyncSuppressed()) {
    return;
  }
  useTokenAssetsIndexStore
    .getState()
    .syncChangedTokenAssetsResults(changedTokenIds);
});

export async function hydrateCommittedNativeTokenSnapshot(address: string) {
  const normalizedAddress = normalizeAddress(address);
  await tokenCacheHydrator.refresh([normalizedAddress]);
  tokenListStore.setState(state => ({
    sourceSnapshotReadyByAddress: markAssetSourceSnapshotsReady(
      state.sourceSnapshotReadyByAddress,
      [normalizedAddress],
    ),
  }));
  return tokenListStore.getState().tokenListMap[normalizedAddress]?.length || 0;
}

export default tokenListStore;
