import { traceStartupDiagnostic } from '@/core/utils/startupDiagnostics';
import { OPSQLiteEvents } from '@/core/databases/op-sqlite/events';
import {
  ASSET_PROJECTION_INSERT_BATCH_SIZE,
  ASSET_PROJECTION_GENERATIONS_TO_KEEP,
  cleanupAssetProjectionGenerations,
  persistAssetProjection,
  restoreAssetProjectionGenerationRows,
  restoreLatestAssetProjection,
  type AssetProjectionRowRange,
  type AssetProjectionSnapshotInfo,
  type PersistAssetProjectionInput,
} from '@/databases/assetProjection';
import { APP_DB_PREFIX, ORM_TABLE_NAMES } from '@/databases/constant';
import { AssetProjectionSnapshotEntity } from '@/databases/entities/assetProjection';
import { registerSyncAbortHandler } from '@/databases/sync/abort';
import {
  isSyncTaskAbortError,
  submitSyncTask,
  SyncTaskAbortError,
} from '@/databases/sync/scheduler';
import {
  buildAssetProjectionStorageKey,
  type AssetProjectionIdentity,
} from './assetProjectionIdentity';

export { buildAssetProjectionStorageKey } from './assetProjectionIdentity';

export type ScheduledAssetProjectionInput = Omit<
  PersistAssetProjectionInput,
  'projectionKey'
> &
  AssetProjectionIdentity;

const activeProjectionControllers = new Map<string, AbortController>();
const activeProjectionFingerprints = new Map<string, string>();
const persistedProjectionFingerprints = new Map<string, string>();
const projectionSnapshotTable = `${APP_DB_PREFIX}${ORM_TABLE_NAMES.projection_snapshot}`;

const buildProjectionFingerprint = (input: ScheduledAssetProjectionInput) =>
  JSON.stringify({
    kind: input.kind,
    scene: input.scene,
    ruleVersion: input.ruleVersion,
    rows: input.rows,
    groups: input.groups || [],
    metadata: input.metadata || {},
  });

const ensureNotAborted = (signal: AbortSignal) => {
  if (signal.aborted) {
    throw new SyncTaskAbortError();
  }
};

registerSyncAbortHandler(() => {
  activeProjectionControllers.forEach(controller => controller.abort());
  activeProjectionControllers.clear();
  activeProjectionFingerprints.clear();
  persistedProjectionFingerprints.clear();
});

export const scheduleAssetProjectionPersistence = (
  input: ScheduledAssetProjectionInput,
) => {
  const projectionKey = buildAssetProjectionStorageKey(input);
  const fingerprint = buildProjectionFingerprint(input);
  if (
    activeProjectionFingerprints.get(projectionKey) === fingerprint ||
    persistedProjectionFingerprints.get(projectionKey) === fingerprint
  ) {
    return undefined;
  }
  const { runtimeKey: _runtimeKey, ...persistInput } = input;
  activeProjectionControllers.get(projectionKey)?.abort();

  const controller = new AbortController();
  activeProjectionControllers.set(projectionKey, controller);
  activeProjectionFingerprints.set(projectionKey, fingerprint);
  const groupItemCount = (input.groups || []).reduce(
    (count, group) => count + group.memberIds.length,
    0,
  );
  const rowCount = input.rows.length + groupItemCount;
  const totalBatches = Math.max(
    1,
    Math.ceil(input.rows.length / ASSET_PROJECTION_INSERT_BATCH_SIZE) +
      Math.ceil(groupItemCount / ASSET_PROJECTION_INSERT_BATCH_SIZE),
  );
  const { taskId, promise } = submitSyncTask({
    key: `asset-projection:${projectionKey}`,
    taskFor: 'asset-projection',
    owner: projectionKey,
    entityName: AssetProjectionSnapshotEntity.name,
    rowCount,
    batchSize: ASSET_PROJECTION_INSERT_BATCH_SIZE,
    totalBatches,
    priority: 'low',
    signal: controller.signal,
    runner: async ctx => {
      const startedAt = Date.now();
      await ctx.waitIfPaused();
      ensureNotAborted(controller.signal);
      ctx.setStage('persist_projection', {
        kind: input.kind,
        scene: input.scene,
      });
      const persisted = await persistAssetProjection({
        ...persistInput,
        projectionKey,
      });
      traceStartupDiagnostic('asset_projection', 'persist_metrics', {
        kind: input.kind,
        scene: input.scene,
        rowCount,
        ...persisted.metrics,
      });
      ensureNotAborted(controller.signal);
      ctx.setStage('cleanup_projection_generations', {
        generation: persisted.generation,
      });
      await cleanupAssetProjectionGenerations(
        projectionKey,
        ASSET_PROJECTION_GENERATIONS_TO_KEEP,
      );
      persistedProjectionFingerprints.set(projectionKey, fingerprint);
      ctx.markBatch({
        round: totalBatches - 1,
        count: rowCount,
        durationMs: Date.now() - startedAt,
      });
      return persisted;
    },
  });

  void promise
    .catch(error => {
      if (!isSyncTaskAbortError(error)) {
        console.error('[assetProjection] persist failed', error);
        traceStartupDiagnostic('asset_projection', 'persist_failed', {
          kind: input.kind,
          scene: input.scene,
          rowCount,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })
    .finally(() => {
      if (activeProjectionControllers.get(projectionKey) === controller) {
        activeProjectionControllers.delete(projectionKey);
        activeProjectionFingerprints.delete(projectionKey);
      }
    });

  return { taskId, projectionKey, promise };
};

export const restoreAssetProjection = async (
  identity: AssetProjectionIdentity,
  options: {
    ruleVersion?: number;
    selectRowRanges?: (
      snapshot: AssetProjectionSnapshotInfo,
    ) => AssetProjectionRowRange[] | null | undefined;
    onPhase?: (
      phase:
        | 'snapshot-candidates-read'
        | 'integrity-counted'
        | 'metadata-read'
        | 'rows-read',
      durationMs: number,
      details?: Record<string, number>,
    ) => void;
  } = {},
) => {
  const projectionKey = buildAssetProjectionStorageKey(identity);
  return restoreLatestAssetProjection(projectionKey, {
    kind: identity.kind,
    scene: identity.scene,
    ruleVersion: options.ruleVersion,
    selectRowRanges: options.selectRowRanges,
    onPhase: options.onPhase,
  });
};

export const restoreAssetProjectionRows = (
  projectionKey: string,
  generation: number,
  ranges: AssetProjectionRowRange[],
) => restoreAssetProjectionGenerationRows(projectionKey, generation, ranges);

export const isAssetProjectionPersistenceActive = (
  identity: AssetProjectionIdentity,
) => activeProjectionControllers.has(buildAssetProjectionStorageKey(identity));

export const subscribeAssetProjectionDatabaseCommits = (listener: () => void) =>
  OPSQLiteEvents.subscribe('DATABASE_COMMITTED', ({ tables }) => {
    if (tables.includes(projectionSnapshotTable)) {
      listener();
    }
  });
