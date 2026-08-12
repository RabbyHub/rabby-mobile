import type { NFTItem } from '@rabby-wallet/rabby-api/dist/types';
import type { DataSource } from 'typeorm/browser';

import { createMemoryAppDataSource } from '../../test-support/database/createMemoryAppDataSource';
import { NFTItemEntity } from './entities/nftItem';
import { RepairNftCollectionId1786566001000 } from './migrations/20260813_nft';

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
      id: 'collection-1',
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

  it('repairs collection ids already persisted by older builds', async () => {
    dataSource = await createMemoryAppDataSource();
    const entity = new NFTItemEntity();
    NFTItemEntity.fillEntity(entity, OWNER_ADDRESS, createNft());
    entity.collection_id = CONTRACT_ID;
    await dataSource.getRepository(NFTItemEntity).save(entity);

    const queryRunner = dataSource.createQueryRunner();
    try {
      await new RepairNftCollectionId1786566001000().up(queryRunner);
    } finally {
      await queryRunner.release();
    }

    await expect(
      dataSource
        .getRepository(NFTItemEntity)
        .findOneByOrFail({ _db_id: entity._db_id }),
    ).resolves.toMatchObject({ collection_id: COLLECTION_ID });
  });
});
