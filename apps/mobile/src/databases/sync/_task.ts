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

/**
 * @description In most cases, you don't need call it manually,
 * if you want to do that, make sure you know what you are doing.
 */
export const syncAbortControllers: {
  [P in ReturnType<typeof makeSyncTaskKey>]?: AbortController | null;
} = {};

export function abortAllSyncTasks() {
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

/**
 * @warning the `data` list would be mutated internally for performance consideration
 */
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
    batchSize = 50,
    concurrency = 2,
    delayBetweenTasks = 1 * 1e3,
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

  const taskKey = makeSyncTaskKey(taskFor, owner_addr);
  const curAbortController = new AbortController();
  if (syncAbortControllers[taskKey] && !noNeedAbort) {
    syncAbortControllers[taskKey]?.abort();
  }
  syncAbortControllers[taskKey] = curAbortController;

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

        while (dataIdx < totalLen && data.length) {
          await ctx.waitIfPaused();
          ensureNotAborted(currentSignal);

          const curBatch = data.splice(0, batchSize);
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
            if (upsertMethod.supportedBulkUpsert && upsertMethod.stmSql) {
              const paramsRows = curBatch.map(item => {
                const getUpsertParams = item.getUpsertParams;
                if (typeof getUpsertParams !== 'function') {
                  throw new Error(
                    `${entityCls.name} does not support getUpsertParams`,
                  );
                }
                return getUpsertParams.call(item) as Scalar[];
              });
              const commands: SQLBatchTuple[] = [
                [upsertMethod.stmSql, paramsRows],
              ];
              await db.executeBatch(commands);
            } else {
              await repo.manager.upsert(entityCls, curBatch, {
                conflictPaths: ['_db_id'],
              });
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

          dataIdx += batchSize;
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
    });

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
