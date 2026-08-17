import type { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import type { DataSource } from 'typeorm/browser';

import { createMemoryAppDataSource } from '../../test-support/database/createMemoryAppDataSource';
import { TokenItemEntity } from './entities/tokenitem';
import {
  compileTokenAssetSqlProjection,
  type TokenAssetSqlProjectionSegment,
} from './tokenAssetProjection';

const OWNER_A = '0xAa';
const OWNER_B = '0xBb';

const resourceId = (owner: string, chain: string, id: string) =>
  `${owner.toLowerCase()}:${chain.toLowerCase()}:${id.toLowerCase()}`;

const createToken = ({
  id,
  owner = OWNER_A,
  chain = 'eth',
  amount = 1,
  usdValue = 1,
  symbol = id,
  optimizedSymbol = '',
  isCore = true,
  isVerified = true,
  isSuspicious = false,
  protocolId = '',
}: {
  id: string;
  owner?: string;
  chain?: string;
  amount?: number;
  usdValue?: number;
  symbol?: string;
  optimizedSymbol?: string;
  isCore?: boolean | null;
  isVerified?: boolean | null;
  isSuspicious?: boolean;
  protocolId?: string;
}) => {
  const entity = new TokenItemEntity();
  TokenItemEntity.fillEntity(entity, owner, {
    amount,
    chain,
    decimals: 18,
    display_symbol: symbol,
    id,
    is_core: isCore,
    is_suspicious: isSuspicious,
    is_verified: isVerified,
    logo_url: `${id}.png`,
    name: id,
    optimized_symbol: optimizedSymbol,
    price: amount ? usdValue / amount : 0,
    protocol_id: protocolId,
    symbol,
    usd_value: usdValue,
  } as TokenItem);
  return entity;
};

const idsForSegment = (
  rows: Awaited<ReturnType<typeof compileTokenAssetSqlProjection>>['rows'],
  segment: TokenAssetSqlProjectionSegment,
) =>
  rows.filter(row => row.segment === segment).map(row => row.primaryResourceId);

describe('token asset SQL projection', () => {
  let dataSource: DataSource | undefined;

  afterEach(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
    dataSource = undefined;
  });

  it('preserves the single-address primary, additional, LP, and low-value sections', async () => {
    dataSource = await createMemoryAppDataSource();
    await dataSource.getRepository(TokenItemEntity).save([
      createToken({ id: 'core-100', usdValue: 100 }),
      createToken({ id: 'core-50', usdValue: 50 }),
      createToken({ id: 'core-low-1', usdValue: 0.5 }),
      createToken({ id: 'core-low-2', usdValue: 0.4 }),
      createToken({ id: 'core-low-3', usdValue: 0.3 }),
      createToken({ id: 'core-low-4', usdValue: 0.2 }),
      createToken({ id: 'plain', usdValue: 12, isCore: null }),
      createToken({
        id: 'lp',
        usdValue: 11,
        isCore: null,
        protocolId: 'curve',
      }),
      createToken({ id: 'zero-core', usdValue: 0, isCore: true }),
      createToken({ id: 'low-plain', usdValue: 0, isCore: null }),
      createToken({
        id: 'low-lp',
        usdValue: 0,
        isCore: null,
        protocolId: 'uniswap',
      }),
      createToken({
        id: 'risk',
        usdValue: 999,
        isCore: true,
        isVerified: false,
      }),
      createToken({ id: 'other-chain', chain: 'arb', usdValue: 500 }),
    ]);

    const projection = await compileTokenAssetSqlProjection(
      {
        addresses: [OWNER_A],
        chainServerId: 'eth',
        scene: 'single-address',
      },
      dataSource,
    );

    expect(idsForSegment(projection.rows, 'primary')).toEqual([
      resourceId(OWNER_A, 'eth', 'core-100'),
      resourceId(OWNER_A, 'eth', 'core-50'),
    ]);
    expect(idsForSegment(projection.rows, 'additionalDefault')).toEqual([
      resourceId(OWNER_A, 'eth', 'core-low-1'),
      resourceId(OWNER_A, 'eth', 'core-low-2'),
      resourceId(OWNER_A, 'eth', 'core-low-3'),
      resourceId(OWNER_A, 'eth', 'core-low-4'),
      resourceId(OWNER_A, 'eth', 'plain'),
      resourceId(OWNER_A, 'eth', 'zero-core'),
    ]);
    expect(idsForSegment(projection.rows, 'additionalLp')).toEqual([
      resourceId(OWNER_A, 'eth', 'lp'),
    ]);
    expect(idsForSegment(projection.rows, 'lowValueDefault')).toEqual([
      resourceId(OWNER_A, 'eth', 'low-plain'),
    ]);
    expect(idsForSegment(projection.rows, 'lowValueLp')).toEqual([
      resourceId(OWNER_A, 'eth', 'low-lp'),
    ]);
    expect(projection.resourceIds).not.toContain(
      resourceId(OWNER_A, 'eth', 'risk'),
    );
    expect(projection.resourceIds).not.toContain(
      resourceId(OWNER_A, 'arb', 'other-chain'),
    );
  });

  it('keeps exactly twenty default-visible tokens before overflow', async () => {
    dataSource = await createMemoryAppDataSource();
    const tokens = Array.from({ length: 24 }, (_, index) =>
      createToken({
        id: `core-${String(index).padStart(2, '0')}`,
        usdValue: 100 - index,
      }),
    );
    await dataSource.getRepository(TokenItemEntity).save(tokens);

    const projection = await compileTokenAssetSqlProjection(
      { addresses: [OWNER_A], scene: 'single-address' },
      dataSource,
    );

    expect(idsForSegment(projection.rows, 'primary')).toHaveLength(20);
    expect(idsForSegment(projection.rows, 'additionalDefault')).toEqual(
      [20, 21, 22, 23].map(index =>
        resourceId(OWNER_A, 'eth', `core-${index}`),
      ),
    );
  });

  it('derives projection value from corrected price and amount instead of a stale stored total', async () => {
    dataSource = await createMemoryAppDataSource();
    const token = createToken({ id: 'stale-total', amount: 2, usdValue: 10 });
    await dataSource.getRepository(TokenItemEntity).save(token);
    await dataSource.getRepository(TokenItemEntity).update(token._db_id, {
      usd_value: 999,
    });

    const projection = await compileTokenAssetSqlProjection(
      { addresses: [OWNER_A], scene: 'single-address' },
      dataSource,
    );

    expect(projection.rows[0]).toEqual(
      expect.objectContaining({
        primaryResourceId: resourceId(OWNER_A, 'eth', 'stale-total'),
        totalAmount: 2,
        totalUsdValue: 10,
      }),
    );
  });

  it('restores fractional amounts through SQLite real division', async () => {
    dataSource = await createMemoryAppDataSource();
    await dataSource
      .getRepository(TokenItemEntity)
      .save(createToken({ id: 'fractional', amount: 1.5, usdValue: 3 }));

    const projection = await compileTokenAssetSqlProjection(
      { addresses: [OWNER_A], scene: 'single-address' },
      dataSource,
    );

    expect(projection.rows[0]).toEqual(
      expect.objectContaining({
        primaryResourceId: resourceId(OWNER_A, 'eth', 'fractional'),
        totalAmount: 1.5,
        totalUsdValue: 3,
      }),
    );
  });

  it('uses the normalized value when classifying a stale low-value row', async () => {
    dataSource = await createMemoryAppDataSource();
    const token = createToken({
      id: 'stale-low-value',
      amount: 0,
      usdValue: 0,
      isCore: null,
    });
    await dataSource.getRepository(TokenItemEntity).save(token);
    await dataSource.getRepository(TokenItemEntity).update(token._db_id, {
      amount: 1,
      price: 0,
      usd_value: 999,
    });

    const projection = await compileTokenAssetSqlProjection(
      { addresses: [OWNER_A], scene: 'single-address' },
      dataSource,
    );

    expect(idsForSegment(projection.rows, 'primary')).toEqual([]);
    expect(idsForSegment(projection.rows, 'lowValueDefault')).toEqual([
      resourceId(OWNER_A, 'eth', 'stale-low-value'),
    ]);
  });

  it('aggregates multi-address rows by asset with stable members and totals', async () => {
    dataSource = await createMemoryAppDataSource();
    await dataSource.getRepository(TokenItemEntity).save([
      createToken({
        id: 'usdc',
        owner: OWNER_A,
        amount: 1,
        usdValue: 10,
        symbol: 'USDC',
      }),
      createToken({
        id: 'usdc',
        owner: OWNER_B,
        amount: 2,
        usdValue: 5,
        symbol: 'USDC',
      }),
      createToken({
        id: 'usdc-arb',
        owner: OWNER_B,
        chain: 'arb',
        amount: 3,
        usdValue: 3,
        symbol: 'USDC',
      }),
    ]);

    const projection = await compileTokenAssetSqlProjection(
      {
        addresses: [OWNER_A, OWNER_B],
        scene: 'multi-address',
        tokenDisplayMode: 'byAsset',
      },
      dataSource,
    );
    const ethUsdc = projection.rows.find(row => row.groupKey === 'eth::usdc');

    expect(ethUsdc).toEqual(
      expect.objectContaining({
        primaryResourceId: resourceId(OWNER_A, 'eth', 'usdc'),
        memberResourceIds: [
          resourceId(OWNER_A, 'eth', 'usdc'),
          resourceId(OWNER_B, 'eth', 'usdc'),
        ],
        totalAmount: 3,
        totalUsdValue: 15,
      }),
    );
    expect(projection.rows).toHaveLength(2);
  });

  it('uses normalized symbols for multi-address symbol groups and a stable fallback', async () => {
    dataSource = await createMemoryAppDataSource();
    await dataSource.getRepository(TokenItemEntity).save([
      createToken({
        id: 'eth-usdc',
        owner: OWNER_A,
        symbol: 'USDC',
        optimizedSymbol: ' USD Coin ',
        usdValue: 7,
      }),
      createToken({
        id: 'arb-usdc',
        owner: OWNER_B,
        chain: 'arb',
        symbol: 'usd coin',
        usdValue: 5,
      }),
      createToken({
        id: 'unnamed',
        owner: OWNER_A,
        chain: 'base',
        symbol: '',
        usdValue: 1,
      }),
    ]);

    const projection = await compileTokenAssetSqlProjection(
      {
        addresses: [OWNER_A, OWNER_B],
        scene: 'multi-address',
        tokenDisplayMode: 'bySymbol',
      },
      dataSource,
    );

    expect(projection.rows.find(row => row.groupKey === 'usd coin')).toEqual(
      expect.objectContaining({
        memberResourceIds: [
          resourceId(OWNER_A, 'eth', 'eth-usdc'),
          resourceId(OWNER_B, 'arb', 'arb-usdc'),
        ],
        totalUsdValue: 12,
      }),
    );
    expect(
      projection.rows.find(row => row.groupKey === 'base::unnamed'),
    ).toBeDefined();
  });
});
