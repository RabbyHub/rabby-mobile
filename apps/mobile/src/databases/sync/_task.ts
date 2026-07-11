import { BaseEntity } from 'typeorm/browser';
import type { SQLBatchTuple, Scalar } from '@op-engineering/op-sqlite';

import { type EntityAddressAssetBase } from '../entities/base';
import { appOrmEvents, SyncTaskOptions } from './_event';
import { resolveDriverAndConnectionFromRepo } from '@/core/databases/op-sqlite/typeorm';
import { getOnlineConfig } from '@/core/config/online';
import { logger } from '@/utils/logger';
import { isNonPublicProductionEnv } from '@/constant';
import {
  beginDbSyncTask,
  endDbSyncTask,
  markDbSyncTaskBatch,
  markDbSyncTaskStage,
} from '@/core/utils/startupDiagnostics';
import {
  inferSyncTaskPriority,
  isSyncTaskAbortError,
  makeSyncTaskKey,
  submitSyncTask,
  SyncTaskAbortError,
  type SyncTaskPriority,
} from './scheduler';
import { notifySyncAbortHandlers } from './abort';
import { isNonProductionDiagnosticsEnabled } from '@/core/utils/diagnosticEnv';

/**
 * @description In most cases, you don't need call it manually,
 * if you want to do that, make sure you know what you are doing.
 */
export const syncAbortControllers: {
  [P in ReturnType<typeof makeSyncTaskKey>]?: AbortController | null;
} = {};
const activeSyncAbortControllers = new Set<AbortController>();

const DB_SYNC_WRITE_POLICIES: Partial<
  Record<
    SyncTaskOptions['taskFor'],
    {
      maxBatchSize?: number;
      minDelayBetweenTasks?: number;
      maxDelayBetweenTasks?: number;
    }
  >
> = {
  token: {
    maxBatchSize: 120,
    minDelayBetweenTasks: 16,
  },
  'all-history': {
    maxBatchSize: 10,
    maxDelayBetweenTasks: 32,
  },
};

export function abortAllSyncTasks(reason = 'manual') {
  notifySyncAbortHandlers(reason);
  activeSyncAbortControllers.forEach(controller => {
    controller.abort();
  });
  Object.entries(syncAbortControllers).forEach(([taskKey, controller]) => {
    logger.warn('[debug] abortAllSyncTasks::will abort', taskKey);
    controller?.abort();
  });
}

export type BeforeEmitFn = (
  payload: Parameters<typeof appOrmEvents.emit>[1],
) => void;

type AfterBatchesFn = (ctx: {
  owner_addr: string;
  taskFor: SyncTaskOptions['taskFor'] | '@unknown';
  signal: AbortSignal;
  totalRows: number;
  batchSize: number;
  totalBatches: number;
}) => Promise<void> | void;

function resolveUpsertMethod<T extends typeof EntityAddressAssetBase>(
  entityCls: T & typeof BaseEntity,
) {
  const enablePreparedUpsert =
    isNonPublicProductionEnv ||
    !!getOnlineConfig().switches?.['20260122.enable_db_prepared_upsert'];
  const disablePreparedUpsert = !__DEV__ && !enablePreparedUpsert;
  const hasStatementSql =
    'getStatementSql' in entityCls &&
    typeof entityCls.getStatementSql === 'function';
  const hasBindUpsertParams =
    'bindUpsertParams' in entityCls.prototype &&
    typeof entityCls.prototype.bindUpsertParams === 'function';
  const hasGetUpsertParams =
    'getUpsertParams' in entityCls.prototype &&
    typeof entityCls.prototype.getUpsertParams === 'function';
  const supportedBulkUpsert =
    !disablePreparedUpsert && hasStatementSql && hasGetUpsertParams;
  const stmSql = !supportedBulkUpsert
    ? ''
    : entityCls.getStatementSql?.('upsert') ?? '';

  return {
    method:
      supportedBulkUpsert && stmSql
        ? 'op_sqlite_execute_batch'
        : 'typeorm_upsert',
    enablePreparedUpsert,
    disablePreparedUpsert,
    hasStatementSql,
    hasBindUpsertParams,
    hasGetUpsertParams,
    hasStatementSqlText: !!stmSql,
    supportedBulkUpsert: !!(supportedBulkUpsert && stmSql),
    stmSql,
  };
}

function ensureNotAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new SyncTaskAbortError();
  }
}

function resolveDbSyncWritePolicy(options: {
  taskFor: SyncTaskOptions['taskFor'];
  batchSize: number;
  delayBetweenTasks: number;
}) {
  const policy = DB_SYNC_WRITE_POLICIES[options.taskFor];
  if (!policy) {
    return {
      batchSize: options.batchSize,
      delayBetweenTasks: options.delayBetweenTasks,
      didApplyPolicy: false,
    };
  }

  const batchSize = Math.max(
    1,
    Math.min(options.batchSize, policy.maxBatchSize || options.batchSize),
  );
  let delayBetweenTasks = Math.max(
    options.delayBetweenTasks,
    policy.minDelayBetweenTasks || 0,
  );
  if (typeof policy.maxDelayBetweenTasks === 'number') {
    delayBetweenTasks = Math.min(
      delayBetweenTasks,
      policy.maxDelayBetweenTasks,
    );
  }

  return {
    batchSize,
    delayBetweenTasks,
    didApplyPolicy:
      batchSize !== options.batchSize ||
      delayBetweenTasks !== options.delayBetweenTasks,
    requestedBatchSize: options.batchSize,
    requestedDelayBetweenTasks: options.delayBetweenTasks,
  };
}

function sleep(ms: number, signal?: AbortSignal) {
  if (ms <= 0) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const timeoutId = setTimeout(() => {
      if (settled) {
        return;
      }

      settled = true;
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeoutId);
      reject(new SyncTaskAbortError());
    };

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function estimateParamsPayload(paramsRows: Scalar[][]) {
  if (!isNonProductionDiagnosticsEnabled) {
    return null;
  }

  let stringChars = 0;
  let maxStringChars = 0;
  let valueCount = 0;

  paramsRows.forEach(row => {
    row.forEach(value => {
      valueCount += 1;
      if (typeof value !== 'string') {
        return;
      }

      stringChars += value.length;
      maxStringChars = Math.max(maxStringChars, value.length);
    });
  });

  return {
    columnCount: paramsRows[0]?.length || 0,
    valueCount,
    stringChars,
    maxStringChars,
  };
}

export async function batchSaveWithPQueueAndTransaction<
  T extends typeof EntityAddressAssetBase,
>(
  entityCls: T & typeof BaseEntity,
  data: InstanceType<T>[],
  options: SyncTaskOptions & {
    batchSize?: number;
    concurrency?: number;
    delayBetweenTasks?: number;
    noNeedAbort?: boolean;
    printLog?: boolean;
    waitTaskDoneReturn?: boolean;
    beforeEmit?: BeforeEmitFn;
    afterBatches?: AfterBatchesFn;
    priority?: SyncTaskPriority;
    skipEmit?: boolean;
  },
) {
  const {
    batchSize: requestedBatchSize = 50,
    concurrency = 2,
    delayBetweenTasks: requestedDelayBetweenTasks = 1 * 1e3,
    owner_addr,
    taskFor,
    printLog = __DEV__,
    noNeedAbort = false,
    waitTaskDoneReturn = false,
    beforeEmit,
    afterBatches,
    priority = inferSyncTaskPriority(taskFor),
    skipEmit = false,
  } = options;
  const writePolicy = resolveDbSyncWritePolicy({
    taskFor,
    batchSize: requestedBatchSize,
    delayBetweenTasks: requestedDelayBetweenTasks,
  });
  const { batchSize, delayBetweenTasks } = writePolicy;

  const taskKey = makeSyncTaskKey(taskFor, owner_addr);
  const curAbortController = new AbortController();
  if (syncAbortControllers[taskKey] && !noNeedAbort) {
    syncAbortControllers[taskKey]?.abort();
  }
  syncAbortControllers[taskKey] = curAbortController;
  activeSyncAbortControllers.add(curAbortController);

  const currentSignal = curAbortController.signal;
  const loggerPrefix = !owner_addr
    ? ''
    : `[batchSaveWithPQueueAndTransaction::${taskKey}] `;
  const logBatch = (
    level: 'debug' | 'warn' | 'error',
    message: string,
    ...payload: unknown[]
  ) => {
    logger[level](`${loggerPrefix}${message}`, ...payload);
  };

  const repo = entityCls.getRepository();
  const totalLen = data.length;
  const totalRound = Math.ceil(totalLen / batchSize);
  const effectiveConcurrency = 1;
  const diagTaskId = beginDbSyncTask({
    taskFor: taskFor || '@unknown',
    entityName: entityCls.name,
    totalRows: totalLen,
    batchSize,
    totalBatches: totalRound,
    requestedConcurrency: concurrency,
    effectiveConcurrency,
    waitTaskDoneReturn,
    delayBetweenTasks,
  });
  if (writePolicy.didApplyPolicy) {
    markDbSyncTaskStage(
      diagTaskId,
      'write_policy',
      {
        requestedBatchSize: writePolicy.requestedBatchSize,
        effectiveBatchSize: batchSize,
        requestedDelayBetweenTasks: writePolicy.requestedDelayBetweenTasks,
        effectiveDelayBetweenTasks: delayBetweenTasks,
      },
      true,
    );
  }
  let didFinishDiagTask = false;
  let diagTaskHadError = false;
  const finishDiagTask = (
    status: 'success' | 'error' | 'aborted',
    detail: Record<string, unknown> = {},
  ) => {
    if (didFinishDiagTask) {
      return;
    }

    didFinishDiagTask = true;
    endDbSyncTask(diagTaskId, status, detail);
  };

  const eventPayloadBase = {
    entityCls,
    owner_addr,
    taskFor: taskFor || '@unknown',
  };

  const makeEmit = (
    success: boolean,
    syncDetails: {
      count: number;
      total: number;
      round: number;
      batchSize: number;
    },
  ) => {
    if (currentSignal.aborted || skipEmit) {
      return;
    }

    const payload = {
      ...eventPayloadBase,
      syncDetails,
      success,
    };
    beforeEmit?.(payload);
    appOrmEvents.emit('onRemoteDataUpserted', payload);
  };

  const { taskId: schedulerTaskId, promise: schedulerPromise } = submitSyncTask(
    {
      key: taskKey,
      taskFor,
      owner: owner_addr,
      entityName: entityCls.name,
      rowCount: totalLen,
      batchSize,
      totalBatches: totalRound,
      priority,
      signal: currentSignal,
      replaceQueuedDuplicates: !noNeedAbort,
      runner: async ctx => {
        markDbSyncTaskStage(
          diagTaskId,
          'running',
          {
            schedulerTaskId,
            queuedByScheduler: true,
          },
          true,
        );
        ensureNotAborted(currentSignal);

        const upsertMethod = resolveUpsertMethod(entityCls);
        ctx.setMethod(upsertMethod.method);
        markDbSyncTaskStage(diagTaskId, 'upsert_method', {
          schedulerTaskId,
          method: upsertMethod.method,
          enablePreparedUpsert: upsertMethod.enablePreparedUpsert,
          disablePreparedUpsert: upsertMethod.disablePreparedUpsert,
          hasStatementSql: upsertMethod.hasStatementSql,
          hasBindUpsertParams: upsertMethod.hasBindUpsertParams,
          hasGetUpsertParams: upsertMethod.hasGetUpsertParams,
          hasStatementSqlText: upsertMethod.hasStatementSqlText,
          legacyDelayBetweenTasksMs: delayBetweenTasks,
          legacyConcurrency: concurrency,
        });

        const { connection } = resolveDriverAndConnectionFromRepo(repo);
        const db = connection.getDb();
        let dataIdx = 0;

        while (dataIdx < totalLen) {
          await ctx.waitIfPaused();
          ensureNotAborted(currentSignal);

          const curBatch = data.slice(dataIdx, dataIdx + batchSize);
          const round = Math.floor(dataIdx / batchSize);
          const roundText = `${round + 1}`;
          const roundPercent = `${roundText} / ${totalRound}`;
          const batchStartedAt = Date.now();
          const syncDetails = {
            count: curBatch.length,
            total: totalLen,
            round,
            batchSize,
          };

          printLog &&
            logBatch('debug', `Batch ${roundPercent} upsertion started.`);
          ctx.setStage('batch_start', {
            round,
            count: curBatch.length,
            totalRound,
          });

          try {
            let paramsBuildMs = 0;
            let executeMs = 0;
            let paramsPayload: ReturnType<typeof estimateParamsPayload> = null;
            if (upsertMethod.supportedBulkUpsert && upsertMethod.stmSql) {
              const paramsBuildStartedAt = Date.now();
              ctx.setStage('params_build', {
                round,
                count: curBatch.length,
                totalRound,
              });
              markDbSyncTaskStage(
                diagTaskId,
                'params_build',
                {
                  schedulerTaskId,
                  round,
                  count: curBatch.length,
                  totalRound,
                  method: upsertMethod.method,
                },
                true,
              );
              const paramsRows = curBatch.map(item => {
                const getUpsertParams = item.getUpsertParams;
                if (typeof getUpsertParams !== 'function') {
                  throw new Error(
                    `${entityCls.name} does not support getUpsertParams`,
                  );
                }
                return getUpsertParams.call(item) as Scalar[];
              });
              paramsPayload = estimateParamsPayload(paramsRows);
              paramsBuildMs = Date.now() - paramsBuildStartedAt;
              markDbSyncTaskStage(diagTaskId, 'params_built', {
                schedulerTaskId,
                round,
                count: curBatch.length,
                durationMs: paramsBuildMs,
                ...(paramsPayload || {}),
              });

              const commands: SQLBatchTuple[] = [
                [upsertMethod.stmSql, paramsRows],
              ];
              const executeStartedAt = Date.now();
              ctx.setStage('execute_batch', {
                round,
                count: curBatch.length,
                totalRound,
                paramsBuildMs,
              });
              markDbSyncTaskStage(
                diagTaskId,
                'execute_batch',
                {
                  schedulerTaskId,
                  round,
                  count: curBatch.length,
                  totalRound,
                  paramsBuildMs,
                  method: upsertMethod.method,
                },
                true,
              );
              await db.executeBatch(commands);
              executeMs = Date.now() - executeStartedAt;
            } else {
              const executeStartedAt = Date.now();
              ctx.setStage('typeorm_upsert', {
                round,
                count: curBatch.length,
                totalRound,
              });
              markDbSyncTaskStage(
                diagTaskId,
                'typeorm_upsert',
                {
                  schedulerTaskId,
                  round,
                  count: curBatch.length,
                  totalRound,
                  method: upsertMethod.method,
                },
                true,
              );
              await repo.manager.upsert(entityCls, curBatch, {
                conflictPaths: ['_db_id'],
              });
              executeMs = Date.now() - executeStartedAt;
            }

            printLog &&
              logBatch(
                'debug',
                `Batch ${roundPercent} upsertion successfully.`,
              );

            makeEmit(true, syncDetails);
            const durationMs = Date.now() - batchStartedAt;
            ctx.markBatch({
              round,
              count: curBatch.length,
              durationMs,
            });
            markDbSyncTaskBatch(diagTaskId, {
              round,
              totalRound,
              count: curBatch.length,
              durationMs,
              paramsBuildMs,
              executeMs,
              method: upsertMethod.method,
              ...(paramsPayload || {}),
            });
          } catch (error) {
            makeEmit(false, syncDetails);
            diagTaskHadError = true;
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            markDbSyncTaskStage(diagTaskId, 'batch_error', {
              schedulerTaskId,
              round,
              count: curBatch.length,
              durationMs: Date.now() - batchStartedAt,
              error: errorMessage,
            });
            printLog &&
              logBatch('error', `Error inserting batch ${roundText}:`, error);

            logger.error(`upsert ${taskKey}`, error);
            throw error;
          }

          dataIdx += curBatch.length;
          if (dataIdx < totalLen && delayBetweenTasks > 0) {
            ctx.setStage('batch_delay', {
              delayMs: delayBetweenTasks,
              nextRound: Math.floor(dataIdx / batchSize),
              totalRound,
            });
            markDbSyncTaskStage(diagTaskId, 'batch_delay', {
              schedulerTaskId,
              delayMs: delayBetweenTasks,
              nextRound: Math.floor(dataIdx / batchSize),
              totalRound,
            });
            await sleep(delayBetweenTasks, currentSignal);
          }
        }

        if (afterBatches) {
          await ctx.waitIfPaused();
          ensureNotAborted(currentSignal);
          const afterBatchesStartedAt = Date.now();
          markDbSyncTaskStage(diagTaskId, 'after_batches_start', {
            schedulerTaskId,
          });
          await afterBatches({
            owner_addr,
            taskFor: taskFor || '@unknown',
            signal: currentSignal,
            totalRows: totalLen,
            batchSize,
            totalBatches: totalRound,
          });
          markDbSyncTaskStage(diagTaskId, 'after_batches_end', {
            schedulerTaskId,
            durationMs: Date.now() - afterBatchesStartedAt,
          });
        }

        markDbSyncTaskStage(diagTaskId, 'tasks_created', {
          schedulerTaskId,
          queuedByScheduler: true,
        });
      },
    },
  );
  markDbSyncTaskStage(
    diagTaskId,
    'queued',
    {
      schedulerTaskId,
      queuedByScheduler: true,
      priority,
    },
    true,
  );

  const unregisterAbortController = () => {
    activeSyncAbortControllers.delete(curAbortController);
    if (syncAbortControllers[taskKey] === curAbortController) {
      syncAbortControllers[taskKey] = null;
    }
  };

  const finalizePromise = schedulerPromise
    .then(() => {
      finishDiagTask(diagTaskHadError ? 'error' : 'success', {
        waitedForIdle: waitTaskDoneReturn,
        schedulerTaskId,
      });
      return true;
    })
    .catch(error => {
      const aborted = currentSignal.aborted || isSyncTaskAbortError(error);
      finishDiagTask(aborted ? 'aborted' : 'error', {
        waitedForIdle: waitTaskDoneReturn,
        schedulerTaskId,
        error: error instanceof Error ? error.message : String(error),
      });

      if (aborted) {
        printLog && logBatch('warn', 'Batch upsertion was aborted.');
        return false;
      }

      throw error;
    })
    .finally(unregisterAbortController);

  if (waitTaskDoneReturn) {
    const queueCompleted = await finalizePromise;
    return {
      taskKey,
      taskSignal: currentSignal,
      queueCompleted,
    };
  }

  void finalizePromise.catch(error => {
    logger.error(`upsert ${taskKey}`, error);
  });
  markDbSyncTaskStage(diagTaskId, 'tasks_created', {
    schedulerTaskId,
    queuedByScheduler: true,
  });

  return {
    taskKey,
    taskSignal: currentSignal,
    queueCompleted: false,
  };
}
