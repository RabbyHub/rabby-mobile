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

export const ASSET_PROJECTION_RULE_VERSION = 3;
export const ASSET_PROJECTION_GENERATIONS_TO_KEEP = 3;

// Projection rows have six persisted columns. Keep one insert below SQLite's
// conservative 999-variable limit while preserving one transaction per generation.
const ASSET_PROJECTION_INSERT_BATCH_SIZE = 100;
const ASSET_PROJECTION_GROUP_QUERY_BATCH_SIZE = 200;

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
  totalRowCount: number;
  loadedRowRanges: AssetProjectionRowRange[];
};

export type AssetProjectionRowRange = {
  offset: number;
  count: number;
};

export type AssetProjectionSnapshotInfo = {
  projectionKey: string;
  generation: number;
  kind: AssetProjectionKind;
  scene: AssetProjectionScene;
  ruleVersion: number;
  itemCount: number;
  metadata: Record<string, unknown>;
  committedAt: number;
};

export type RestoredAssetProjectionRows = {
  projectionKey: string;
  generation: number;
  rows: AssetProjectionRow[];
  groups: AssetProjectionGroup[];
  loadedRowRanges: AssetProjectionRowRange[];
};

type RestoreAssetProjectionOptions = {
  ruleVersion?: number;
  kind?: AssetProjectionKind;
  scene?: AssetProjectionScene;
  selectRowRanges?: (
    snapshot: AssetProjectionSnapshotInfo,
  ) => AssetProjectionRowRange[] | null | undefined;
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

const normalizeRowRanges = (
  ranges: AssetProjectionRowRange[] | undefined,
  itemCount: number,
) => {
  const requestedRanges = ranges || [{ offset: 0, count: itemCount }];
  const normalized = requestedRanges
    .map(range => ({ offset: range.offset, count: range.count }))
    .sort((left, right) => left.offset - right.offset);

  let previousEnd = 0;
  for (const range of normalized) {
    const end = range.offset + range.count;
    if (
      !Number.isInteger(range.offset) ||
      !Number.isInteger(range.count) ||
      range.offset < 0 ||
      range.count < 0 ||
      end > itemCount ||
      range.offset < previousEnd
    ) {
      return null;
    }
    previousEnd = end;
  }

  return normalized.filter(range => range.count > 0);
};

const countProjectionRows = async (
  source: DataSource,
  projectionKey: string,
  generation: number,
) => {
  const [itemCount, groupItemCount] = await Promise.all([
    source.getRepository(AssetProjectionItemEntity).count({
      where: { projection_key: projectionKey, generation },
    }),
    source.getRepository(AssetProjectionGroupItemEntity).count({
      where: { projection_key: projectionKey, generation },
    }),
  ]);
  return { itemCount, groupItemCount };
};

const readProjectionRows = async (
  source: DataSource,
  projectionKey: string,
  generation: number,
  ranges: AssetProjectionRowRange[],
  includeUnreferencedGroups = false,
): Promise<RestoredAssetProjectionRows> => {
  const itemRepository = source.getRepository(AssetProjectionItemEntity);
  const groupItemRepository = source.getRepository(
    AssetProjectionGroupItemEntity,
  );
  const rows = ranges.length
    ? await itemRepository
        .createQueryBuilder('item')
        .select(['item.position', 'item.row_type', 'item.row_id'])
        .where('item.projection_key = :projectionKey', { projectionKey })
        .andWhere('item.generation = :generation', { generation })
        .andWhere(
          `(${ranges
            .map(
              (_, index) =>
                `(item.position >= :rangeStart${index} AND item.position < :rangeEnd${index})`,
            )
            .join(' OR ')})`,
          Object.fromEntries(
            ranges.flatMap((range, index) => [
              [`rangeStart${index}`, range.offset],
              [`rangeEnd${index}`, range.offset + range.count],
            ]),
          ),
        )
        .orderBy('item.position', 'ASC')
        .getMany()
    : [];
  const expectedRowCount = ranges.reduce(
    (total, range) => total + range.count,
    0,
  );
  if (rows.length !== expectedRowCount) {
    return {
      projectionKey,
      generation,
      rows: [],
      groups: [],
      loadedRowRanges: [],
    };
  }

  const referencedGroupIds = Array.from(
    new Set(
      rows
        .filter(item =>
          ['token-group', 'nft-collection'].includes(item.row_type),
        )
        .map(item => item.row_id),
    ),
  );
  const groupItems: AssetProjectionGroupItemEntity[] = includeUnreferencedGroups
    ? await groupItemRepository.find({
        where: { projection_key: projectionKey, generation },
        order: { group_id: 'ASC', position: 'ASC' },
      })
    : [];
  if (!includeUnreferencedGroups) {
    for (
      let start = 0;
      start < referencedGroupIds.length;
      start += ASSET_PROJECTION_GROUP_QUERY_BATCH_SIZE
    ) {
      const batchGroupIds = referencedGroupIds.slice(
        start,
        start + ASSET_PROJECTION_GROUP_QUERY_BATCH_SIZE,
      );
      groupItems.push(
        ...(await groupItemRepository.find({
          where: {
            projection_key: projectionKey,
            generation,
            group_id: In(batchGroupIds),
          },
          order: { group_id: 'ASC', position: 'ASC' },
        })),
      );
    }
  }
  const membersByGroup = new Map<string, string[]>();
  groupItems.forEach(item => {
    const members = membersByGroup.get(item.group_id) || [];
    members.push(item.member_id);
    membersByGroup.set(item.group_id, members);
  });

  const remainingGroupIds = includeUnreferencedGroups
    ? Array.from(membersByGroup.keys()).filter(
        groupId => !referencedGroupIds.includes(groupId),
      )
    : [];

  return {
    projectionKey,
    generation,
    rows: rows.map(item => ({ type: item.row_type, id: item.row_id })),
    groups: [...referencedGroupIds, ...remainingGroupIds].map(groupId => ({
      id: groupId,
      memberIds: membersByGroup.get(groupId) || [],
    })),
    loadedRowRanges: ranges,
  };
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

    const items = input.rows.map((row, position) =>
      itemRepository.create({
        _db_id: AssetProjectionItemEntity.buildDbId(
          input.projectionKey,
          generation,
          position,
        ),
        projection_key: input.projectionKey,
        generation,
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
          _db_id: AssetProjectionGroupItemEntity.buildDbId(
            input.projectionKey,
            generation,
            group.id,
            position,
          ),
          projection_key: input.projectionKey,
          generation,
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

    // Keep serialization inside the transaction: a malformed metadata value
    // must roll back item rows rather than leave an unpublished generation.
    const metadataJson = JSON.stringify(input.metadata || {});
    const committedAt = Date.now();
    await snapshotRepository.insert(
      snapshotRepository.create({
        _db_id: AssetProjectionSnapshotEntity.buildDbId(
          input.projectionKey,
          generation,
        ),
        projection_key: input.projectionKey,
        generation,
        projection_kind: input.kind,
        scene: input.scene,
        rule_version: ruleVersion,
        item_count: items.length,
        group_item_count: groupItems.length,
        metadata_json: metadataJson,
        committed_at: committedAt,
      }),
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
    const counts = await countProjectionRows(
      source,
      projectionKey,
      snapshot.generation,
    );
    if (
      counts.itemCount !== snapshot.item_count ||
      counts.groupItemCount !== snapshot.group_item_count
    ) {
      continue;
    }

    const metadata = parseMetadata(snapshot.metadata_json);
    if (!metadata) {
      continue;
    }
    const snapshotInfo: AssetProjectionSnapshotInfo = {
      projectionKey,
      generation: snapshot.generation,
      kind: snapshot.projection_kind,
      scene: snapshot.scene,
      ruleVersion: snapshot.rule_version,
      itemCount: snapshot.item_count,
      metadata,
      committedAt: snapshot.committed_at,
    };
    const selectedRanges = options.selectRowRanges?.(snapshotInfo);
    if (selectedRanges === null) {
      continue;
    }
    const rowRanges = normalizeRowRanges(selectedRanges, snapshot.item_count);
    if (!rowRanges) {
      continue;
    }
    const restoredRows = await readProjectionRows(
      source,
      projectionKey,
      snapshot.generation,
      rowRanges,
      selectedRanges === undefined,
    );
    if (
      restoredRows.rows.length !==
      rowRanges.reduce((total, range) => total + range.count, 0)
    ) {
      continue;
    }

    return {
      projectionKey,
      generation: snapshot.generation,
      kind: snapshot.projection_kind,
      scene: snapshot.scene,
      ruleVersion: snapshot.rule_version,
      rows: restoredRows.rows,
      groups: restoredRows.groups,
      metadata,
      committedAt: snapshot.committed_at,
      totalRowCount: snapshot.item_count,
      loadedRowRanges: rowRanges,
    };
  }

  return null;
}

export async function restoreAssetProjectionGenerationRows(
  projectionKey: string,
  generation: number,
  requestedRanges: AssetProjectionRowRange[],
  dataSource?: DataSource,
): Promise<RestoredAssetProjectionRows | null> {
  const source = await resolveDataSource(dataSource);
  const snapshot = await source
    .getRepository(AssetProjectionSnapshotEntity)
    .findOne({
      where: { projection_key: projectionKey, generation },
    });
  if (!snapshot) {
    return null;
  }

  const ranges = normalizeRowRanges(requestedRanges, snapshot.item_count);
  if (!ranges) {
    return null;
  }
  const counts = await countProjectionRows(source, projectionKey, generation);
  if (
    counts.itemCount !== snapshot.item_count ||
    counts.groupItemCount !== snapshot.group_item_count
  ) {
    return null;
  }

  const restored = await readProjectionRows(
    source,
    projectionKey,
    generation,
    ranges,
  );
  const expectedRowCount = ranges.reduce(
    (total, range) => total + range.count,
    0,
  );
  return restored.rows.length === expectedRowCount ? restored : null;
}

export async function cleanupAssetProjectionGenerations(
  projectionKey: string,
  generationsToKeep = ASSET_PROJECTION_GENERATIONS_TO_KEEP,
  dataSource?: DataSource,
) {
  const source = await resolveDataSource(dataSource);
  const retainCount = Math.max(1, Math.floor(generationsToKeep));

  return source.transaction(async manager => {
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
    const staleGenerations = snapshots
      .slice(retainCount)
      .map(snapshot => snapshot.generation);

    if (staleGenerations.length) {
      await groupItemRepository.delete({
        projection_key: projectionKey,
        generation: In(staleGenerations),
      });
      await itemRepository.delete({
        projection_key: projectionKey,
        generation: In(staleGenerations),
      });
      await snapshotRepository.delete({
        projection_key: projectionKey,
        generation: In(staleGenerations),
      });
    }

    const snapshotTable = snapshotRepository.metadata.tableName;
    const itemTable = itemRepository.metadata.tableName;
    const groupItemTable = groupItemRepository.metadata.tableName;
    const orphanParams = [projectionKey, projectionKey];
    const orphanPredicate = `projection_key = ? AND generation NOT IN (
      SELECT snapshot.generation FROM "${snapshotTable}" snapshot
      WHERE snapshot.projection_key = ?
    )`;
    const orphanItems = await manager.query(
      `DELETE FROM "${itemTable}" WHERE ${orphanPredicate}`,
      orphanParams,
    );
    const orphanGroupItems = await manager.query(
      `DELETE FROM "${groupItemTable}" WHERE ${orphanPredicate}`,
      orphanParams,
    );

    return {
      deletedGenerations: staleGenerations,
      orphanItems,
      orphanGroupItems,
    };
  });
}
