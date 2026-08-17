import type {
  AppChainItem,
  ComplexProtocol,
  NFTItem,
  TokenItem,
} from '@rabby-wallet/rabby-api/dist/types';
import type { DataSource } from 'typeorm/browser';

import { createMemoryAppDataSource } from '../../test-support/database/createMemoryAppDataSource';
import { AppChainEntity } from './entities/appchain';
import { NFTItemEntity } from './entities/nftItem';
import { ProtocolItemEntity } from './entities/portocolItem';
import { TokenItemEntity } from './entities/tokenitem';
import { TOKEN_PROJECTION_RESOURCE_ID_INDEX_NAME } from './tokenProjectionResourceId';
import { APP_DB_PREFIX, ORM_TABLE_NAMES } from './constant';
import { ReplaceTokenCacheTable1786867200000 } from './migrations/20260816';
import { ReplaceProtocolCacheTable1786953600000 } from './migrations/20260817_protocol';
import { PROTOCOL_PROJECTION_RESOURCE_ID_INDEX_NAME } from './protocolProjectionResourceId';

const OWNER = '0xAbCd';
const OTHER_OWNER = '0xDeF0';

const tokenResourceId = (owner: string, chain: string, id: string) =>
  `${owner.toLowerCase()}:${chain.toLowerCase()}:${id.toLowerCase()}`;

const protocolResourceId = (owner: string, chain: string, id: string) =>
  `${owner.toLowerCase()}:${chain.toLowerCase()}:${id.toLowerCase()}`;

const nftResourceId = (
  owner: string,
  chain: string,
  collectionId: string,
  id: string,
  innerId: string,
) =>
  [owner, chain, collectionId, id, innerId]
    .map(value => value.toLowerCase())
    .join(':');

const appChainProtocolResourceId = (owner: string, id: string) =>
  `${owner.toLowerCase()}:rabby_app_chain_${id.toLowerCase()}:${id.toLowerCase()}`;

const createToken = (id: string, chain = 'eth', innerId?: string) =>
  ({
    amount: 1,
    chain,
    decimals: 18,
    id,
    ...(innerId ? { inner_id: innerId } : {}),
    name: id,
    price: 1,
    symbol: id,
  } as TokenItem);

const createProtocol = (id: string, chain = 'eth') =>
  ({
    chain,
    id,
    name: id,
    portfolio_item_list: [],
  } as ComplexProtocol);

const createNft = (
  id: string,
  collectionId: string,
  innerId: string,
  chain = 'eth',
) =>
  ({
    chain,
    collection: {},
    collection_id: collectionId,
    id,
    inner_id: innerId,
    token_id: id,
  } as NFTItem);

const createAppChain = (id: string) =>
  ({
    id,
    is_support_portfolio: true,
    is_visible: true,
    name: id,
    portfolio_item_list: [],
  } as AppChainItem);

describe('asset projection resource lookups', () => {
  let dataSource: DataSource | undefined;

  afterEach(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
    dataSource = undefined;
  });

  it('reads only projection-addressed Token, DeFi, AppChain, and NFT entities', async () => {
    dataSource = await createMemoryAppDataSource();

    const targetToken = new TokenItemEntity();
    TokenItemEntity.fillEntity(
      targetToken,
      OWNER,
      createToken('Token-A', 'eth', 'first'),
    );
    const targetTokenInnerRow = new TokenItemEntity();
    TokenItemEntity.fillEntity(
      targetTokenInnerRow,
      OWNER,
      createToken('Token-A', 'eth', 'second'),
    );
    const unrelatedToken = new TokenItemEntity();
    TokenItemEntity.fillEntity(unrelatedToken, OWNER, createToken('Token-B'));
    const otherOwnerToken = new TokenItemEntity();
    TokenItemEntity.fillEntity(
      otherOwnerToken,
      OTHER_OWNER,
      createToken('Token-A'),
    );
    await dataSource
      .getRepository(TokenItemEntity)
      .save([
        targetToken,
        targetTokenInnerRow,
        unrelatedToken,
        otherOwnerToken,
      ]);

    const targetProtocol = new ProtocolItemEntity();
    ProtocolItemEntity.fillEntity(
      targetProtocol,
      OWNER,
      createProtocol('protocol-a'),
    );
    const unrelatedProtocol = new ProtocolItemEntity();
    ProtocolItemEntity.fillEntity(
      unrelatedProtocol,
      OWNER,
      createProtocol('protocol-b'),
    );
    await dataSource
      .getRepository(ProtocolItemEntity)
      .save([targetProtocol, unrelatedProtocol]);

    const targetAppChain = new AppChainEntity();
    AppChainEntity.fillEntity(targetAppChain, OWNER, createAppChain('lending'));
    const unrelatedAppChain = new AppChainEntity();
    AppChainEntity.fillEntity(
      unrelatedAppChain,
      OWNER,
      createAppChain('perps'),
    );
    await dataSource
      .getRepository(AppChainEntity)
      .save([targetAppChain, unrelatedAppChain]);

    const targetNft = new NFTItemEntity();
    NFTItemEntity.fillEntity(
      targetNft,
      OWNER,
      createNft('nft-a', 'eth:collection-a', 'inner-a'),
    );
    const unrelatedNft = new NFTItemEntity();
    NFTItemEntity.fillEntity(
      unrelatedNft,
      OWNER,
      createNft('nft-b', 'eth:collection-b', 'inner-b'),
    );
    await dataSource
      .getRepository(NFTItemEntity)
      .save([targetNft, unrelatedNft]);

    const restoredTokens =
      await TokenItemEntity.batchMultiAddressTokensByResourceIds(
        [tokenResourceId(OWNER, 'eth', 'Token-A')],
        dataSource,
      );
    expect(restoredTokens).toHaveLength(2);
    expect(restoredTokens).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'Token-A',
          inner_id: 'first',
          owner_addr: OWNER,
        }),
        expect.objectContaining({
          id: 'Token-A',
          inner_id: 'second',
          owner_addr: OWNER,
        }),
      ]),
    );

    await expect(
      ProtocolItemEntity.batchMultiAddressProtocolsByResourceIds(
        [protocolResourceId(OWNER, 'eth', 'protocol-a')],
        dataSource,
      ),
    ).resolves.toEqual([
      expect.objectContaining({ id: 'protocol-a', owner_addr: OWNER }),
    ]);

    await expect(
      AppChainEntity.queryByProtocolResourceIds(
        [appChainProtocolResourceId(OWNER, 'lending')],
        dataSource,
      ),
    ).resolves.toEqual({
      [OWNER.toLowerCase()]: [expect.objectContaining({ id: 'lending' })],
    });

    await expect(
      NFTItemEntity.batchMultiAddressNFTsByResourceIds(
        [nftResourceId(OWNER, 'eth', 'eth:collection-a', 'nft-a', 'inner-a')],
        dataSource,
      ),
    ).resolves.toEqual([
      expect.objectContaining({
        collection_id: 'eth:collection-a',
        id: 'nft-a',
        inner_id: 'inner-a',
        owner_addr: OWNER,
      }),
    ]);
  });

  it('deduplicates resource keys and leaves unrelated cache rows untouched', async () => {
    dataSource = await createMemoryAppDataSource();
    const token = new TokenItemEntity();
    TokenItemEntity.fillEntity(token, OWNER, createToken('Token-A'));
    const otherToken = new TokenItemEntity();
    TokenItemEntity.fillEntity(otherToken, OWNER, createToken('Token-B'));
    await dataSource.getRepository(TokenItemEntity).save([token, otherToken]);

    const rows = await TokenItemEntity.batchMultiAddressTokensByResourceIds(
      [
        tokenResourceId(OWNER, 'eth', 'Token-A'),
        tokenResourceId(OWNER, 'ETH', 'TOKEN-A'),
        tokenResourceId(OWNER, 'eth', 'missing'),
      ],
      dataSource,
    );

    expect(rows.map(row => row.id)).toEqual(['Token-A']);
  });

  it('uses the projection resource index for exact token restores', async () => {
    dataSource = await createMemoryAppDataSource();
    const indexes = await dataSource.query(
      `SELECT name FROM sqlite_master WHERE type = 'index' AND name = ?`,
      [TOKEN_PROJECTION_RESOURCE_ID_INDEX_NAME],
    );
    expect(indexes).toEqual([
      { name: TOKEN_PROJECTION_RESOURCE_ID_INDEX_NAME },
    ]);
    const queryPlan = await dataSource.query(
      `EXPLAIN QUERY PLAN SELECT * FROM "${APP_DB_PREFIX}${ORM_TABLE_NAMES.cache_tokenitem}" "tokenitem" WHERE "tokenitem"."projection_resource_id" IN (?)`,
      [tokenResourceId(OWNER, 'eth', 'Token-A')],
    );

    expect(JSON.stringify(queryPlan)).toContain(
      TOKEN_PROJECTION_RESOURCE_ID_INDEX_NAME,
    );
  });

  it('stores protocol projection summaries and uses its resource index', async () => {
    dataSource = await createMemoryAppDataSource();
    const protocol = new ProtocolItemEntity();
    ProtocolItemEntity.fillEntity(
      protocol,
      OWNER,
      {
        ...createProtocol('protocol-a'),
        portfolio_item_list: [
          {
            name: 'Lending',
            pool: { id: 'pool-a' },
            stats: { net_usd_value: 12 },
            asset_token_list: [
              { amount: 2, price: 5 },
              { amount: -1, price: 3 },
            ],
          },
          {
            name: 'Borrowing',
            pool: { id: 'pool-b' },
            asset_token_list: [{ amount: -2, price: 4 }],
          },
        ],
      } as ComplexProtocol,
      7,
    );
    await dataSource.getRepository(ProtocolItemEntity).save(protocol);

    const stored = await dataSource
      .getRepository(ProtocolItemEntity)
      .createQueryBuilder('protocol')
      .addSelect('protocol.projection_resource_id')
      .where('protocol._db_id = :id', { id: protocol._db_id })
      .getOneOrFail();
    expect(stored).toMatchObject({
      projection_resource_id: protocolResourceId(OWNER, 'eth', 'protocol-a'),
      net_worth: 20,
      positive_real_usd_value: 7,
      source_order: 7,
    });

    const indexes = await dataSource.query(
      `SELECT name FROM sqlite_master WHERE type = 'index' AND name = ?`,
      [PROTOCOL_PROJECTION_RESOURCE_ID_INDEX_NAME],
    );
    expect(indexes).toEqual([
      { name: PROTOCOL_PROJECTION_RESOURCE_ID_INDEX_NAME },
    ]);
    const queryPlan = await dataSource.query(
      `EXPLAIN QUERY PLAN SELECT * FROM "${APP_DB_PREFIX}${ORM_TABLE_NAMES.cache_portocolitem}" WHERE "projection_resource_id" IN (?)`,
      [protocolResourceId(OWNER, 'eth', 'protocol-a')],
    );
    expect(JSON.stringify(queryPlan)).toContain(
      PROTOCOL_PROJECTION_RESOURCE_ID_INDEX_NAME,
    );
  });

  it('rebuilds the dated token cache instead of backfilling legacy rows', async () => {
    dataSource = await createMemoryAppDataSource();
    const legacyTableName = `${APP_DB_PREFIX}${ORM_TABLE_NAMES.cache_tokenitem_legacy}`;
    const datedTableName = `${APP_DB_PREFIX}${ORM_TABLE_NAMES.cache_tokenitem}`;
    await dataSource.query(`DROP TABLE "${datedTableName}"`);
    await dataSource.query(
      `CREATE TABLE "${legacyTableName}" (
        "_db_id" text PRIMARY KEY NOT NULL,
        "owner_addr" text NOT NULL,
        "chain" text NOT NULL,
        "id" text NOT NULL
      )`,
    );
    await dataSource.query(
      `INSERT INTO "${legacyTableName}" ("_db_id", "owner_addr", "chain", "id")
       VALUES (?, ?, ?, ?)`,
      ['legacy-token', OWNER, 'ETH', 'Token-A'],
    );

    const queryRunner = dataSource.createQueryRunner();
    try {
      await new ReplaceTokenCacheTable1786867200000().up(queryRunner);
    } finally {
      await queryRunner.release();
    }

    await dataSource.synchronize(false);

    await expect(
      dataSource.query(`SELECT COUNT(*) AS count FROM "${datedTableName}"`),
    ).resolves.toEqual([{ count: 0 }]);
    await expect(
      dataSource.query(
        `SELECT name FROM sqlite_master WHERE type = 'index' AND name = ?`,
        [TOKEN_PROJECTION_RESOURCE_ID_INDEX_NAME],
      ),
    ).resolves.toEqual([{ name: TOKEN_PROJECTION_RESOURCE_ID_INDEX_NAME }]);
  });

  it('drops a surviving legacy table without replacing an existing dated cache', async () => {
    dataSource = await createMemoryAppDataSource();
    const legacyTableName = `${APP_DB_PREFIX}${ORM_TABLE_NAMES.cache_tokenitem_legacy}`;
    const datedTableName = `${APP_DB_PREFIX}${ORM_TABLE_NAMES.cache_tokenitem}`;
    await dataSource.query(
      `CREATE TABLE "${legacyTableName}" ("_db_id" text PRIMARY KEY NOT NULL)`,
    );

    const queryRunner = dataSource.createQueryRunner();
    try {
      await new ReplaceTokenCacheTable1786867200000().up(queryRunner);
    } finally {
      await queryRunner.release();
    }

    await expect(
      dataSource.query(
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (?, ?) ORDER BY name`,
        [legacyTableName, datedTableName],
      ),
    ).resolves.toEqual([{ name: datedTableName }]);
  });

  it('rebuilds the dated protocol cache instead of backfilling legacy rows', async () => {
    dataSource = await createMemoryAppDataSource();
    const legacyTableName = `${APP_DB_PREFIX}${ORM_TABLE_NAMES.cache_portocolitem_legacy}`;
    const datedTableName = `${APP_DB_PREFIX}${ORM_TABLE_NAMES.cache_portocolitem}`;
    await dataSource.query(`DROP TABLE "${datedTableName}"`);
    await dataSource.query(
      `CREATE TABLE "${legacyTableName}" (
        "_db_id" text PRIMARY KEY NOT NULL,
        "owner_addr" text NOT NULL,
        "chain" text NOT NULL,
        "id" text NOT NULL
      )`,
    );
    await dataSource.query(
      `INSERT INTO "${legacyTableName}" ("_db_id", "owner_addr", "chain", "id")
       VALUES (?, ?, ?, ?)`,
      ['legacy-protocol', OWNER, 'eth', 'protocol-a'],
    );

    const queryRunner = dataSource.createQueryRunner();
    try {
      await new ReplaceProtocolCacheTable1786953600000().up(queryRunner);
    } finally {
      await queryRunner.release();
    }
    await dataSource.synchronize(false);

    await expect(
      dataSource.query(`SELECT COUNT(*) AS count FROM "${datedTableName}"`),
    ).resolves.toEqual([{ count: 0 }]);
    await expect(
      dataSource.query(
        `SELECT name FROM sqlite_master WHERE type = 'index' AND name = ?`,
        [PROTOCOL_PROJECTION_RESOURCE_ID_INDEX_NAME],
      ),
    ).resolves.toEqual([{ name: PROTOCOL_PROJECTION_RESOURCE_ID_INDEX_NAME }]);
  });
});
