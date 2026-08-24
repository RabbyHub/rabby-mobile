import { In, type DataSource, type EntityManager } from 'typeorm/browser';

import {
  AssetProjectionGroupItemEntity,
  AssetProjectionItemEntity,
  AssetProjectionSnapshotEntity,
  type AssetProjectionKind,
  type AssetProjectionRowType,
  type AssetProjectionScene,
} from './entities/assetProjection';
import { prepareAppDataSource } from './imports';

export const ASSET_PROJECTION_RULE_VERSION = 4;
export const ASSET_PROJECTION_GENERATIONS_TO_KEEP = 3;

// Projection rows have at most five persisted columns. Keep one insert below SQLite's
// conservative 999-variable limit while preserving one transaction per generation.
const ASSET_PROJECTION_INSERT_BATCH_SIZE = 100;

export type AssetProjectionRow = {
  type: AssetProjectionRowType;
  id: string;
};

export type AssetProjectionGroup = {
  id: string;
  memberIds: string[];
};

export type PersistAssetProjectionInput = {
  projectionKey: string;
  kind: AssetProjectionKind;
  scene: AssetProjectionScene;
  rows: AssetProjectionRow[];
  groups?: AssetProjectionGroup[];
  metadata?: Record<string, unknown>;
  ruleVersion?: number;
  prepareTransaction?: (manager: EntityManager) => Promise<void> | void;
};

export type RestoredAssetProjection = {
  projectionKey: string;
  generation: number;
  kind: AssetProjectionKind;
  scene: AssetProjectionScene;
  ruleVersion: number;
  rows: AssetProjectionRow[];
  groups: AssetProjectionGroup[];
  metadata: Record<string, unknown>;
  committedAt: number;
};

type RestoreAssetProjectionOptions = {
  ruleVersion?: number;
  kind?: AssetProjectionKind;
  scene?: AssetProjectionScene;
};

const resolveDataSource = async (dataSource?: DataSource) =>
  dataSource || prepareAppDataSource();

const assertProjectionInput = (input: PersistAssetProjectionInput) => {
  if (!input.projectionKey) {
    throw new Error('Asset projection key is required');
  }
  input.rows.forEach((row, position) => {
    if (!row.id) {
      throw new Error(`Asset projection row ${position} has no id`);
    }
  });
  input.groups?.forEach(group => {
    if (!group.id) {
      throw new Error('Asset projection group has no id');
    }
    group.memberIds.forEach((memberId, position) => {
      if (!memberId) {
        throw new Error(
          `Asset projection group ${group.id} member ${position} has no id`,
        );
      }
    });
  });
};

const parseMetadata = (metadataJson: string) => {
  try {
    const parsed: unknown = JSON.parse(metadataJson);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return null;
  }
};

const insertInBatches = async <T>(
  values: readonly T[],
  insert: (batch: T[]) => Promise<unknown>,
) => {
  for (
    let start = 0;
    start < values.length;
    start += ASSET_PROJECTION_INSERT_BATCH_SIZE
  ) {
    await insert(
      values.slice(start, start + ASSET_PROJECTION_INSERT_BATCH_SIZE),
    );
  }
};

const deleteStaleAssetProjectionGenerations = async (
  manager: EntityManager,
  projectionKey: string,
  generationsToKeep: number,
) => {
  const retainCount = Math.max(1, Math.floor(generationsToKeep));
  const snapshotRepository = manager.getRepository(
    AssetProjectionSnapshotEntity,
  );
  const itemRepository = manager.getRepository(AssetProjectionItemEntity);
  const groupItemRepository = manager.getRepository(
    AssetProjectionGroupItemEntity,
  );
  const snapshots = await snapshotRepository.find({
    where: { projection_key: projectionKey },
    order: { generation: 'DESC' },
  });
  const staleSnapshots = snapshots.slice(retainCount);
  const staleSnapshotIds = staleSnapshots.map(snapshot => snapshot._db_id);

  if (staleSnapshotIds.length) {
    await groupItemRepository.delete({
      snapshot_id: In(staleSnapshotIds),
    });
    await itemRepository.delete({
      snapshot_id: In(staleSnapshotIds),
    });
    await snapshotRepository.delete({
      _db_id: In(staleSnapshotIds),
    });
  }

  return staleSnapshots.map(snapshot => snapshot.generation);
};

export async function persistAssetProjection(
  input: PersistAssetProjectionInput,
  dataSource?: DataSource,
) {
  assertProjectionInput(input);
  const source = await resolveDataSource(dataSource);
  const ruleVersion = input.ruleVersion ?? ASSET_PROJECTION_RULE_VERSION;

  return source.transaction(async manager => {
    await input.prepareTransaction?.(manager);

    const snapshotRepository = manager.getRepository(
      AssetProjectionSnapshotEntity,
    );
    const itemRepository = manager.getRepository(AssetProjectionItemEntity);
    const groupItemRepository = manager.getRepository(
      AssetProjectionGroupItemEntity,
    );
    const rawGeneration = await snapshotRepository
      .createQueryBuilder('snapshot')
      .select('MAX(snapshot.generation)', 'maxGeneration')
      .where('snapshot.projection_key = :projectionKey', {
        projectionKey: input.projectionKey,
      })
      .getRawOne<{ maxGeneration?: number | string | null }>();
    const generation = Number(rawGeneration?.maxGeneration || 0) + 1;

    // Keep serialization inside the transaction: a malformed metadata value
    // must roll back the complete generation.
    const metadataJson = JSON.stringify(input.metadata || {});
    const committedAt = Date.now();
    const groupItemCount = (input.groups || []).reduce(
      (count, group) => count + group.memberIds.length,
      0,
    );
    const snapshot = await snapshotRepository.save(
      snapshotRepository.create({
        projection_key: input.projectionKey,
        generation,
        projection_kind: input.kind,
        scene: input.scene,
        rule_version: ruleVersion,
        item_count: input.rows.length,
        group_item_count: groupItemCount,
        metadata_json: metadataJson,
        committed_at: committedAt,
      }),
    );
    if (!Number.isSafeInteger(snapshot._db_id) || snapshot._db_id <= 0) {
      throw new Error('Asset projection snapshot id is invalid');
    }

    const items = input.rows.map((row, position) =>
      itemRepository.create({
        snapshot_id: snapshot._db_id,
        position,
        row_type: row.type,
        row_id: row.id,
      }),
    );
    if (items.length) {
      await insertInBatches(items, batch => itemRepository.insert(batch));
    }

    const groupItems = (input.groups || []).flatMap(group =>
      group.memberIds.map((memberId, position) =>
        groupItemRepository.create({
          snapshot_id: snapshot._db_id,
          group_id: group.id,
          position,
          member_id: memberId,
        }),
      ),
    );
    if (groupItems.length) {
      await insertInBatches(groupItems, batch =>
        groupItemRepository.insert(batch),
      );
    }

    // Retention is part of the generation commit. A newer projection may
    // supersede its scheduling task immediately after this transaction, but
    // it must never leave an extra generation behind.
    await deleteStaleAssetProjectionGenerations(
      manager,
      input.projectionKey,
      ASSET_PROJECTION_GENERATIONS_TO_KEEP,
    );

    return { generation, committedAt };
  });
}

export async function restoreLatestAssetProjection(
  projectionKey: string,
  options: RestoreAssetProjectionOptions = {},
  dataSource?: DataSource,
): Promise<RestoredAssetProjection | null> {
  const source = await resolveDataSource(dataSource);
  const ruleVersion = options.ruleVersion ?? ASSET_PROJECTION_RULE_VERSION;
  const snapshotRepository = source.getRepository(
    AssetProjectionSnapshotEntity,
  );
  const snapshots = await snapshotRepository.find({
    where: {
      projection_key: projectionKey,
      rule_version: ruleVersion,
      ...(options.kind ? { projection_kind: options.kind } : {}),
      ...(options.scene ? { scene: options.scene } : {}),
    },
    order: { generation: 'DESC' },
    take: ASSET_PROJECTION_GENERATIONS_TO_KEEP,
  });

  for (const snapshot of snapshots) {
    const [items, groupItems] = await Promise.all([
      source.getRepository(AssetProjectionItemEntity).find({
        where: {
          snapshot_id: snapshot._db_id,
        },
        order: { position: 'ASC' },
      }),
      source.getRepository(AssetProjectionGroupItemEntity).find({
        where: {
          snapshot_id: snapshot._db_id,
        },
        order: { group_id: 'ASC', position: 'ASC' },
      }),
    ]);
    if (
      items.length !== snapshot.item_count ||
      groupItems.length !== snapshot.group_item_count
    ) {
      continue;
    }

    const metadata = parseMetadata(snapshot.metadata_json);
    if (!metadata) {
      continue;
    }

    const membersByGroup = new Map<string, string[]>();
    groupItems.forEach(item => {
      const members = membersByGroup.get(item.group_id) || [];
      members.push(item.member_id);
      membersByGroup.set(item.group_id, members);
    });
    const groupOrder = items
      .filter(item => ['token-group', 'nft-collection'].includes(item.row_type))
      .map(item => item.row_id);
    const remainingGroupIds = Array.from(membersByGroup.keys()).filter(
      groupId => !groupOrder.includes(groupId),
    );

    return {
      projectionKey,
      generation: snapshot.generation,
      kind: snapshot.projection_kind,
      scene: snapshot.scene,
      ruleVersion: snapshot.rule_version,
      rows: items.map(item => ({ type: item.row_type, id: item.row_id })),
      groups: [...groupOrder, ...remainingGroupIds].map(groupId => ({
        id: groupId,
        memberIds: membersByGroup.get(groupId) || [],
      })),
      metadata,
      committedAt: snapshot.committed_at,
    };
  }

  return null;
}

export async function cleanupAssetProjectionGenerations(
  projectionKey: string,
  generationsToKeep = ASSET_PROJECTION_GENERATIONS_TO_KEEP,
  dataSource?: DataSource,
) {
  const source = await resolveDataSource(dataSource);

  return source.transaction(async manager => {
    const deletedGenerations = await deleteStaleAssetProjectionGenerations(
      manager,
      projectionKey,
      generationsToKeep,
    );
    const snapshotRepository = manager.getRepository(
      AssetProjectionSnapshotEntity,
    );
    const itemRepository = manager.getRepository(AssetProjectionItemEntity);
    const groupItemRepository = manager.getRepository(
      AssetProjectionGroupItemEntity,
    );

    const snapshotTable = snapshotRepository.metadata.tableName;
    const itemTable = itemRepository.metadata.tableName;
    const groupItemTable = groupItemRepository.metadata.tableName;
    const orphanPredicate = `snapshot_id NOT IN (
      SELECT snapshot._db_id FROM "${snapshotTable}" snapshot
    )`;
    const orphanItems = await manager.query(
      `DELETE FROM "${itemTable}" WHERE ${orphanPredicate}`,
    );
    const orphanGroupItems = await manager.query(
      `DELETE FROM "${groupItemTable}" WHERE ${orphanPredicate}`,
    );

    return {
      deletedGenerations,
      orphanItems,
      orphanGroupItems,
    };
  });
}
