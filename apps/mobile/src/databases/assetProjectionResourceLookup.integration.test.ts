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
import { ASSET_EXPIRED_TIME } from '@/constant/expireTime';

const OWNER = '0xAbCd';
const OTHER_OWNER = '0xDeF0';
const MISSING_OWNER = '0x0000000000000000000000000000000000000000';

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

  it('resolves Token and DeFi expiration for multiple owners in one query shape', async () => {
    dataSource = await createMemoryAppDataSource();
    const now = Date.now();

    const freshToken = new TokenItemEntity();
    TokenItemEntity.fillEntity(
      freshToken,
      OWNER.toLowerCase(),
      createToken('fresh-token'),
    );
    freshToken._local_updated_at = now;
    const staleToken = new TokenItemEntity();
    TokenItemEntity.fillEntity(
      staleToken,
      OTHER_OWNER.toLowerCase(),
      createToken('stale-token'),
    );
    staleToken._local_updated_at = now - ASSET_EXPIRED_TIME - 1;

    const freshProtocol = new ProtocolItemEntity();
    ProtocolItemEntity.fillEntity(
      freshProtocol,
      OWNER.toLowerCase(),
      createProtocol('fresh-protocol'),
    );
    freshProtocol._local_updated_at = now;
    const staleProtocol = new ProtocolItemEntity();
    ProtocolItemEntity.fillEntity(
      staleProtocol,
      OTHER_OWNER.toLowerCase(),
      createProtocol('stale-protocol'),
    );
    staleProtocol._local_updated_at = now - ASSET_EXPIRED_TIME - 1;

    await dataSource
      .getRepository(TokenItemEntity)
      .save([freshToken, staleToken]);
    await dataSource
      .getRepository(ProtocolItemEntity)
      .save([freshProtocol, staleProtocol]);

    expect(
      await TokenItemEntity.getExpirationByOwners(
        [OWNER, OTHER_OWNER, MISSING_OWNER, OWNER.toLowerCase()],
        dataSource,
      ),
    ).toEqual({
      [OWNER.toLowerCase()]: false,
      [OTHER_OWNER.toLowerCase()]: true,
      [MISSING_OWNER]: true,
    });
    expect(
      await ProtocolItemEntity.getExpirationByOwners(
        [OWNER, OTHER_OWNER, MISSING_OWNER],
        dataSource,
      ),
    ).toEqual({
      [OWNER.toLowerCase()]: false,
      [OTHER_OWNER.toLowerCase()]: true,
      [MISSING_OWNER]: true,
    });
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
});
