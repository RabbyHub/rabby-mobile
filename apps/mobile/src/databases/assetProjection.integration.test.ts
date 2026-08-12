import type { DataSource } from 'typeorm/browser';

import { createMemoryAppDataSource } from '../../test-support/database/createMemoryAppDataSource';
import {
  cleanupAssetProjectionGenerations,
  persistAssetProjection,
  restoreLatestAssetProjection,
} from './assetProjection';
import {
  AssetProjectionGroupItemEntity,
  AssetProjectionItemEntity,
  AssetProjectionSnapshotEntity,
} from './entities/assetProjection';

const PROJECTION_KEY = 'token::single-address::0x1::all';

describe('asset projection persistence', () => {
  let dataSource: DataSource | undefined;

  afterEach(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
    dataSource = undefined;
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
        metadata: { hasLpTokens: true },
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
      metadata: { hasLpTokens: true },
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
});
