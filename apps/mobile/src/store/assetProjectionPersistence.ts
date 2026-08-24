import { traceStartupDiagnostic } from '@/core/utils/startupDiagnostics';
import { OPSQLiteEvents } from '@/core/databases/op-sqlite/events';
import {
  persistAssetProjection,
  restoreLatestAssetProjection,
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
  const { taskId, promise } = submitSyncTask({
    key: `asset-projection:${projectionKey}`,
    taskFor: 'asset-projection',
    owner: projectionKey,
    entityName: AssetProjectionSnapshotEntity.name,
    rowCount,
    batchSize: Math.max(1, rowCount),
    totalBatches: 1,
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
      ensureNotAborted(controller.signal);
      persistedProjectionFingerprints.set(projectionKey, fingerprint);
      ctx.markBatch({
        round: 0,
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
  options: { ruleVersion?: number } = {},
) => {
  const projectionKey = buildAssetProjectionStorageKey(identity);
  return restoreLatestAssetProjection(projectionKey, {
    kind: identity.kind,
    scene: identity.scene,
    ruleVersion: options.ruleVersion,
  });
};

export const isAssetProjectionPersistenceActive = (
  identity: AssetProjectionIdentity,
) => activeProjectionControllers.has(buildAssetProjectionStorageKey(identity));

export const subscribeAssetProjectionDatabaseCommits = (listener: () => void) =>
  OPSQLiteEvents.subscribe('DATABASE_COMMITTED', ({ tables }) => {
    if (tables.includes(projectionSnapshotTable)) {
      listener();
    }
  });
