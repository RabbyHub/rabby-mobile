import type { DataSource } from 'typeorm/browser';

import { createMemoryAppDataSource } from '../../test-support/database/createMemoryAppDataSource';
import {
  cleanupAssetProjectionGenerations,
  persistAssetProjection,
  restoreLatestAssetProjection,
  type PersistAssetProjectionInput,
} from './assetProjection';
import {
  AssetProjectionGroupItemEntity,
  AssetProjectionItemEntity,
  AssetProjectionSnapshotEntity,
} from './entities/assetProjection';

const PROJECTION_KEY = 'token::single-address::0x1::all';

const roundTripCases: Array<{
  name: string;
  input: PersistAssetProjectionInput;
}> = [
  {
    name: 'single-address Token',
    input: {
      projectionKey: 'token::single::matrix',
      kind: 'token',
      scene: 'single-address',
      rows: [
        { type: 'token', id: 'token-a' },
        { type: 'token', id: 'token-b' },
      ],
      metadata: {
        defaultVisibleTokenCount: 2,
        hasLpTokens: false,
        tokenDisplayMode: 'byAddress',
      },
    },
  },
  {
    name: 'multi-address Token with an aggregation group',
    input: {
      projectionKey: 'token::multi::matrix',
      kind: 'token',
      scene: 'multi-address',
      rows: [
        { type: 'token-group', id: 'token-group-a' },
        { type: 'token', id: 'token-c' },
      ],
      groups: [
        {
          id: 'token-group-a',
          memberIds: ['token-a', 'token-b'],
        },
      ],
      metadata: {
        defaultVisibleTokenCount: 1,
        hasLpTokens: true,
        tokenDisplayMode: 'byAsset',
      },
    },
  },
  {
    name: 'single-address DeFi',
    input: {
      projectionKey: 'protocol::single::matrix',
      kind: 'protocol',
      scene: 'single-address',
      rows: [
        { type: 'protocol', id: 'protocol-a' },
        { type: 'protocol', id: 'protocol-b' },
      ],
    },
  },
  {
    name: 'multi-address DeFi',
    input: {
      projectionKey: 'protocol::multi::matrix',
      kind: 'protocol',
      scene: 'multi-address',
      rows: [
        { type: 'protocol', id: 'protocol-c' },
        { type: 'protocol', id: 'protocol-a' },
      ],
    },
  },
  {
    name: 'single-address NFT with a collection',
    input: {
      projectionKey: 'nft::single::matrix',
      kind: 'nft',
      scene: 'single-address',
      rows: [
        { type: 'nft-collection', id: 'collection-a' },
        { type: 'nft', id: 'nft-c' },
      ],
      groups: [{ id: 'collection-a', memberIds: ['nft-a', 'nft-b'] }],
    },
  },
  {
    name: 'multi-address NFT with owner-isolated collections',
    input: {
      projectionKey: 'nft::multi::matrix',
      kind: 'nft',
      scene: 'multi-address',
      rows: [
        { type: 'nft', id: '0xbbb:nft-c' },
        { type: 'nft-collection', id: '0xaaa:collection-a' },
      ],
      groups: [
        {
          id: '0xaaa:collection-a',
          memberIds: ['0xaaa:nft-a', '0xaaa:nft-b'],
        },
      ],
    },
  },
];

describe('asset projection persistence', () => {
  let dataSource: DataSource | undefined;

  afterEach(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
    dataSource = undefined;
  });

  it.each(roundTripCases)('round-trips $name exactly', async ({ input }) => {
    dataSource = await createMemoryAppDataSource();

    const persisted = await persistAssetProjection(input, dataSource);
    const restored = await restoreLatestAssetProjection(
      input.projectionKey,
      { kind: input.kind, scene: input.scene },
      dataSource,
    );

    expect(persisted.generation).toBe(1);
    expect(restored).toMatchObject({
      projectionKey: input.projectionKey,
      generation: 1,
      kind: input.kind,
      scene: input.scene,
      rows: input.rows,
      groups: input.groups || [],
      metadata: input.metadata || {},
    });
  });

  it('round-trips a valid empty projection', async () => {
    dataSource = await createMemoryAppDataSource();
    await persistAssetProjection(
      {
        projectionKey: 'token::single::empty',
        kind: 'token',
        scene: 'single-address',
        rows: [],
        metadata: { state: 'empty' },
      },
      dataSource,
    );

    await expect(
      restoreLatestAssetProjection(
        'token::single::empty',
        { kind: 'token', scene: 'single-address' },
        dataSource,
      ),
    ).resolves.toMatchObject({
      rows: [],
      groups: [],
      metadata: { state: 'empty' },
    });
  });

  it('keeps single-address and multi-address ordering independent', async () => {
    dataSource = await createMemoryAppDataSource();
    const sharedRuntimeKey = 'same-runtime-key';
    const singleKey = `single:${sharedRuntimeKey}`;
    const multiKey = `multi:${sharedRuntimeKey}`;

    await persistAssetProjection(
      {
        projectionKey: singleKey,
        kind: 'token',
        scene: 'single-address',
        rows: [
          { type: 'token', id: 'shared-a' },
          { type: 'token', id: 'shared-b' },
        ],
      },
      dataSource,
    );
    await persistAssetProjection(
      {
        projectionKey: multiKey,
        kind: 'token',
        scene: 'multi-address',
        rows: [
          { type: 'token', id: 'shared-b' },
          { type: 'token', id: 'shared-a' },
        ],
      },
      dataSource,
    );

    const [single, multi] = await Promise.all([
      restoreLatestAssetProjection(singleKey, {}, dataSource),
      restoreLatestAssetProjection(multiKey, {}, dataSource),
    ]);
    expect(single?.rows.map(row => row.id)).toEqual(['shared-a', 'shared-b']);
    expect(multi?.rows.map(row => row.id)).toEqual(['shared-b', 'shared-a']);
  });

  it('round-trips ordered rows, group members, and metadata', async () => {
    dataSource = await createMemoryAppDataSource();
    const persisted = await persistAssetProjection(
      {
        projectionKey: PROJECTION_KEY,
        kind: 'token',
        scene: 'single-address',
        rows: [
          { type: 'token', id: 'token-a' },
          { type: 'token-group', id: 'group-b' },
          { type: 'token', id: 'token-c' },
        ],
        groups: [{ id: 'group-b', memberIds: ['token-b1', 'token-b2'] }],
        metadata: { defaultVisibleTokenCount: 1, hasLpTokens: true },
      },
      dataSource,
    );

    expect(persisted.generation).toBe(1);
    await expect(
      restoreLatestAssetProjection(
        PROJECTION_KEY,
        { kind: 'token', scene: 'single-address' },
        dataSource,
      ),
    ).resolves.toMatchObject({
      generation: 1,
      rows: [
        { type: 'token', id: 'token-a' },
        { type: 'token-group', id: 'group-b' },
        { type: 'token', id: 'token-c' },
      ],
      groups: [{ id: 'group-b', memberIds: ['token-b1', 'token-b2'] }],
      metadata: { defaultVisibleTokenCount: 1, hasLpTokens: true },
    });
  });

  it('persists large rows and group members below SQLite variable limits', async () => {
    dataSource = await createMemoryAppDataSource();
    const rows = Array.from({ length: 200 }, (_, index) => ({
      type: 'token' as const,
      id: `token-${index}`,
    }));
    const memberIds = Array.from(
      { length: 200 },
      (_, index) => `group-member-${index}`,
    );

    await persistAssetProjection(
      {
        projectionKey: 'token::multi::large-projection',
        kind: 'token',
        scene: 'multi-address',
        rows,
        groups: [{ id: 'large-token-group', memberIds }],
      },
      dataSource,
    );

    await expect(
      restoreLatestAssetProjection(
        'token::multi::large-projection',
        { kind: 'token', scene: 'multi-address' },
        dataSource,
      ),
    ).resolves.toMatchObject({
      rows,
      groups: [{ id: 'large-token-group', memberIds }],
    });
  });

  it('rolls back unpublished rows when snapshot creation fails', async () => {
    dataSource = await createMemoryAppDataSource();
    const circularMetadata: Record<string, unknown> = {};
    circularMetadata.self = circularMetadata;

    await expect(
      persistAssetProjection(
        {
          projectionKey: PROJECTION_KEY,
          kind: 'token',
          scene: 'single-address',
          rows: [{ type: 'token', id: 'token-a' }],
          metadata: circularMetadata,
        },
        dataSource,
      ),
    ).rejects.toThrow();

    await expect(
      dataSource.getRepository(AssetProjectionSnapshotEntity).count(),
    ).resolves.toBe(0);
    await expect(
      dataSource.getRepository(AssetProjectionItemEntity).count(),
    ).resolves.toBe(0);
    await expect(
      dataSource.getRepository(AssetProjectionGroupItemEntity).count(),
    ).resolves.toBe(0);
  });

  it('commits projection prerequisites and snapshot atomically', async () => {
    dataSource = await createMemoryAppDataSource();
    await dataSource.query(
      'CREATE TABLE projection_prerequisite (id text PRIMARY KEY NOT NULL)',
    );

    await expect(
      persistAssetProjection(
        {
          projectionKey: PROJECTION_KEY,
          kind: 'token',
          scene: 'single-address',
          rows: [{ type: 'token', id: 'token-a' }],
          prepareTransaction: async manager => {
            await manager.query(
              'INSERT INTO projection_prerequisite (id) VALUES (?)',
              ['required-token-a'],
            );
          },
        },
        dataSource,
      ),
    ).resolves.toMatchObject({ generation: 1 });
    await expect(
      dataSource.query('SELECT id FROM projection_prerequisite'),
    ).resolves.toEqual([{ id: 'required-token-a' }]);

    await expect(
      persistAssetProjection(
        {
          projectionKey: 'token::single::failed-prerequisite',
          kind: 'token',
          scene: 'single-address',
          rows: [{ type: 'token', id: 'token-b' }],
          prepareTransaction: async manager => {
            await manager.query(
              'INSERT INTO projection_prerequisite (id) VALUES (?)',
              ['required-token-b'],
            );
            throw new Error('prerequisite failed');
          },
        },
        dataSource,
      ),
    ).rejects.toThrow('prerequisite failed');
    await expect(
      dataSource.query(
        'SELECT id FROM projection_prerequisite ORDER BY id ASC',
      ),
    ).resolves.toEqual([{ id: 'required-token-a' }]);
    await expect(
      restoreLatestAssetProjection(
        'token::single::failed-prerequisite',
        {},
        dataSource,
      ),
    ).resolves.toBeNull();
  });

  it('keeps only the latest three complete generations', async () => {
    dataSource = await createMemoryAppDataSource();
    for (let generation = 1; generation <= 5; generation += 1) {
      await persistAssetProjection(
        {
          projectionKey: PROJECTION_KEY,
          kind: 'token',
          scene: 'single-address',
          rows: [{ type: 'token', id: `token-${generation}` }],
          metadata: { generation },
        },
        dataSource,
      );
    }

    const cleanup = await cleanupAssetProjectionGenerations(
      PROJECTION_KEY,
      3,
      dataSource,
    );
    expect(cleanup.deletedGenerations).toEqual([2, 1]);

    const snapshots = await dataSource
      .getRepository(AssetProjectionSnapshotEntity)
      .find({ order: { generation: 'DESC' } });
    expect(snapshots.map(snapshot => snapshot.generation)).toEqual([5, 4, 3]);
    await expect(
      restoreLatestAssetProjection(PROJECTION_KEY, {}, dataSource),
    ).resolves.toMatchObject({
      generation: 5,
      rows: [{ type: 'token', id: 'token-5' }],
    });
  });

  it('does not restore a projection generated by an older display rule', async () => {
    dataSource = await createMemoryAppDataSource();
    await persistAssetProjection(
      {
        projectionKey: PROJECTION_KEY,
        kind: 'token',
        scene: 'single-address',
        rows: [{ type: 'token', id: 'old-visible-token' }],
        ruleVersion: 1,
      },
      dataSource,
    );

    await expect(
      restoreLatestAssetProjection(PROJECTION_KEY, {}, dataSource),
    ).resolves.toBeNull();
  });

  it('rejects an incomplete committed generation', async () => {
    dataSource = await createMemoryAppDataSource();
    await persistAssetProjection(
      {
        projectionKey: PROJECTION_KEY,
        kind: 'token',
        scene: 'single-address',
        rows: [
          { type: 'token', id: 'token-a' },
          { type: 'token', id: 'token-b' },
        ],
      },
      dataSource,
    );
    await dataSource.getRepository(AssetProjectionItemEntity).delete({
      projection_key: PROJECTION_KEY,
      position: 1,
    });

    await expect(
      restoreLatestAssetProjection(PROJECTION_KEY, {}, dataSource),
    ).resolves.toBeNull();
  });

  it('falls back to the previous complete generation', async () => {
    dataSource = await createMemoryAppDataSource();
    await persistAssetProjection(
      {
        projectionKey: PROJECTION_KEY,
        kind: 'token',
        scene: 'single-address',
        rows: [{ type: 'token', id: 'stable-token' }],
      },
      dataSource,
    );
    await persistAssetProjection(
      {
        projectionKey: PROJECTION_KEY,
        kind: 'token',
        scene: 'single-address',
        rows: [
          { type: 'token', id: 'new-token-a' },
          { type: 'token', id: 'new-token-b' },
        ],
      },
      dataSource,
    );
    await dataSource.getRepository(AssetProjectionItemEntity).delete({
      projection_key: PROJECTION_KEY,
      generation: 2,
      position: 1,
    });

    await expect(
      restoreLatestAssetProjection(PROJECTION_KEY, {}, dataSource),
    ).resolves.toMatchObject({
      generation: 1,
      rows: [{ type: 'token', id: 'stable-token' }],
    });
  });
});
