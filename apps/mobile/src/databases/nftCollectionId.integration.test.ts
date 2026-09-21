import type { NFTItem } from '@rabby-wallet/rabby-api/dist/types';
import type { DataSource } from 'typeorm/browser';

import { createMemoryAppDataSource } from '../../test-support/database/createMemoryAppDataSource';
import { APP_DB_PREFIX, ORM_TABLE_NAMES } from './constant';
import { NFTItemEntity } from './entities/nftItem';
import { ReplaceNftCacheTable1786566001000 } from './migrations/20260813_nft';

const OWNER_ADDRESS = '0x0000000000000000000000000000000000000001';
const COLLECTION_ID = 'eth:collection-1';
const CONTRACT_ID = '0x0000000000000000000000000000000000000002';

const createNft = () =>
  ({
    chain: 'eth',
    id: 'nft-1',
    token_id: '1',
    contract_id: CONTRACT_ID,
    collection_id: COLLECTION_ID,
    collection: {
      chain: 'eth',
      credit_score: 88,
      id: 'collection-1',
      native_token: {
        decimals: 18,
        id: 'eth',
        price: 3000,
        symbol: 'ETH',
      },
      receive_addr_count: 7,
    },
  } as unknown as NFTItem);

describe('NFT collection id persistence', () => {
  let dataSource: DataSource | undefined;

  afterEach(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
    dataSource = undefined;
  });

  it('stores the API collection id instead of the contract id', () => {
    const entity = new NFTItemEntity();
    NFTItemEntity.fillEntity(entity, OWNER_ADDRESS, createNft());

    expect(entity.collection_id).toBe(COLLECTION_ID);
    expect(entity.collection_id).not.toBe(CONTRACT_ID);
  });

  it('round-trips collection ordering and display metadata through SQLite', async () => {
    dataSource = await createMemoryAppDataSource();
    const entity = new NFTItemEntity();
    NFTItemEntity.fillEntity(entity, OWNER_ADDRESS, createNft());

    await dataSource.getRepository(NFTItemEntity).save(entity);
    const restored = await dataSource
      .getRepository(NFTItemEntity)
      .findOneByOrFail({ _db_id: entity._db_id });
    const collection = JSON.parse(restored.collection);

    expect(collection).toEqual(
      expect.objectContaining({
        chain: 'eth',
        credit_score: 88,
        id: 'collection-1',
        receive_addr_count: 7,
      }),
    );
    expect(collection.native_token).toEqual(
      expect.objectContaining({ symbol: 'ETH' }),
    );
  });

  it('drops the polluted legacy cache instead of migrating ambiguous rows', async () => {
    dataSource = await createMemoryAppDataSource();
    const legacyTable = `${APP_DB_PREFIX}${ORM_TABLE_NAMES.cache_nftitem_legacy}`;
    await dataSource.query(
      `CREATE TABLE IF NOT EXISTS "${legacyTable}" (_db_id TEXT PRIMARY KEY, collection_id TEXT)`,
    );
    await dataSource.query(
      `INSERT INTO "${legacyTable}" (_db_id, collection_id) VALUES (?, ?)`,
      ['legacy-nft', CONTRACT_ID],
    );

    const queryRunner = dataSource.createQueryRunner();
    try {
      await new ReplaceNftCacheTable1786566001000().up(queryRunner);
    } finally {
      await queryRunner.release();
    }

    await expect(
      dataSource.query(
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`,
        [legacyTable],
      ),
    ).resolves.toEqual([]);
    expect(dataSource.getRepository(NFTItemEntity).metadata.tableName).toBe(
      `${APP_DB_PREFIX}${ORM_TABLE_NAMES.cache_nftitem}`,
    );
  });
});
