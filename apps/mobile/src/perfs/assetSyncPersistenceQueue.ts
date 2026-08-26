import {
  ASSET_SYNC_PERSISTENCE_QUARANTINE_KEY_PREFIX,
  ASSET_SYNC_PERSISTENCE_QUEUE_SCHEMA_VERSION,
  ASSET_SYNC_PERSISTENCE_TASK_KEY_PREFIX,
  ASSET_SYNC_WORKER_SCHEMA_VERSION,
  TOKEN_CACHE_TABLE_NAME,
  buildTokenSnapshotMutationCommands,
  getAssetSyncPersistenceTaskIdFromKey,
  getAssetSyncPersistenceTaskKey,
  normalizeAssetSyncCompletion,
  parseAssetSyncPersistenceTask,
  type AssetSyncCompletion,
  type AssetSyncPersistenceAck,
  type TokenSnapshotPersistenceTask,
} from '@rabby-wallet/asset-sync-worker-core';

import { assetSyncPersistenceQueueMMKV } from '@/core/storage/mmkvInstances';

import {
  dispatchAssetSyncCompletion,
  hasAssetSyncCompletionHandler,
} from './assetSyncCompletion';

const MAX_PROCESS_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [250, 1000, 3000] as const;
const MAX_QUARANTINE_ENTRIES = 16;

export type AssetSyncPersistenceQueueStorage = {
  getAllKeys(): string[];
  getString(key: string): string | null | undefined;
  set(key: string, value: string): void;
  delete(key: string): void;
  clearAll(): void;
  sync(): void;
  reload(): void;
};

export type AssetSyncPersistenceCommitResult = {
  rowCount: number;
  applied: boolean;
  committedAt: number;
  replayed?: boolean;
};

type AssetSyncPersistenceQueueDependencies = {
  storage: AssetSyncPersistenceQueueStorage;
  commitTask: (
    task: TokenSnapshotPersistenceTask,
  ) => Promise<AssetSyncPersistenceCommitResult>;
  dispatchCompletion: (
    completion: AssetSyncCompletion,
  ) => Promise<AssetSyncCompletion>;
  hasCompletionHandler: (kind: 'token') => boolean;
  shouldAcknowledgeWorker: () => boolean | Promise<boolean>;
  acknowledgeWorker: (ack: AssetSyncPersistenceAck) => Promise<boolean>;
  now: () => number;
  schedule: (run: () => void, delayMs: number) => ReturnType<typeof setTimeout>;
  cancelSchedule: (timer: ReturnType<typeof setTimeout>) => void;
  reportError: (message: string, error: unknown) => void;
};

const makeCommittedAck = (
  task: TokenSnapshotPersistenceTask,
  result: AssetSyncPersistenceCommitResult,
): AssetSyncPersistenceAck => ({
  schemaVersion: ASSET_SYNC_PERSISTENCE_QUEUE_SCHEMA_VERSION,
  taskId: task.taskId,
  status: 'committed',
  rowCount: result.rowCount,
  applied: result.applied,
  committedAt: result.committedAt,
  errorCode: '',
});

const makeRejectedAck = (taskId: string): AssetSyncPersistenceAck => ({
  schemaVersion: ASSET_SYNC_PERSISTENCE_QUEUE_SCHEMA_VERSION,
  taskId,
  status: 'rejected',
  rowCount: 0,
  applied: false,
  committedAt: 0,
  errorCode: 'asset_sync_persistence_task_rejected',
});

const makeCompletion = (
  task: TokenSnapshotPersistenceTask,
  result: AssetSyncPersistenceCommitResult,
) =>
  normalizeAssetSyncCompletion({
    schemaVersion: ASSET_SYNC_WORKER_SCHEMA_VERSION,
    requestId: task.requestId,
    kind: 'token',
    success: true,
    address: task.address,
    outcome: task.failedChainIds.length ? 'partial' : 'complete',
    generation: task.generation,
    committedAt: result.committedAt,
    replacementScope: task.replacementScope,
    chainIds: task.chainIds,
    failedChainIds: task.failedChainIds,
    committedRowCount: result.rowCount,
    superseded: result.committedAt > task.generation,
    stage: result.replayed
      ? 'replayed'
      : result.applied
      ? 'committed'
      : result.committedAt > task.generation
      ? 'superseded'
      : 'commit-skipped',
    errorCode: task.failedChainIds.length
      ? 'asset_sync_partial_chain_failure'
      : '',
  });

async function commitTokenSnapshotTask(
  task: TokenSnapshotPersistenceTask,
): Promise<AssetSyncPersistenceCommitResult> {
  const [
    { prepareAppDataSource },
    { resolveDriverAndConnectionFromRepo },
    { TokenItemEntity },
    { submitSyncTask },
  ] = await Promise.all([
    import('@/databases/imports'),
    import('@/core/databases/typeormConnection'),
    import('@/databases/entities/tokenitem'),
    import('@/databases/sync/scheduler'),
  ]);

  const submitted = submitSyncTask({
    key: `asset-sync-persistence-${task.address}`,
    taskFor: 'token',
    owner: task.address,
    entityName: 'TokenItemEntity',
    rowCount: task.rows.length,
    batchSize: task.rows.length,
    totalBatches: 1,
    priority: 'normal',
    replaceQueuedDuplicates: false,
    runner: async context => {
      await context.waitIfPaused();
      context.setStage('prepare_data_source');
      const dataSource = await prepareAppDataSource();
      const repository = dataSource.getRepository(TokenItemEntity);
      const { connection } = resolveDriverAndConnectionFromRepo(repository);
      const db = connection.getDb();

      context.setStage('generation_fence');
      const generationResult = await db.execute(
        `SELECT MAX("_local_updated_at") AS "generation" FROM "${TOKEN_CACHE_TABLE_NAME}" WHERE "owner_addr"=?`,
        [task.address],
      );
      const committedAt = Number(generationResult.rows[0]?.generation || 0);
      if (!Number.isSafeInteger(committedAt) || committedAt < 0) {
        throw new Error('asset_sync_persistence_generation_result_invalid');
      }
      if (committedAt > task.generation) {
        return { rowCount: 0, applied: false, committedAt };
      }
      if (committedAt === task.generation) {
        return {
          rowCount: task.rows.length,
          applied: true,
          committedAt,
          replayed: true,
        };
      }

      context.setStage('execute_batch', {
        rowCount: task.rows.length,
        replacementScope: task.replacementScope,
      });
      await db.executeBatch(
        buildTokenSnapshotMutationCommands({
          address: task.address,
          syncTimestamp: task.generation,
          replacementScope: task.replacementScope,
          chainIds: task.chainIds,
          rows: task.rows,
        }),
      );
      context.markBatch({
        round: 0,
        count: task.rows.length,
        durationMs: 0,
      });
      return {
        rowCount: task.rows.length,
        applied: true,
        committedAt: task.generation,
      };
    },
  });

  return submitted.promise;
}

function defaultReportError(message: string, error: unknown) {
  import('@/constant')
    .then(({ isNonPublicProductionEnv }) => {
      if (isNonPublicProductionEnv) {
        console.warn(`[AssetSyncPersistenceQueue] ${message}`, error);
      }
    })
    .catch(() => undefined);
}

function defaultReportEvent(
  phase: string,
  details: Record<string, boolean | number | string>,
) {
  import('@/constant')
    .then(({ isNonPublicProductionEnv }) => {
      if (isNonPublicProductionEnv) {
        console.info(`[AssetSyncPersistenceQueue] ${phase}`, details);
      }
    })
    .catch(() => undefined);
}

export function createAssetSyncPersistenceQueueController(
  dependencies: Partial<AssetSyncPersistenceQueueDependencies> = {},
) {
  const deps: AssetSyncPersistenceQueueDependencies = {
    storage: assetSyncPersistenceQueueMMKV,
    commitTask: commitTokenSnapshotTask,
    dispatchCompletion: dispatchAssetSyncCompletion,
    hasCompletionHandler: kind => hasAssetSyncCompletionHandler(kind),
    shouldAcknowledgeWorker: async () => {
      const { isWorkerThreadRunning } = await import('./thread');
      return isWorkerThreadRunning();
    },
    acknowledgeWorker: async ack => {
      const { workerThread } = await import('./thread');
      const result = await workerThread.remoteCall(
        'assetSync:persistence-ack',
        { ack },
        { timeout: 5000 },
      );
      return result?.accepted === true;
    },
    now: Date.now,
    schedule: (run, delayMs) => setTimeout(run, delayMs),
    cancelSchedule: timer => clearTimeout(timer),
    reportError: defaultReportError,
    ...dependencies,
  };

  const pendingTaskIds = new Set<string>();
  const attempts = new Map<string, number>();
  const retryTimers = new Map<string, ReturnType<typeof setTimeout>>();
  let drainPromise: Promise<void> | null = null;

  const removeTask = (taskId: string) => {
    deps.storage.delete(getAssetSyncPersistenceTaskKey(taskId));
    deps.storage.sync();
    attempts.delete(taskId);
    const timer = retryTimers.get(taskId);
    if (timer) {
      deps.cancelSchedule(timer);
      retryTimers.delete(taskId);
    }
  };

  const quarantineTask = async (
    taskId: string,
    rawValue: string,
    error: unknown,
  ) => {
    const quarantineKey = `${ASSET_SYNC_PERSISTENCE_QUARANTINE_KEY_PREFIX}${deps.now()}:${taskId}`;
    deps.storage.set(
      quarantineKey,
      JSON.stringify({
        schemaVersion: ASSET_SYNC_PERSISTENCE_QUEUE_SCHEMA_VERSION,
        taskId,
        detectedAt: deps.now(),
        serializedLength: rawValue.length,
        errorCode:
          error instanceof Error
            ? error.message.slice(0, 160)
            : 'asset_sync_persistence_task_invalid',
      }),
    );
    deps.storage.delete(getAssetSyncPersistenceTaskKey(taskId));

    const quarantineKeys = deps.storage
      .getAllKeys()
      .filter(key =>
        key.startsWith(ASSET_SYNC_PERSISTENCE_QUARANTINE_KEY_PREFIX),
      )
      .sort();
    quarantineKeys
      .slice(0, Math.max(0, quarantineKeys.length - MAX_QUARANTINE_ENTRIES))
      .forEach(key => deps.storage.delete(key));
    deps.storage.sync();

    if (await deps.shouldAcknowledgeWorker()) {
      await deps.acknowledgeWorker(makeRejectedAck(taskId)).catch(() => false);
    }
  };

  const scheduleRetry = async (taskId: string, error: unknown) => {
    const attempt = (attempts.get(taskId) || 0) + 1;
    attempts.set(taskId, attempt);
    deps.reportError(`task ${taskId} failed on attempt ${attempt}`, error);

    if (attempt >= MAX_PROCESS_ATTEMPTS) {
      if (await deps.shouldAcknowledgeWorker()) {
        await deps
          .acknowledgeWorker(makeRejectedAck(taskId))
          .catch(() => false);
      }
      return;
    }

    if (retryTimers.has(taskId)) {
      return;
    }
    const timer = deps.schedule(() => {
      retryTimers.delete(taskId);
      pendingTaskIds.add(taskId);
      drain().catch(retryError => {
        deps.reportError(`task ${taskId} retry drain failed`, retryError);
      });
    }, RETRY_DELAYS_MS[attempt - 1] || RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1]);
    retryTimers.set(taskId, timer);
  };

  const processTask = async (taskId: string) => {
    deps.storage.reload();
    const rawValue = deps.storage.getString(
      getAssetSyncPersistenceTaskKey(taskId),
    );
    if (typeof rawValue !== 'string') {
      attempts.delete(taskId);
      return;
    }

    let task: TokenSnapshotPersistenceTask;
    try {
      const parsed = parseAssetSyncPersistenceTask(rawValue);
      if (parsed.taskId !== taskId || parsed.kind !== 'token-snapshot') {
        throw new Error('asset_sync_persistence_task_key_mismatch');
      }
      task = parsed;
      defaultReportEvent('consume', {
        taskId,
        requestId: task.requestId,
        address: task.address,
        generation: task.generation,
        rowCount: task.rows.length,
      });
    } catch (error) {
      deps.reportError(`quarantining task ${taskId}`, error);
      await quarantineTask(taskId, rawValue, error);
      return;
    }

    try {
      const result = await deps.commitTask(task);
      defaultReportEvent('committed', {
        taskId,
        generation: task.generation,
        rowCount: result.rowCount,
        applied: result.applied,
        replayed: result.replayed === true,
      });
      const completion = makeCompletion(task, result);
      if (deps.hasCompletionHandler('token')) {
        await deps.dispatchCompletion(completion);
      }
      let workerAcknowledged = false;
      if (await deps.shouldAcknowledgeWorker()) {
        workerAcknowledged = await deps.acknowledgeWorker(
          makeCommittedAck(task, result),
        );
      }
      removeTask(taskId);
      defaultReportEvent('dequeued', {
        taskId,
        workerAcknowledged,
      });
    } catch (error) {
      await scheduleRetry(taskId, error);
    }
  };

  const runDrain = async () => {
    while (pendingTaskIds.size > 0) {
      const taskId = pendingTaskIds.values().next().value as string;
      pendingTaskIds.delete(taskId);
      await processTask(taskId);
    }
  };

  function drain() {
    if (!drainPromise) {
      drainPromise = runDrain().finally(() => {
        drainPromise = null;
        if (pendingTaskIds.size > 0) {
          drain().catch(error => {
            deps.reportError('follow-up drain failed', error);
          });
        }
      });
    }
    return drainPromise;
  }

  const notify = (taskId: string) => {
    getAssetSyncPersistenceTaskKey(taskId);
    pendingTaskIds.add(taskId);
    return drain();
  };

  const recover = () => {
    deps.storage.reload();
    const tasks = deps.storage
      .getAllKeys()
      .filter(key => key.startsWith(ASSET_SYNC_PERSISTENCE_TASK_KEY_PREFIX))
      .map(getAssetSyncPersistenceTaskIdFromKey)
      .filter((taskId): taskId is string => taskId !== null)
      .sort();
    if (tasks.length > 0) {
      defaultReportEvent('recover', { taskCount: tasks.length });
    }
    tasks.forEach(taskId => pendingTaskIds.add(taskId));
    return drain();
  };

  const clear = async () => {
    pendingTaskIds.clear();
    attempts.clear();
    retryTimers.forEach(timer => deps.cancelSchedule(timer));
    retryTimers.clear();
    await drainPromise?.catch(() => undefined);
    deps.storage.clearAll();
    deps.storage.sync();
  };

  return { notify, recover, clear };
}

const assetSyncPersistenceQueueController =
  createAssetSyncPersistenceQueueController();

export function notifyAssetSyncPersistenceTaskReady(taskId: string) {
  return assetSyncPersistenceQueueController.notify(taskId);
}

export function recoverAssetSyncPersistenceQueue() {
  return assetSyncPersistenceQueueController.recover();
}

export function startAssetSyncPersistenceQueueRecovery() {
  recoverAssetSyncPersistenceQueue().catch(error => {
    defaultReportError('startup recovery failed', error);
  });
}

export function clearAssetSyncPersistenceQueue() {
  return assetSyncPersistenceQueueController.clear();
}
