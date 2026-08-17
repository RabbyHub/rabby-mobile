import type { DataSource } from 'typeorm/browser';

import { createMemoryAppDataSource } from '../../test-support/database/createMemoryAppDataSource';
import { columnConverter } from './entities/_helpers';
import { NFTItemEntity } from './entities/nftItem';
import { compileNftAssetSqlProjection } from './nftAssetProjection';

const OWNER_A = '0xAa';
const OWNER_B = '0xBb';

const nftResourceId = ({
  owner = OWNER_A,
  chain = 'eth',
  collectionId = '',
  id,
  innerId = '',
}: {
  owner?: string;
  chain?: string;
  collectionId?: string;
  id: string;
  innerId?: string;
}) =>
  [owner, chain, collectionId, id, innerId]
    .map(value => value.toLowerCase())
    .join(':');

const createNft = ({
  id,
  owner = OWNER_A,
  chain = 'eth',
  collectionId = '',
  collection,
  innerId = '',
  tokenId = id,
  updatedAt = Date.now(),
}: {
  id: string;
  owner?: string;
  chain?: string;
  collectionId?: string;
  collection?: Record<string, unknown>;
  innerId?: string;
  tokenId?: string;
  updatedAt?: number;
}) => {
  const entity = new NFTItemEntity();
  entity.owner_addr = owner.toLowerCase();
  entity.chain = chain;
  entity.id = id;
  entity.collection_id = collectionId;
  entity.inner_id = innerId;
  entity.token_id = tokenId;
  entity.collection = columnConverter.jsonObjToString(collection || {});
  entity.pay_token = '{}';
  entity._local_created_at = updatedAt;
  entity._local_updated_at = updatedAt;
  entity.makeDbId();
  return entity;
};

describe('NFT asset SQL projection', () => {
  let dataSource: DataSource | undefined;

  afterEach(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
    dataSource = undefined;
  });

  it('groups collections and preserves the existing visibility and score order', async () => {
    dataSource = await createMemoryAppDataSource();
    const coreCollection = {
      id: 'core',
      chain: 'eth',
      credit_score: 10,
      is_core: true,
      is_hidden: false,
      nft_list: [],
    };
    const hiddenCollection = {
      id: 'hidden',
      chain: 'eth',
      credit_score: 100,
      is_core: true,
      is_hidden: true,
      nft_list: [],
    };
    await dataSource.getRepository(NFTItemEntity).save([
      createNft({
        id: 'core-b',
        collectionId: 'eth:core',
        collection: coreCollection,
      }),
      createNft({
        id: 'core-a',
        collectionId: 'eth:core',
        collection: coreCollection,
      }),
      createNft({
        id: 'hidden',
        collectionId: 'eth:hidden',
        collection: hiddenCollection,
      }),
      createNft({
        id: 'standalone',
        collection: {
          credit_score: 50,
          is_core: false,
          is_hidden: false,
          nft_list: [],
        },
      }),
    ]);

    const projection = await compileNftAssetSqlProjection(
      {
        addresses: [OWNER_A],
        scene: 'single-address',
      },
      dataSource,
    );

    expect(projection.defaultVisibleRowCount).toBe(1);
    expect(projection.rows).toEqual([
      {
        type: 'collection',
        collectionId: `${OWNER_A.toLowerCase()}::eth::core`,
        memberNftIds: [
          nftResourceId({
            id: 'core-a',
            collectionId: 'eth:core',
          }),
          nftResourceId({
            id: 'core-b',
            collectionId: 'eth:core',
          }),
        ],
      },
      {
        type: 'collection',
        collectionId: `${OWNER_A.toLowerCase()}::eth::hidden`,
        memberNftIds: [
          nftResourceId({
            id: 'hidden',
            collectionId: 'eth:hidden',
          }),
        ],
      },
      {
        type: 'nft',
        nftId: nftResourceId({ id: 'standalone' }),
      },
    ]);
  });

  it('preserves previous positions when candidates have the same score', async () => {
    dataSource = await createMemoryAppDataSource();
    await dataSource
      .getRepository(NFTItemEntity)
      .save([createNft({ id: 'a' }), createNft({ id: 'b' })]);
    const aId = nftResourceId({ id: 'a' });
    const bId = nftResourceId({ id: 'b' });

    const projection = await compileNftAssetSqlProjection(
      {
        addresses: [OWNER_A],
        scene: 'single-address',
        previousRowKeys: [`nft:${bId}`, `nft:${aId}`],
      },
      dataSource,
    );

    expect(projection.rows).toEqual([
      { type: 'nft', nftId: bId },
      { type: 'nft', nftId: aId },
    ]);
  });

  it('deduplicates resources by the latest committed row', async () => {
    dataSource = await createMemoryAppDataSource();
    await dataSource.getRepository(NFTItemEntity).save([
      createNft({
        id: 'same',
        tokenId: 'old-token-id',
        updatedAt: 10,
        collection: {
          credit_score: 1,
          is_core: false,
          is_hidden: false,
        },
      }),
      createNft({
        id: 'same',
        tokenId: 'new-token-id',
        updatedAt: 20,
        collection: {
          credit_score: 1,
          is_core: true,
          is_hidden: false,
        },
      }),
    ]);

    const projection = await compileNftAssetSqlProjection(
      {
        addresses: [OWNER_A],
        scene: 'single-address',
      },
      dataSource,
    );

    expect(projection.rows).toEqual([
      { type: 'nft', nftId: nftResourceId({ id: 'same' }) },
    ]);
    expect(projection.defaultVisibleRowCount).toBe(1);
  });

  it('applies address and chain selection without mutating cached rows', async () => {
    dataSource = await createMemoryAppDataSource();
    await dataSource
      .getRepository(NFTItemEntity)
      .save([
        createNft({ id: 'eth-a' }),
        createNft({ id: 'arb-a', chain: 'arb' }),
        createNft({ id: 'arb-b', chain: 'arb', owner: OWNER_B }),
      ]);

    const projection = await compileNftAssetSqlProjection(
      {
        addresses: [OWNER_A, OWNER_B],
        chainServerId: 'ARB',
        scene: 'multi-address',
      },
      dataSource,
    );

    expect(projection.rows).toEqual([
      { type: 'nft', nftId: nftResourceId({ id: 'arb-a', chain: 'arb' }) },
      {
        type: 'nft',
        nftId: nftResourceId({ id: 'arb-b', chain: 'arb', owner: OWNER_B }),
      },
    ]);
    expect(await dataSource.getRepository(NFTItemEntity).count()).toBe(3);
  });
});
