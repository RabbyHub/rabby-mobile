import type { ITokenItem } from '@/types/assets';

jest.mock('@/core/apis/account', () => ({
  getTop10MyAccounts: jest.fn(() => []),
}));
jest.mock('@/core/apis/tokenCache', () => ({
  queryTokensCache: jest.fn(async () => []),
}));
jest.mock('@/core/request', () => ({
  openapi: {
    usedChainList: jest.fn(async () => [{ id: 'eth' }]),
  },
}));
jest.mock('@/store/balance', () => ({
  getSelectedBalanceAddressesSnapshot: jest.fn(() => []),
}));
jest.mock('@/databases/entities/tokenitem', () => ({
  TokenItemEntity: {
    batchMultiAddressTokens: jest.fn(async () => []),
    batchMultiAddressTokensByResourceIds: jest.fn(async () => []),
    batchQueryNoCoreTokens: jest.fn(async () => []),
    isExpired: jest.fn(async () => true),
  },
}));
jest.mock('@/databases/sync/assets', () => ({
  syncRemoteTokens: jest.fn(async () => true),
  syncRemoteTokensForAddresses: jest.fn(async () => true),
}));
jest.mock('./assetProjectionPersistence', () => ({
  isAssetProjectionPersistenceActive: jest.fn(() => false),
  restoreAssetProjection: jest.fn(async () => null),
  scheduleAssetProjectionPersistence: jest.fn(),
  subscribeAssetProjectionDatabaseCommits: jest.fn(),
}));
jest.mock('@/utils/openapi', () => ({
  requestOpenApiWithChainId: jest.fn(),
}));
jest.mock('@/utils/token', () => ({
  getTokenSymbol: (token: ITokenItem) => token.symbol,
  tokenItemEntityToTokenItem: (token: ITokenItem) => token,
  tokenItemToITokenItem: (token: ITokenItem) => token,
}));
jest.mock('@/utils/events', () => ({
  EVENT_PATCH_SINGLE_TOKEN: 'EVENT_PATCH_SINGLE_TOKEN',
  eventBus: {
    on: jest.fn(),
  },
}));
jest.mock('react-native-haptic-feedback', () => ({
  trigger: jest.fn(),
}));

import {
  buildMultiAssetsIndexFromTokenIds,
  buildSingleAssetsEligibleTokenIdsFromTokenIds,
  buildSingleAssetsIndexFromTokenIds,
  buildTokenEntityId,
  getMultiAssetsCacheKey,
  getSingleAssetsCacheKey,
  prepareMultiAddressTokenAssetsProjection,
  prepareSingleAddressTokenAssetsProjection,
  tokenEntityResourceStore,
  tokenGroupResourceStore,
  useTokenAssetsIndexStore,
  useTokenIndexStore,
} from './tokens';
import tokenListStore from './tokens';
import { queryTokensCache } from '@/core/apis/tokenCache';
import { openapi } from '@/core/request';
import { requestOpenApiWithChainId } from '@/utils/openapi';
import {
  syncRemoteTokens,
  syncRemoteTokensForAddresses,
} from '@/databases/sync/assets';
import { TokenItemEntity } from '@/databases/entities/tokenitem';
import {
  restoreAssetProjection,
  scheduleAssetProjectionPersistence,
} from './assetProjectionPersistence';
import { notifySyncAbortHandlers } from '@/databases/sync/abort';

const ADDRESS = '0xAbCd';
const NORMALIZED_ADDRESS = ADDRESS.toLowerCase();
const SECOND_ADDRESS = '0xDeF0';
const NORMALIZED_SECOND_ADDRESS = SECOND_ADDRESS.toLowerCase();
const mockedRequestOpenApiWithChainId = jest.mocked(requestOpenApiWithChainId);
const mockedQueryTokensCache = jest.mocked(queryTokensCache);
const mockedUsedChainList = jest.mocked(openapi.usedChainList);
const mockedSyncRemoteTokens = jest.mocked(syncRemoteTokens);
const mockedSyncRemoteTokensForAddresses = jest.mocked(
  syncRemoteTokensForAddresses,
);
const mockedTokenItemEntity = jest.mocked(TokenItemEntity);
const mockedScheduleAssetProjectionPersistence = jest.mocked(
  scheduleAssetProjectionPersistence,
);
const mockedRestoreAssetProjection = jest.mocked(restoreAssetProjection);

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

const waitFor = async (predicate: () => boolean) => {
  for (let index = 0; index < 20; index += 1) {
    if (predicate()) {
      return;
    }
    await Promise.resolve();
  }
  throw new Error('condition was not reached');
};

const waitForNextTask = () =>
  new Promise<void>(resolve => {
    setTimeout(resolve, 0);
  });

const createToken = (
  id: string,
  overrides: Partial<ITokenItem> = {},
): ITokenItem => ({
  amount: 1,
  cex_ids: [],
  chain: 'eth',
  decimals: 18,
  display_symbol: null,
  id,
  is_core: true,
  is_verified: true,
  is_wallet: true,
  logo_url: '',
  name: id,
  optimized_symbol: id,
  owner_addr: NORMALIZED_ADDRESS,
  price: 1,
  symbol: id,
  time_at: 0,
  usd_value: 1,
  ...overrides,
});

const createHttpError = (status: number) =>
  Object.assign(new Error(`HTTP ${status}`), {
    response: {
      status,
    },
  });

const replaceAddressTokens = (tokens: ITokenItem[]) => {
  tokenEntityResourceStore.upsertTokens(tokens, 'remote', {
    pruneMissingAddresses: new Set([NORMALIZED_ADDRESS]),
  });
  useTokenIndexStore.getState().syncAddressTokens(NORMALIZED_ADDRESS, tokens);
};

describe('single-address token assets projection', () => {
  beforeEach(() => {
    notifySyncAbortHandlers('token-assets-projection-test-reset');
    jest.clearAllMocks();
    mockedSyncRemoteTokens.mockResolvedValue(true);
    mockedSyncRemoteTokensForAddresses.mockResolvedValue(true);
    mockedUsedChainList.mockResolvedValue([{ id: 'eth' }] as never);
    useTokenAssetsIndexStore.setState({
      singleAssetsConfigByKey: {},
      singleAssetsResultByKey: {},
      singleAssetsAvailabilityByKey: {},
      multiAssetsConfigByKey: {},
      multiAssetsResultByKey: {},
      multiAssetsAvailabilityByKey: {},
    });
    tokenEntityResourceStore.upsertTokens([], 'remote', {
      pruneMissing: true,
    });
    useTokenIndexStore.setState({
      addressTokenIds: {},
      addressVersions: {},
      tokenStaticMap: {},
    });
    tokenListStore.setState({
      tokenListMap: {},
      sourceSnapshotReadyByAddress: {},
      isLoading: false,
      isLoadingByAddress: {},
    });
  });

  it('publishes one index update for a multi-address token batch', () => {
    const first = createToken('first', {
      owner_addr: NORMALIZED_ADDRESS,
      usd_value: 2,
    });
    const second = createToken('second', {
      owner_addr: NORMALIZED_SECOND_ADDRESS,
      usd_value: 3,
    });
    const listener = jest.fn();
    const unsubscribe = useTokenIndexStore.subscribe(listener);

    try {
      useTokenIndexStore.getState().syncFromTokenListMap(
        {
          [NORMALIZED_ADDRESS]: [first],
          [NORMALIZED_SECOND_ADDRESS]: [second],
        },
        [NORMALIZED_ADDRESS, NORMALIZED_SECOND_ADDRESS],
      );

      expect(listener).toHaveBeenCalledTimes(1);
      expect(useTokenIndexStore.getState().addressTokenIds).toEqual({
        [NORMALIZED_ADDRESS]: [buildTokenEntityId(first)],
        [NORMALIZED_SECOND_ADDRESS]: [buildTokenEntityId(second)],
      });
      expect(useTokenIndexStore.getState().addressVersions).toEqual({
        [NORMALIZED_ADDRESS]: 1,
        [NORMALIZED_SECOND_ADDRESS]: 1,
      });
    } finally {
      unsubscribe();
    }
  });

  it('keeps the token index current without mounting a token consumer', () => {
    const token = createToken('runtime-token', { usd_value: 7 });

    tokenListStore.setState({
      tokenListMap: { [NORMALIZED_ADDRESS]: [token] },
    });

    expect(useTokenIndexStore.getState().addressTokenIds).toEqual({
      [NORMALIZED_ADDRESS]: [buildTokenEntityId(token)],
    });
    expect(
      useTokenIndexStore.getState().tokenStaticMap[buildTokenEntityId(token)],
    ).toEqual(
      expect.objectContaining({
        ownerAddr: NORMALIZED_ADDRESS,
        symbol: 'runtime-token',
      }),
    );
  });

  it('prepares the first projection from an existing token snapshot', () => {
    const eth = createToken('eth-token', { usd_value: 20 });
    replaceAddressTokens([eth]);

    const key = prepareSingleAddressTokenAssetsProjection({
      address: ADDRESS,
    });
    const state = useTokenAssetsIndexStore.getState();

    expect(key).toBe(getSingleAssetsCacheKey(NORMALIZED_ADDRESS));
    expect(state.singleAssetsConfigByKey[key]?.address).toBe(
      NORMALIZED_ADDRESS,
    );
    expect(state.singleAssetsResultByKey[key]?.tokenIds).toEqual([
      buildTokenEntityId(eth),
    ]);
    expect(state.singleAssetsAvailabilityByKey[key]).toBe('ready');
  });

  it('marks an explicit empty token snapshot as a ready empty projection', () => {
    replaceAddressTokens([]);
    const key = prepareSingleAddressTokenAssetsProjection({ address: ADDRESS });

    expect(
      useTokenAssetsIndexStore.getState().singleAssetsAvailabilityByKey[key],
    ).not.toBe('ready');
    expect(mockedScheduleAssetProjectionPersistence).not.toHaveBeenCalled();

    tokenListStore.setState({
      tokenListMap: { [NORMALIZED_ADDRESS]: [] },
      sourceSnapshotReadyByAddress: { [NORMALIZED_ADDRESS]: true },
    });

    expect(
      useTokenAssetsIndexStore.getState().singleAssetsResultByKey[key]?.rows,
    ).toEqual([]);
    expect(
      useTokenAssetsIndexStore.getState().singleAssetsAvailabilityByKey[key],
    ).toBe('ready');
    expect(mockedScheduleAssetProjectionPersistence).toHaveBeenCalledWith(
      expect.objectContaining({
        runtimeKey: key,
        rows: [],
        scene: 'single-address',
      }),
    );
  });

  it('restores a persisted projection through exact resource lookup only', async () => {
    const restored = createToken('restored', { usd_value: 20 });
    const tokenId = buildTokenEntityId(restored);
    mockedRestoreAssetProjection.mockResolvedValueOnce({
      rows: [{ type: 'token', id: tokenId }],
      groups: [],
      metadata: {
        additionalCoreUsdValue: 0,
        additionalTokenCount: 0,
        defaultVisibleTokenCount: 1,
        hasAdditionalTokens: false,
        hasLpTokens: false,
        lowValueTokenCount: 0,
        segmentRowCounts: {
          additionalDefault: 0,
          additionalLp: 0,
          lowValueDefault: 0,
          lowValueLp: 0,
          primary: 1,
        },
        selectedSegmentMode: 'default',
      },
    } as never);
    mockedTokenItemEntity.batchMultiAddressTokensByResourceIds.mockResolvedValueOnce(
      [restored] as never,
    );

    const key = prepareSingleAddressTokenAssetsProjection({ address: ADDRESS });

    await waitFor(
      () =>
        mockedTokenItemEntity.batchMultiAddressTokensByResourceIds.mock.calls
          .length > 0,
    );
    await waitFor(
      () =>
        useTokenAssetsIndexStore.getState().singleAssetsResultByKey[key]?.rows
          .length === 1,
    );

    expect(
      mockedTokenItemEntity.batchMultiAddressTokensByResourceIds,
    ).toHaveBeenCalledWith([tokenId]);
    expect(
      mockedTokenItemEntity.batchMultiAddressTokens,
    ).not.toHaveBeenCalled();
  });

  it('publishes a staged projection before deferred token entities finish restoring', async () => {
    const visibleToken = createToken('visible-token', { usd_value: 20 });
    const deferredToken = createToken('deferred-token', { usd_value: 10 });
    const visibleTokenId = buildTokenEntityId(visibleToken);
    const deferredTokenId = buildTokenEntityId(deferredToken);
    const deferredEntityRestore = deferred<ITokenItem[]>();

    mockedRestoreAssetProjection.mockResolvedValueOnce({
      rows: [
        { type: 'token', id: visibleTokenId },
        { type: 'token', id: deferredTokenId },
      ],
      groups: [],
      metadata: {
        entityRestoreMode: 'staged-v1',
        groupPrimaryTokenIds: {},
        lowValueTokenPreviewLogoUrls: [],
        lpLowValueTokenPreviewLogoUrls: [],
        additionalCoreUsdValue: 0,
        additionalTokenCount: 1,
        defaultVisibleTokenCount: 1,
        hasAdditionalTokens: true,
        hasLpTokens: false,
        lowValueTokenCount: 0,
        segmentRowCounts: {
          additionalDefault: 1,
          additionalLp: 0,
          lowValueDefault: 0,
          lowValueLp: 0,
          primary: 1,
        },
        selectedSegmentMode: 'default',
      },
    } as never);
    mockedTokenItemEntity.batchMultiAddressTokensByResourceIds
      .mockResolvedValueOnce([visibleToken] as never)
      .mockImplementationOnce(() => deferredEntityRestore.promise as never);

    const key = prepareSingleAddressTokenAssetsProjection({ address: ADDRESS });

    await waitFor(
      () =>
        useTokenAssetsIndexStore.getState().singleAssetsAvailabilityByKey[
          key
        ] === 'ready',
    );

    expect(
      mockedTokenItemEntity.batchMultiAddressTokensByResourceIds.mock.calls[0],
    ).toEqual([[visibleTokenId]]);
    expect(
      useTokenAssetsIndexStore.getState().singleAssetsResultByKey[key]?.rows,
    ).toEqual([
      { type: 'token', tokenId: visibleTokenId },
      { type: 'token', tokenId: deferredTokenId },
    ]);
    expect(tokenEntityResourceStore.getValue(visibleTokenId)).toEqual(
      visibleToken,
    );
    expect(tokenEntityResourceStore.getValue(deferredTokenId)).toBeUndefined();

    await waitForNextTask();
    await waitFor(
      () =>
        mockedTokenItemEntity.batchMultiAddressTokensByResourceIds.mock.calls
          .length === 2,
    );
    expect(
      mockedTokenItemEntity.batchMultiAddressTokensByResourceIds.mock.calls[1],
    ).toEqual([[deferredTokenId]]);

    deferredEntityRestore.resolve([deferredToken]);
    await waitFor(
      () =>
        tokenEntityResourceStore.getValue(deferredTokenId) === deferredToken,
    );
    await waitForNextTask();
  });

  it('restores every member of an eager staged token group', async () => {
    const first = createToken('shared', {
      owner_addr: NORMALIZED_ADDRESS,
      amount: 2,
      usd_value: 20,
    });
    const second = createToken('shared', {
      owner_addr: NORMALIZED_SECOND_ADDRESS,
      amount: 3,
      usd_value: 30,
    });
    const firstId = buildTokenEntityId(first);
    const secondId = buildTokenEntityId(second);
    const key = getMultiAssetsCacheKey(
      [ADDRESS, SECOND_ADDRESS],
      undefined,
      false,
      'byAsset',
    );
    const groupId = `${key}::eth::shared`;

    mockedRestoreAssetProjection.mockResolvedValueOnce({
      rows: [{ type: 'token-group', id: groupId }],
      groups: [{ id: groupId, memberIds: [firstId, secondId] }],
      metadata: {
        entityRestoreMode: 'staged-v1',
        groupPrimaryTokenIds: { [groupId]: secondId },
        lowValueTokenPreviewLogoUrls: [],
        lpLowValueTokenPreviewLogoUrls: [],
        additionalCoreUsdValue: 0,
        additionalTokenCount: 0,
        defaultVisibleTokenCount: 1,
        hasAdditionalTokens: false,
        hasLpTokens: false,
        lowValueTokenCount: 0,
        segmentRowCounts: {
          additionalDefault: 0,
          additionalLp: 0,
          lowValueDefault: 0,
          lowValueLp: 0,
          primary: 1,
        },
        selectedSegmentMode: 'default',
      },
    } as never);
    mockedTokenItemEntity.batchMultiAddressTokensByResourceIds.mockResolvedValueOnce(
      [first, second] as never,
    );

    prepareMultiAddressTokenAssetsProjection({
      addresses: [ADDRESS, SECOND_ADDRESS],
      tokenDisplayMode: 'byAsset',
    });

    await waitFor(
      () =>
        useTokenAssetsIndexStore.getState().multiAssetsAvailabilityByKey[
          key
        ] === 'ready',
    );

    expect(
      mockedTokenItemEntity.batchMultiAddressTokensByResourceIds,
    ).toHaveBeenCalledWith([firstId, secondId]);
    expect(tokenGroupResourceStore.getValue(groupId as never)).toMatchObject({
      primaryTokenId: secondId,
      memberTokenIds: [firstId, secondId],
      summary: {
        amount: 5,
        usd_value: 50,
      },
    });
  });

  it('does not publish deferred staged entities after the source snapshot changes', async () => {
    const visibleToken = createToken('visible-before-refresh', {
      usd_value: 20,
    });
    const staleDeferredToken = createToken('stale-deferred-token', {
      usd_value: 10,
    });
    const visibleTokenId = buildTokenEntityId(visibleToken);
    const staleDeferredTokenId = buildTokenEntityId(staleDeferredToken);
    const deferredEntityRestore = deferred<ITokenItem[]>();

    mockedRestoreAssetProjection.mockResolvedValueOnce({
      rows: [
        { type: 'token', id: visibleTokenId },
        { type: 'token', id: staleDeferredTokenId },
      ],
      groups: [],
      metadata: {
        entityRestoreMode: 'staged-v1',
        groupPrimaryTokenIds: {},
        lowValueTokenPreviewLogoUrls: [],
        lpLowValueTokenPreviewLogoUrls: [],
        additionalCoreUsdValue: 0,
        additionalTokenCount: 1,
        defaultVisibleTokenCount: 1,
        hasAdditionalTokens: true,
        hasLpTokens: false,
        lowValueTokenCount: 0,
        segmentRowCounts: {
          additionalDefault: 1,
          additionalLp: 0,
          lowValueDefault: 0,
          lowValueLp: 0,
          primary: 1,
        },
        selectedSegmentMode: 'default',
      },
    } as never);
    mockedTokenItemEntity.batchMultiAddressTokensByResourceIds
      .mockResolvedValueOnce([visibleToken] as never)
      .mockImplementationOnce(() => deferredEntityRestore.promise as never);

    const key = prepareSingleAddressTokenAssetsProjection({ address: ADDRESS });
    await waitFor(
      () =>
        useTokenAssetsIndexStore.getState().singleAssetsAvailabilityByKey[
          key
        ] === 'ready',
    );
    await waitForNextTask();
    await waitFor(
      () =>
        mockedTokenItemEntity.batchMultiAddressTokensByResourceIds.mock.calls
          .length === 2,
    );

    tokenListStore.setState({
      tokenListMap: { [NORMALIZED_ADDRESS]: [] },
      sourceSnapshotReadyByAddress: { [NORMALIZED_ADDRESS]: true },
    });
    deferredEntityRestore.resolve([staleDeferredToken]);
    await waitForNextTask();

    expect(
      tokenEntityResourceStore.getValue(staleDeferredTokenId),
    ).toBeUndefined();
  });

  it('keeps a registered projection current when address token ids change', () => {
    const first = createToken('first', { usd_value: 20 });
    replaceAddressTokens([first]);
    const key = prepareSingleAddressTokenAssetsProjection({ address: ADDRESS });

    const second = createToken('second', { usd_value: 10 });
    replaceAddressTokens([first, second]);

    expect(
      useTokenAssetsIndexStore.getState().singleAssetsResultByKey[key]
        ?.tokenIds,
    ).toEqual([buildTokenEntityId(first), buildTokenEntityId(second)]);

    replaceAddressTokens([second]);
    expect(
      useTokenAssetsIndexStore.getState().singleAssetsResultByKey[key]
        ?.tokenIds,
    ).toEqual([buildTokenEntityId(second)]);
  });

  it('keeps chain-specific projections isolated', () => {
    const eth = createToken('eth-token', { chain: 'eth', usd_value: 20 });
    const arb = createToken('arb-token', { chain: 'arb', usd_value: 10 });
    replaceAddressTokens([eth, arb]);

    const ethKey = prepareSingleAddressTokenAssetsProjection({
      address: ADDRESS,
      chainServerId: 'eth',
    });
    const arbKey = prepareSingleAddressTokenAssetsProjection({
      address: ADDRESS,
      chainServerId: 'arb',
    });
    const state = useTokenAssetsIndexStore.getState();

    expect(state.singleAssetsResultByKey[ethKey]?.tokenIds).toEqual([
      buildTokenEntityId(eth),
    ]);
    expect(state.singleAssetsResultByKey[arbKey]?.tokenIds).toEqual([
      buildTokenEntityId(arb),
    ]);
  });

  it('maintains an independent LP-token projection', () => {
    const core = createToken('core', { usd_value: 20 });
    const lp = createToken('lp', {
      is_core: null,
      protocol_id: 'protocol',
      usd_value: 10,
    });
    replaceAddressTokens([core, lp]);

    const defaultKey = prepareSingleAddressTokenAssetsProjection({
      address: ADDRESS,
    });
    const lpKey = prepareSingleAddressTokenAssetsProjection({
      address: ADDRESS,
      isLpTokenEnabled: true,
    });
    const state = useTokenAssetsIndexStore.getState();

    expect(state.singleAssetsResultByKey[defaultKey]?.tokenIds).toEqual([
      buildTokenEntityId(core),
    ]);
    expect(state.singleAssetsResultByKey[defaultKey]?.hasLpTokens).toBe(true);
    expect(state.singleAssetsResultByKey[lpKey]?.tokenIds).toEqual([
      buildTokenEntityId(core),
      buildTokenEntityId(lp),
    ]);
    expect(state.singleAssetsResultByKey[lpKey]?.defaultVisibleTokenCount).toBe(
      1,
    );
  });

  it('prepares a multi-address LP projection before consumers switch keys', () => {
    const core = createToken('core', { usd_value: 20 });
    const lp = createToken('lp', {
      is_core: null,
      protocol_id: 'protocol',
      usd_value: 10,
    });
    replaceAddressTokens([core, lp]);

    const lpKey = prepareMultiAddressTokenAssetsProjection({
      addresses: [ADDRESS],
      isLpTokenEnabled: true,
      tokenDisplayMode: 'byAddress',
    });
    const result =
      useTokenAssetsIndexStore.getState().multiAssetsResultByKey[lpKey];

    expect(lpKey).toBe(
      getMultiAssetsCacheKey([ADDRESS], undefined, true, 'byAddress'),
    );
    expect(result?.tokenIds).toEqual([
      buildTokenEntityId(core),
      buildTokenEntityId(lp),
    ]);
    expect(result?.defaultVisibleTokenCount).toBe(1);
    expect(result?.additionalTokenCount).toBe(1);
  });

  it('reuses a current display-mode projection without rebuilding its rows', () => {
    const first = createToken('shared', {
      owner_addr: NORMALIZED_ADDRESS,
      usd_value: 20,
    });
    const second = createToken('shared', {
      owner_addr: NORMALIZED_SECOND_ADDRESS,
      usd_value: 30,
    });
    tokenEntityResourceStore.upsertTokens([first, second], 'remote', {
      pruneMissing: true,
    });
    useTokenIndexStore
      .getState()
      .syncAddressTokens(NORMALIZED_ADDRESS, [first]);
    useTokenIndexStore
      .getState()
      .syncAddressTokens(NORMALIZED_SECOND_ADDRESS, [second]);

    const addresses = [ADDRESS, SECOND_ADDRESS];
    const byAssetKey = prepareMultiAddressTokenAssetsProjection({
      addresses,
      tokenDisplayMode: 'byAsset',
    });
    const initialResult =
      useTokenAssetsIndexStore.getState().multiAssetsResultByKey[byAssetKey];
    prepareMultiAddressTokenAssetsProjection({
      addresses,
      tokenDisplayMode: 'byAddress',
    });

    const getValueSpy = jest.spyOn(tokenEntityResourceStore, 'getValue');
    mockedScheduleAssetProjectionPersistence.mockClear();
    try {
      const reusedKey = prepareMultiAddressTokenAssetsProjection({
        addresses: [ADDRESS.toUpperCase(), SECOND_ADDRESS.toUpperCase()],
        tokenDisplayMode: 'byAsset',
      });

      expect(reusedKey).toBe(byAssetKey);
      expect(
        useTokenAssetsIndexStore.getState().multiAssetsResultByKey[reusedKey],
      ).toBe(initialResult);
      expect(getValueSpy).not.toHaveBeenCalled();
      expect(mockedScheduleAssetProjectionPersistence).not.toHaveBeenCalled();
    } finally {
      getValueSpy.mockRestore();
    }
  });

  it('refreshes cached display modes before they can be reused', () => {
    const first = createToken('shared', {
      owner_addr: NORMALIZED_ADDRESS,
      usd_value: 20,
    });
    const second = createToken('shared', {
      owner_addr: NORMALIZED_SECOND_ADDRESS,
      usd_value: 30,
    });
    tokenEntityResourceStore.upsertTokens([first, second], 'remote', {
      pruneMissing: true,
    });
    useTokenIndexStore
      .getState()
      .syncAddressTokens(NORMALIZED_ADDRESS, [first]);
    useTokenIndexStore
      .getState()
      .syncAddressTokens(NORMALIZED_SECOND_ADDRESS, [second]);

    const addresses = [ADDRESS, SECOND_ADDRESS];
    const byAssetKey = prepareMultiAddressTokenAssetsProjection({
      addresses,
      tokenDisplayMode: 'byAsset',
    });
    const initialResult =
      useTokenAssetsIndexStore.getState().multiAssetsResultByKey[byAssetKey];
    prepareMultiAddressTokenAssetsProjection({
      addresses,
      tokenDisplayMode: 'byAddress',
    });

    tokenEntityResourceStore.upsertTokens(
      [
        createToken('shared', {
          owner_addr: NORMALIZED_ADDRESS,
          usd_value: 40,
        }),
      ],
      'remote',
    );

    const refreshedResult =
      useTokenAssetsIndexStore.getState().multiAssetsResultByKey[byAssetKey];
    expect(refreshedResult).not.toBe(initialResult);
    const refreshedRow = refreshedResult?.rows[0];
    expect(refreshedRow?.type).toBe('group');
    if (refreshedRow?.type !== 'group') {
      throw new Error('expected an aggregated token row');
    }
    expect(
      tokenGroupResourceStore.getValue(refreshedRow.groupId)?.summary.usd_value,
    ).toBe(70);

    const getValueSpy = jest.spyOn(tokenEntityResourceStore, 'getValue');
    try {
      prepareMultiAddressTokenAssetsProjection({
        addresses: [...addresses],
        tokenDisplayMode: 'byAsset',
      });

      expect(
        useTokenAssetsIndexStore.getState().multiAssetsResultByKey[byAssetKey],
      ).toBe(refreshedResult);
      expect(getValueSpy).not.toHaveBeenCalled();
    } finally {
      getValueSpy.mockRestore();
    }
  });

  it('builds default and LP segments in one projection', () => {
    const core = createToken('core', { usd_value: 20 });
    const lp = createToken('lp', {
      is_core: null,
      protocol_id: 'protocol',
      usd_value: 10,
    });
    tokenEntityResourceStore.upsertTokens([core, lp], 'remote', {
      pruneMissing: true,
    });

    const result = buildSingleAssetsIndexFromTokenIds(
      [core, lp].map(buildTokenEntityId),
    );

    expect(result.segments.primary.tokenIds).toEqual([
      buildTokenEntityId(core),
    ]);
    expect(result.segments.additionalDefault.tokenIds).toEqual([]);
    expect(result.segments.additionalLp.tokenIds).toEqual([
      buildTokenEntityId(lp),
    ]);
  });

  it('persists every segment with explicit restore boundaries', () => {
    const core = createToken('core', { usd_value: 20 });
    const lp = createToken('lp', {
      is_core: null,
      protocol_id: 'protocol',
      usd_value: 10,
    });
    replaceAddressTokens([core, lp]);

    prepareSingleAddressTokenAssetsProjection({ address: ADDRESS });

    expect(mockedScheduleAssetProjectionPersistence).toHaveBeenLastCalledWith(
      expect.objectContaining({
        ruleVersion: 4,
        rows: [
          { type: 'token', id: buildTokenEntityId(core) },
          { type: 'token', id: buildTokenEntityId(lp) },
        ],
        metadata: expect.objectContaining({
          entityRestoreMode: 'staged-v1',
          groupPrimaryTokenIds: {},
          lowValueTokenPreviewLogoUrls: [],
          lpLowValueTokenPreviewLogoUrls: [],
          selectedSegmentMode: 'default',
          segmentRowCounts: {
            primary: 1,
            additionalDefault: 0,
            additionalLp: 1,
            lowValueDefault: 0,
            lowValueLp: 0,
          },
        }),
      }),
    );
  });

  it('keeps unaffected segment references stable when an LP row is added', () => {
    const core = createToken('core', { usd_value: 20 });
    tokenEntityResourceStore.upsertTokens([core], 'remote', {
      pruneMissing: true,
    });
    const previous = buildSingleAssetsIndexFromTokenIds([
      buildTokenEntityId(core),
    ]);
    const lp = createToken('lp', {
      is_core: null,
      protocol_id: 'protocol',
      usd_value: 10,
    });
    tokenEntityResourceStore.upsertTokens([lp], 'remote');

    const next = buildSingleAssetsIndexFromTokenIds(
      [core, lp].map(buildTokenEntityId),
      undefined,
      false,
      previous,
    );

    expect(next.segments.primary).toBe(previous.segments.primary);
    expect(next.segments.additionalDefault).toBe(
      previous.segments.additionalDefault,
    );
    expect(next.segments.lowValueDefault).toBe(
      previous.segments.lowValueDefault,
    );
    expect(next.segments.lowValueLp).toBe(previous.segments.lowValueLp);
    expect(next.segments.additionalLp).not.toBe(previous.segments.additionalLp);
    expect(next.segments.additionalLp.tokenIds).toEqual([
      buildTokenEntityId(lp),
    ]);
  });

  it('keeps segment references stable when entity values change in place', () => {
    const token = createToken('token', { usd_value: 20 });
    tokenEntityResourceStore.upsertTokens([token], 'remote', {
      pruneMissing: true,
    });
    const tokenId = buildTokenEntityId(token);
    const previous = buildSingleAssetsIndexFromTokenIds([tokenId]);

    tokenEntityResourceStore.upsertTokens(
      [createToken('token', { price: 2, usd_value: 20 })],
      'remote',
    );
    const next = buildSingleAssetsIndexFromTokenIds(
      [tokenId],
      undefined,
      false,
      previous,
    );

    expect(next.segments).toBe(previous.segments);
    expect(next.segments.primary).toBe(previous.segments.primary);
    expect(next.segments.primary.rows).toBe(previous.segments.primary.rows);
    expect(next.segments.primary.tokenIds).toBe(
      previous.segments.primary.tokenIds,
    );
    expect(tokenEntityResourceStore.getValue(tokenId)?.price).toBe(2);
  });

  it('publishes all registered projection updates in one store notification', () => {
    const eth = createToken('eth-token', { chain: 'eth', usd_value: 20 });
    replaceAddressTokens([eth]);
    prepareSingleAddressTokenAssetsProjection({ address: ADDRESS });
    prepareSingleAddressTokenAssetsProjection({
      address: ADDRESS,
      chainServerId: 'eth',
    });
    prepareSingleAddressTokenAssetsProjection({
      address: ADDRESS,
      isLpTokenEnabled: true,
    });
    const subscriber = jest.fn();
    const unsubscribe = useTokenAssetsIndexStore.subscribe(subscriber);

    replaceAddressTokens([
      eth,
      createToken('second', { chain: 'eth', usd_value: 10 }),
    ]);

    expect(subscriber).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('refreshes a registered projection when token entity data changes', () => {
    const token = createToken('token', { usd_value: 20 });
    replaceAddressTokens([token]);
    const key = prepareSingleAddressTokenAssetsProjection({
      address: ADDRESS,
    });
    const tokenId = buildTokenEntityId(token);
    const previousVersion = tokenEntityResourceStore.getMeta(tokenId)?.version;

    tokenEntityResourceStore.upsertTokens(
      [createToken('token', { is_core: null, usd_value: 0 })],
      'remote',
    );

    expect(tokenEntityResourceStore.getValue(tokenId)?.usd_value).toBe(0);
    expect(tokenEntityResourceStore.getMeta(tokenId)?.version).toBe(
      (previousVersion || 0) + 1,
    );
    const config =
      useTokenAssetsIndexStore.getState().singleAssetsConfigByKey[key];
    expect(config?.tokenIds).toContain(tokenId);
    expect(
      useTokenAssetsIndexStore.getState().singleAssetsResultByKey[key]
        ?.tokenIds,
    ).toEqual([tokenId]);
    expect(
      useTokenAssetsIndexStore.getState().singleAssetsResultByKey[key],
    ).toMatchObject({
      defaultVisibleTokenCount: 0,
      additionalTokenCount: 0,
      lowValueTokenCount: 1,
      hasAdditionalTokens: true,
    });
  });

  it('separates eligible low-value tokens and excludes explicit risk tokens', () => {
    const lowValueNonCore = createToken('low-value-non-core', {
      is_core: null,
      usd_value: 0,
    });
    const unverified = createToken('unverified', {
      is_verified: false,
      usd_value: 100,
    });
    const suspicious = createToken('suspicious', {
      is_suspicious: true,
      usd_value: 100,
    });
    replaceAddressTokens([lowValueNonCore, unverified, suspicious]);

    const key = prepareSingleAddressTokenAssetsProjection({ address: ADDRESS });

    expect(
      useTokenAssetsIndexStore.getState().singleAssetsResultByKey[key]
        ?.tokenIds,
    ).toEqual([buildTokenEntityId(lowValueNonCore)]);
    expect(
      useTokenAssetsIndexStore.getState().singleAssetsResultByKey[key],
    ).toMatchObject({
      defaultVisibleTokenCount: 0,
      additionalTokenCount: 0,
      lowValueTokenCount: 1,
      hasAdditionalTokens: true,
    });
  });

  it('shares entities while keeping single and multi scene ordering independent', () => {
    const firstAddressToken = createToken('shared-token', {
      owner_addr: NORMALIZED_ADDRESS,
      usd_value: 20,
    });
    const secondAddressToken = createToken('second-token', {
      owner_addr: NORMALIZED_SECOND_ADDRESS,
      usd_value: 30,
    });
    tokenEntityResourceStore.upsertTokens(
      [firstAddressToken, secondAddressToken],
      'remote',
      { pruneMissing: true },
    );
    useTokenIndexStore
      .getState()
      .syncAddressTokens(NORMALIZED_ADDRESS, [firstAddressToken]);
    useTokenIndexStore
      .getState()
      .syncAddressTokens(NORMALIZED_SECOND_ADDRESS, [secondAddressToken]);

    const firstTokenId = buildTokenEntityId(firstAddressToken);
    const secondTokenId = buildTokenEntityId(secondAddressToken);
    const singleKey = prepareSingleAddressTokenAssetsProjection({
      address: ADDRESS,
    });
    const multiKey = getMultiAssetsCacheKey(
      [ADDRESS, SECOND_ADDRESS],
      undefined,
      false,
      'byAddress',
    );
    useTokenAssetsIndexStore.getState().syncMultiAssetsResult({
      key: multiKey,
      addresses: [NORMALIZED_ADDRESS, NORMALIZED_SECOND_ADDRESS],
      tokenIds: [firstTokenId, secondTokenId],
      tokenDisplayMode: 'byAddress',
    });

    expect(
      useTokenAssetsIndexStore.getState().singleAssetsResultByKey[singleKey]
        ?.tokenIds,
    ).toEqual([firstTokenId]);
    expect(
      useTokenAssetsIndexStore.getState().multiAssetsResultByKey[multiKey]
        ?.tokenIds,
    ).toEqual([secondTokenId, firstTokenId]);

    tokenEntityResourceStore.upsertTokens(
      [
        createToken('shared-token', {
          owner_addr: NORMALIZED_ADDRESS,
          usd_value: 40,
        }),
      ],
      'remote',
    );

    const state = useTokenAssetsIndexStore.getState();
    expect(state.singleAssetsResultByKey[singleKey]?.tokenIds).toEqual([
      firstTokenId,
    ]);
    expect(state.multiAssetsResultByKey[multiKey]?.tokenIds).toEqual([
      firstTokenId,
      secondTokenId,
    ]);
    expect(tokenEntityResourceStore.getValue(firstTokenId)?.usd_value).toBe(40);
    expect(state.singleAssetsResultByKey[singleKey]?.tokenIds[0]).toBe(
      state.multiAssetsResultByKey[multiKey]?.tokenIds[0],
    );
  });

  it('keeps by-address rows isolated and sorts equal values stably', () => {
    const first = createToken('shared', {
      owner_addr: NORMALIZED_ADDRESS,
      usd_value: 10,
    });
    const second = createToken('shared', {
      owner_addr: NORMALIZED_SECOND_ADDRESS,
      usd_value: 20,
    });
    const third = createToken('third', {
      owner_addr: NORMALIZED_ADDRESS,
      usd_value: 10,
    });
    tokenEntityResourceStore.upsertTokens([first, second, third], 'remote', {
      pruneMissing: true,
    });

    const result = buildMultiAssetsIndexFromTokenIds(
      [
        buildTokenEntityId(first),
        buildTokenEntityId(third),
        buildTokenEntityId(second),
      ],
      undefined,
      false,
      'byAddress',
      'multi-by-address',
    );

    expect(result.rows).toEqual([
      { type: 'token', tokenId: buildTokenEntityId(second) },
      { type: 'token', tokenId: buildTokenEntityId(first) },
      { type: 'token', tokenId: buildTokenEntityId(third) },
    ]);
  });

  it('groups the same asset across owners in by-asset mode', () => {
    const first = createToken('shared', {
      owner_addr: NORMALIZED_ADDRESS,
      amount: 2,
      usd_value: 20,
    });
    const second = createToken('shared', {
      owner_addr: NORMALIZED_SECOND_ADDRESS,
      amount: 3,
      usd_value: 30,
    });
    tokenEntityResourceStore.upsertTokens([first, second], 'remote', {
      pruneMissing: true,
    });

    const result = buildMultiAssetsIndexFromTokenIds(
      [buildTokenEntityId(first), buildTokenEntityId(second)],
      undefined,
      false,
      'byAsset',
      'multi-by-asset',
    );
    const row = result.rows[0];
    expect(row?.type).toBe('group');
    if (row?.type !== 'group') {
      throw new Error('expected an aggregated token row');
    }
    const group = tokenGroupResourceStore.getValue(row.groupId);

    expect(result.rows).toHaveLength(1);
    expect(group?.memberTokenIds).toEqual([
      buildTokenEntityId(first),
      buildTokenEntityId(second),
    ]);
    expect(group?.primaryTokenId).toBe(buildTokenEntityId(second));
    expect(group?.summary.amount).toBe(5);
    expect(group?.summary.usd_value).toBe(50);
  });

  it('groups normalized symbols across chains in by-symbol mode', () => {
    const eth = createToken('eth-usdc', {
      chain: 'eth',
      owner_addr: NORMALIZED_ADDRESS,
      symbol: 'USDC',
      usd_value: 10,
    });
    const arb = createToken('arb-usdc', {
      chain: 'arb',
      owner_addr: NORMALIZED_SECOND_ADDRESS,
      symbol: ' usdc ',
      usd_value: 20,
    });
    tokenEntityResourceStore.upsertTokens([eth, arb], 'remote', {
      pruneMissing: true,
    });

    const result = buildMultiAssetsIndexFromTokenIds(
      [buildTokenEntityId(eth), buildTokenEntityId(arb)],
      undefined,
      false,
      'bySymbol',
      'multi-by-symbol',
    );
    const row = result.rows[0];
    expect(row?.type).toBe('group');
    if (row?.type !== 'group') {
      throw new Error('expected a symbol group row');
    }

    expect(
      tokenGroupResourceStore.getValue(row.groupId)?.memberTokenIds,
    ).toEqual([buildTokenEntityId(eth), buildTokenEntityId(arb)]);
  });

  it('applies chain filtering and only adds LP rows when the LP switch is enabled', () => {
    const eth = createToken('eth', { chain: 'eth', usd_value: 0 });
    const arb = createToken('arb', { chain: 'arb', usd_value: 50 });
    const lp = createToken('lp', {
      chain: 'eth',
      is_core: null,
      protocol_id: 'curve',
      usd_value: 5,
    });
    tokenEntityResourceStore.upsertTokens([eth, arb, lp], 'remote', {
      pruneMissing: true,
    });
    const ids = [eth, arb, lp].map(buildTokenEntityId);

    expect(
      buildMultiAssetsIndexFromTokenIds(ids, 'eth', false, 'byAddress')
        .tokenIds,
    ).toEqual([buildTokenEntityId(eth)]);
    const lpResult = buildMultiAssetsIndexFromTokenIds(
      ids,
      'eth',
      true,
      'byAddress',
    );
    expect(lpResult.tokenIds).toEqual([
      buildTokenEntityId(eth),
      buildTokenEntityId(lp),
    ]);
    expect(lpResult.defaultVisibleTokenCount).toBe(1);
  });

  it('keeps high-value non-core rows out of the default visible segment', () => {
    const core = createToken('core-usdc', { usd_value: 363 });
    const nonCore = createToken('moon-dex', {
      is_core: null,
      usd_value: 11_856,
    });
    tokenEntityResourceStore.upsertTokens([nonCore, core], 'remote', {
      pruneMissing: true,
    });

    const result = buildMultiAssetsIndexFromTokenIds(
      [buildTokenEntityId(nonCore), buildTokenEntityId(core)],
      undefined,
      false,
      'byAddress',
    );

    expect(result.tokenIds).toEqual([
      buildTokenEntityId(core),
      buildTokenEntityId(nonCore),
    ]);
    expect(result).toMatchObject({
      defaultVisibleTokenCount: 1,
      additionalTokenCount: 1,
      lowValueTokenCount: 0,
      hasAdditionalTokens: true,
    });
  });

  it('keeps the baseline threshold-based default visible segment', () => {
    const values = [1000, 100, 0.5, 0.4, 0.3, 0.2];
    const tokens = values.map((usdValue, index) =>
      createToken(`token-${index}`, { usd_value: usdValue }),
    );
    tokenEntityResourceStore.upsertTokens(tokens, 'remote', {
      pruneMissing: true,
    });

    const result = buildMultiAssetsIndexFromTokenIds(
      tokens.map(buildTokenEntityId),
      undefined,
      false,
      'byAddress',
    );

    expect(result.tokenIds).toEqual(tokens.map(buildTokenEntityId));
    expect(result).toMatchObject({
      defaultVisibleTokenCount: 2,
      additionalTokenCount: 4,
      lowValueTokenCount: 0,
      hasAdditionalTokens: true,
    });

    const singleResult = buildSingleAssetsIndexFromTokenIds(
      tokens.map(buildTokenEntityId),
    );
    expect(singleResult.tokenIds).toEqual(tokens.map(buildTokenEntityId));
    expect(singleResult.defaultVisibleTokenCount).toBe(2);
    expect(singleResult.additionalTokenCount).toBe(4);
  });

  it('limits the default visible segment to 20 rows', () => {
    const tokens = Array.from({ length: 25 }, (_, index) =>
      createToken(`token-${index}`, { usd_value: 25 - index }),
    );
    tokenEntityResourceStore.upsertTokens(tokens, 'remote', {
      pruneMissing: true,
    });

    const result = buildMultiAssetsIndexFromTokenIds(
      tokens.map(buildTokenEntityId),
      undefined,
      false,
      'byAddress',
    );

    expect(result.rows).toHaveLength(25);
    expect(result.defaultVisibleTokenCount).toBe(20);
    expect(result.additionalTokenCount).toBe(5);
    expect(result.hasAdditionalTokens).toBe(true);
  });

  it('keeps hidden core rows out when LP rows are enabled', () => {
    const coreTokens = Array.from({ length: 21 }, (_, index) =>
      createToken(`core-${index}`, { usd_value: 21 - index }),
    );
    const lp = createToken('lp', {
      is_core: null,
      protocol_id: 'curve',
      usd_value: 100,
    });
    const ordinaryHiddenToken = createToken('ordinary-hidden', {
      is_core: null,
      usd_value: 99,
    });
    tokenEntityResourceStore.upsertTokens(
      [...coreTokens, ordinaryHiddenToken, lp],
      'remote',
      {
        pruneMissing: true,
      },
    );

    const result = buildMultiAssetsIndexFromTokenIds(
      [...coreTokens, ordinaryHiddenToken, lp].map(buildTokenEntityId),
      undefined,
      true,
      'byAddress',
    );

    expect(result.defaultVisibleTokenCount).toBe(20);
    expect(result.tokenIds).toEqual([
      ...coreTokens.slice(0, 20).map(buildTokenEntityId),
      buildTokenEntityId(lp),
    ]);
  });

  it('keeps hidden default-mode rows available to non-UI consumers', () => {
    const coreTokens = Array.from({ length: 21 }, (_, index) =>
      createToken(`core-${index}`, { usd_value: 21 - index }),
    );
    const hiddenNonCore = createToken('hidden-non-core', {
      is_core: null,
      usd_value: 0.5,
    });
    const lp = createToken('lp', {
      is_core: null,
      protocol_id: 'curve',
      usd_value: 0.4,
    });
    const risk = createToken('risk', {
      is_verified: false,
      usd_value: 0.3,
    });
    const tokens = [...coreTokens, hiddenNonCore, lp, risk];
    tokenEntityResourceStore.upsertTokens(tokens, 'remote', {
      pruneMissing: true,
    });

    expect(
      buildSingleAssetsEligibleTokenIdsFromTokenIds(
        tokens.map(buildTokenEntityId),
      ),
    ).toEqual([
      ...coreTokens.map(buildTokenEntityId),
      buildTokenEntityId(hiddenNonCore),
    ]);
  });

  it('does not publish a new group version when aggregate data is unchanged', () => {
    const first = createToken('shared', {
      owner_addr: NORMALIZED_ADDRESS,
      usd_value: 20,
    });
    const second = createToken('shared', {
      owner_addr: NORMALIZED_SECOND_ADDRESS,
      usd_value: 30,
    });
    const tokenIds = [first, second].map(buildTokenEntityId);
    tokenEntityResourceStore.upsertTokens([first, second], 'remote', {
      pruneMissing: true,
    });

    const firstResult = buildMultiAssetsIndexFromTokenIds(
      tokenIds,
      undefined,
      false,
      'byAsset',
      'stable-group',
    );
    const firstRow = firstResult.rows[0];
    if (firstRow?.type !== 'group') {
      throw new Error('expected an aggregated token row');
    }
    const previousVersion = tokenGroupResourceStore.getMeta(
      firstRow.groupId,
    )?.version;

    const secondResult = buildMultiAssetsIndexFromTokenIds(
      tokenIds,
      undefined,
      false,
      'byAsset',
      'stable-group',
      firstResult,
    );

    expect(secondResult).toBe(firstResult);
    expect(tokenGroupResourceStore.getMeta(firstRow.groupId)?.version).toBe(
      previousVersion,
    );
  });

  it('does not let a late multi-address response overwrite a newer single-address response', async () => {
    const cached = createToken('cached', { usd_value: 1 });
    const stale = createToken('stale', { usd_value: 2 });
    const latest = createToken('latest', { usd_value: 3 });
    tokenListStore.setState({
      tokenListMap: { [NORMALIZED_ADDRESS]: [cached] },
    });
    const pendingStale = deferred<ITokenItem[]>();
    mockedRequestOpenApiWithChainId
      .mockImplementationOnce(() => pendingStale.promise)
      .mockResolvedValueOnce([latest]);

    const staleRequest = tokenListStore
      .getState()
      .batchGetTokenList([ADDRESS], true);
    await waitFor(
      () => mockedRequestOpenApiWithChainId.mock.calls.length === 1,
    );
    await tokenListStore.getState().getTokenList(ADDRESS, true);
    pendingStale.resolve([stale]);
    await staleRequest;

    expect(tokenListStore.getState().tokenListMap[NORMALIZED_ADDRESS]).toEqual([
      latest,
    ]);
    expect(mockedSyncRemoteTokens).toHaveBeenCalledWith(NORMALIZED_ADDRESS, [
      latest,
    ]);
    expect(mockedSyncRemoteTokensForAddresses).not.toHaveBeenCalled();
  });

  it('shares an in-flight multi-address refresh with a later manual force refresh', async () => {
    const cached = createToken('cached');
    const pendingCache = deferred<ITokenItem[]>();
    mockedQueryTokensCache.mockReturnValueOnce(pendingCache.promise);
    mockedRequestOpenApiWithChainId.mockResolvedValue([]);

    const initialRequest = tokenListStore
      .getState()
      .batchGetTokenList([ADDRESS], false);
    await waitFor(() => mockedQueryTokensCache.mock.calls.length === 1);

    const manualRefresh = tokenListStore
      .getState()
      .batchGetTokenList([ADDRESS], true);

    expect(mockedQueryTokensCache).toHaveBeenCalledTimes(1);
    pendingCache.resolve([cached]);
    await Promise.all([initialRequest, manualRefresh]);

    expect(mockedQueryTokensCache).toHaveBeenCalledTimes(1);
    expect(mockedUsedChainList).toHaveBeenCalledTimes(1);
  });

  it('keeps failed-chain data while publishing successful LP chain data', async () => {
    const cachedArbitrumToken = createToken('cached-arbitrum', {
      chain: 'arb',
      usd_value: 4,
    });
    const freshLpToken = createToken('fresh-lp', {
      chain: 'eth',
      is_core: false,
      protocol_id: 'curve',
      usd_value: 3,
    });
    tokenListStore.setState({
      tokenListMap: {
        [NORMALIZED_ADDRESS]: [cachedArbitrumToken],
      },
    });
    mockedUsedChainList.mockResolvedValueOnce([
      { id: 'eth' },
      { id: 'arb' },
    ] as never);
    mockedRequestOpenApiWithChainId
      .mockResolvedValueOnce([freshLpToken])
      .mockRejectedValueOnce(new Error('arb request failed'));

    await tokenListStore.getState().batchGetTokenList([ADDRESS], true);

    expect(tokenListStore.getState().tokenListMap[NORMALIZED_ADDRESS]).toEqual([
      cachedArbitrumToken,
      freshLpToken,
    ]);
    expect(mockedSyncRemoteTokensForAddresses).not.toHaveBeenCalled();

    const projectionKey = prepareMultiAddressTokenAssetsProjection({
      addresses: [ADDRESS],
      tokenDisplayMode: 'byAddress',
    });
    const projection =
      useTokenAssetsIndexStore.getState().multiAssetsResultByKey[projectionKey];
    expect(projection?.segments.additionalLp.tokenIds).toEqual([
      buildTokenEntityId(freshLpToken),
    ]);
    expect(mockedUsedChainList).toHaveBeenCalledTimes(1);
  });

  it('keeps the previous snapshot when chain discovery is rate limited', async () => {
    const cached = createToken('cached', {
      chain: 'eth',
      usd_value: 2,
    });
    tokenListStore.setState({
      tokenListMap: {
        [NORMALIZED_ADDRESS]: [cached],
      },
    });
    mockedUsedChainList.mockRejectedValueOnce(createHttpError(429) as never);

    await tokenListStore.getState().batchGetTokenList([ADDRESS], true);

    expect(mockedUsedChainList).toHaveBeenCalledTimes(1);
    expect(mockedRequestOpenApiWithChainId).not.toHaveBeenCalled();
    expect(tokenListStore.getState().tokenListMap[NORMALIZED_ADDRESS]).toEqual([
      cached,
    ]);
    expect(mockedSyncRemoteTokensForAddresses).not.toHaveBeenCalled();
  });

  it('persists a refreshed projection only after canonical token entities succeed', async () => {
    const cached = createToken('cached', { usd_value: 2 });
    const refreshed = createToken('refreshed', { usd_value: 3 });
    tokenListStore.setState({
      tokenListMap: {
        [NORMALIZED_ADDRESS]: [cached],
      },
      sourceSnapshotReadyByAddress: {
        [NORMALIZED_ADDRESS]: true,
      },
    });
    prepareMultiAddressTokenAssetsProjection({
      addresses: [ADDRESS],
      tokenDisplayMode: 'byAddress',
    });
    mockedScheduleAssetProjectionPersistence.mockClear();

    const canonicalPersistence = deferred<boolean>();
    mockedSyncRemoteTokensForAddresses.mockReturnValueOnce(
      canonicalPersistence.promise,
    );
    mockedRequestOpenApiWithChainId.mockResolvedValueOnce([refreshed]);

    await tokenListStore.getState().batchGetTokenList([ADDRESS], true);

    expect(mockedSyncRemoteTokensForAddresses).toHaveBeenCalledWith({
      [NORMALIZED_ADDRESS]: [refreshed],
    });
    expect(mockedScheduleAssetProjectionPersistence).not.toHaveBeenCalled();

    canonicalPersistence.resolve(true);
    await waitFor(
      () => mockedScheduleAssetProjectionPersistence.mock.calls.length === 1,
    );
    expect(mockedScheduleAssetProjectionPersistence).toHaveBeenCalledTimes(1);
  });

  it('keeps other address indexes when a single address refresh completes', async () => {
    const firstAddressToken = createToken('first-before', {
      owner_addr: NORMALIZED_ADDRESS,
      usd_value: 2,
    });
    const secondAddressToken = createToken('second', {
      owner_addr: NORMALIZED_SECOND_ADDRESS,
      usd_value: 3,
    });
    const refreshedFirstAddressToken = createToken('first-after', {
      owner_addr: NORMALIZED_ADDRESS,
      usd_value: 4,
    });
    tokenListStore.setState({
      tokenListMap: {
        [NORMALIZED_ADDRESS]: [firstAddressToken],
        [NORMALIZED_SECOND_ADDRESS]: [secondAddressToken],
      },
    });
    mockedRequestOpenApiWithChainId.mockResolvedValueOnce([
      refreshedFirstAddressToken,
    ]);

    await tokenListStore.getState().getTokenList(ADDRESS, true);

    expect(
      tokenListStore.getState().tokenListMap[NORMALIZED_SECOND_ADDRESS],
    ).toEqual([secondAddressToken]);
    expect(
      useTokenIndexStore.getState().addressTokenIds[NORMALIZED_SECOND_ADDRESS],
    ).toEqual([buildTokenEntityId(secondAddressToken)]);

    const projectionKey = prepareMultiAddressTokenAssetsProjection({
      addresses: [ADDRESS, SECOND_ADDRESS],
      tokenDisplayMode: 'byAddress',
    });
    const projection =
      useTokenAssetsIndexStore.getState().multiAssetsResultByKey[projectionKey];
    expect(projection?.tokenIds).toEqual(
      expect.arrayContaining([
        buildTokenEntityId(refreshedFirstAddressToken),
        buildTokenEntityId(secondAddressToken),
      ]),
    );
  });

  it('does not cancel an active remote refresh when a newer call only reads fresh memory', async () => {
    const cached = createToken('cached', { usd_value: 1 });
    const refreshed = createToken('refreshed', { usd_value: 2 });
    tokenListStore.setState({
      tokenListMap: { [NORMALIZED_ADDRESS]: [cached] },
    });
    mockedTokenItemEntity.isExpired
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    const pendingRefresh = deferred<ITokenItem[]>();
    mockedRequestOpenApiWithChainId.mockReturnValueOnce(pendingRefresh.promise);

    const remoteRefresh = tokenListStore.getState().getTokenList(ADDRESS, true);
    await waitFor(
      () => mockedRequestOpenApiWithChainId.mock.calls.length === 1,
    );

    await tokenListStore.getState().getTokenList(ADDRESS, false);
    pendingRefresh.resolve([refreshed]);
    await remoteRefresh;

    expect(tokenListStore.getState().tokenListMap[NORMALIZED_ADDRESS]).toEqual([
      refreshed,
    ]);
    expect(mockedSyncRemoteTokens).toHaveBeenCalledWith(NORMALIZED_ADDRESS, [
      refreshed,
    ]);
  });

  it('does not let an older local hydration overwrite a remote refresh', async () => {
    const stale = createToken('stale', { usd_value: 1 });
    const refreshed = createToken('refreshed', { usd_value: 2 });
    mockedTokenItemEntity.isExpired
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const pendingHydration = deferred<ITokenItem[]>();
    mockedTokenItemEntity.batchMultiAddressTokens.mockReturnValueOnce(
      pendingHydration.promise as never,
    );
    mockedRequestOpenApiWithChainId.mockResolvedValueOnce([refreshed]);

    const hydration = tokenListStore.getState().getTokenList(ADDRESS, false);
    await waitFor(
      () => mockedTokenItemEntity.batchMultiAddressTokens.mock.calls.length > 0,
    );
    await tokenListStore.getState().getTokenList(ADDRESS, true);
    pendingHydration.resolve([stale]);
    await hydration;

    expect(tokenListStore.getState().tokenListMap[NORMALIZED_ADDRESS]).toEqual([
      refreshed,
    ]);
  });

  it('retains a usable token snapshot when a remote chain request fails', async () => {
    const cached = createToken('cached', { usd_value: 1 });
    tokenListStore.setState({
      tokenListMap: { [NORMALIZED_ADDRESS]: [cached] },
    });
    mockedRequestOpenApiWithChainId.mockRejectedValue(
      new Error('network failed'),
    );
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    await tokenListStore.getState().getTokenList(ADDRESS, true);

    expect(tokenListStore.getState().tokenListMap[NORMALIZED_ADDRESS]).toEqual([
      cached,
    ]);
    expect(mockedSyncRemoteTokens).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith(
      'ServiceErrorType.Token',
      expect.any(Error),
    );
    consoleError.mockRestore();
  });

  it('publishes and persists a successful empty token snapshot', async () => {
    const cached = createToken('cached', { usd_value: 1 });
    tokenListStore.setState({
      tokenListMap: { [NORMALIZED_ADDRESS]: [cached] },
    });
    mockedRequestOpenApiWithChainId.mockResolvedValue([]);

    await tokenListStore.getState().getTokenList(ADDRESS, true);

    expect(tokenListStore.getState().tokenListMap[NORMALIZED_ADDRESS]).toEqual(
      [],
    );
    expect(mockedSyncRemoteTokens).toHaveBeenCalledWith(NORMALIZED_ADDRESS, []);
  });
});
