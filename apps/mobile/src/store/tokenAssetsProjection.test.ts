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
  buildTokenEntityId,
  getSingleAssetsCacheKey,
  prepareSingleAddressTokenAssetsProjection,
  tokenEntityResourceStore,
  useTokenAssetsIndexStore,
  useTokenIndexStore,
} from './tokens';

const ADDRESS = '0xAbCd';
const NORMALIZED_ADDRESS = ADDRESS.toLowerCase();

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
});
