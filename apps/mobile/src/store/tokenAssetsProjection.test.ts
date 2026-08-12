import type { ITokenItem } from '@/types/assets';

jest.mock('@/core/apis/account', () => ({
  getTop10MyAccounts: jest.fn(() => []),
}));
jest.mock('@/core/apis/tokenCache', () => ({
  queryTokensCache: jest.fn(async () => []),
}));
jest.mock('@/core/request', () => ({ openapi: {} }));
jest.mock('@/store/balance', () => ({
  getSelectedBalanceAddressesSnapshot: jest.fn(() => []),
}));
jest.mock('@/databases/entities/tokenitem', () => ({
  TokenItemEntity: {},
}));
jest.mock('@/databases/sync/assets', () => ({
  syncRemoteTokens: jest.fn(),
  syncRemoteTokensForAddresses: jest.fn(),
}));
jest.mock('./assetProjectionPersistence', () => ({
  restoreAssetProjection: jest.fn(async () => null),
  scheduleAssetProjectionPersistence: jest.fn(),
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
  buildTokenEntityId,
  getMultiAssetsCacheKey,
  getSingleAssetsCacheKey,
  prepareSingleAddressTokenAssetsProjection,
  tokenEntityResourceStore,
  tokenGroupResourceStore,
  useTokenAssetsIndexStore,
  useTokenIndexStore,
} from './tokens';

const ADDRESS = '0xAbCd';
const NORMALIZED_ADDRESS = ADDRESS.toLowerCase();
const SECOND_ADDRESS = '0xDeF0';
const NORMALIZED_SECOND_ADDRESS = SECOND_ADDRESS.toLowerCase();

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

const replaceAddressTokens = (tokens: ITokenItem[]) => {
  tokenEntityResourceStore.upsertTokens(tokens, 'remote', {
    pruneMissingAddresses: new Set([NORMALIZED_ADDRESS]),
  });
  useTokenIndexStore.getState().syncAddressTokens(NORMALIZED_ADDRESS, tokens);
};

describe('single-address token assets projection', () => {
  beforeEach(() => {
    useTokenAssetsIndexStore.setState({
      singleAssetsConfigByKey: {},
      singleAssetsResultByKey: {},
      multiAssetsConfigByKey: {},
      multiAssetsResultByKey: {},
    });
    tokenEntityResourceStore.upsertTokens([], 'remote', {
      pruneMissing: true,
    });
    useTokenIndexStore.setState({
      addressTokenIds: {},
      addressVersions: {},
      tokenStaticMap: {},
    });
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
    expect(state.singleAssetsResultByKey[lpKey]?.tokenIds).toEqual([
      buildTokenEntityId(core),
      buildTokenEntityId(lp),
    ]);
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
  });

  it('keeps low-value eligible tokens but excludes explicit risk tokens', () => {
    const eligible = createToken('eligible', {
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
    replaceAddressTokens([eligible, unverified, suspicious]);

    const key = prepareSingleAddressTokenAssetsProjection({ address: ADDRESS });

    expect(
      useTokenAssetsIndexStore.getState().singleAssetsResultByKey[key]
        ?.tokenIds,
    ).toEqual([buildTokenEntityId(eligible)]);
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

  it('applies chain and LP filters without dropping eligible low-value rows', () => {
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
    expect(
      buildMultiAssetsIndexFromTokenIds(ids, 'eth', true, 'byAddress').tokenIds,
    ).toEqual([buildTokenEntityId(lp), buildTokenEntityId(eth)]);
  });

  it('keeps every eligible token instead of truncating the projection', () => {
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
});
