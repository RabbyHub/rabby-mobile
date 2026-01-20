import { BaseEntity } from 'typeorm/browser';
import PQueue from 'p-queue';
import { ClassOf } from '@rabby-wallet/base-utils';

import { type EntityAddressAssetBase } from '../entities/base';
import { appOrmEvents, SyncTaskOptions } from './_event';
import { runSqliteSyncWorklet } from '@/core/databases/perf';
import {
  resolveDriverAndConnectionFromEntity,
  resolveDriverAndConnectionFromRepo,
} from '@/core/databases/op-sqlite/typeorm';
import { getOnlineConfig } from '@/core/config/online';

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const keyVaryUpsertQueue: Record<string, PQueue> = {};

function makeTaskKey(
  taskFor: SyncTaskOptions['taskFor'],
  owner_addr: string,
): `${SyncTaskOptions['taskFor']}-${string}` {
  return `${taskFor}-${owner_addr}`;
}

/**
 * @description In most cases, you don't need call it manually,
 * if you want to do that, make sure you know what you are doing.
 */
export const syncAbortControllers: {
  [P in ReturnType<typeof makeTaskKey>]?: AbortController | null;
} = {};

export function abortAllSyncTasks() {
  Object.entries(syncAbortControllers).forEach(([taskKey, controller]) => {
    console.warn('[debug] abortAllSyncTasks::will abort', taskKey);
    controller?.abort();
  });
}

export type BeforeEmitFn = (
  payload: Parameters<typeof appOrmEvents.emit>[1],
) => void;
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
    // signal?: AbortSignal;
    waitTaskDoneReturn?: boolean;
    beforeEmit?: BeforeEmitFn;
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
    // signal = syncAbortControllers[taskFor],
    waitTaskDoneReturn = false,
    beforeEmit,
  } = options;

  const taskKey = makeTaskKey(taskFor, owner_addr);
  const curAbortController = new AbortController();
  if (syncAbortControllers[taskKey] && !noNeedAbort) {
    syncAbortControllers[taskKey].abort();
  }
  syncAbortControllers[taskKey] = curAbortController;

  const currentSignal = curAbortController.signal;

  const loggerPrefix = !owner_addr
    ? ''
    : `[batchSaveWithPQueueAndTransaction::${taskKey}] `;

  if (taskKey && keyVaryUpsertQueue[taskKey]) {
    keyVaryUpsertQueue[taskKey].clear();
    delete keyVaryUpsertQueue[taskKey];
  }

  const thisTickUpsertQueue = (keyVaryUpsertQueue[taskKey] = new PQueue({
    concurrency: 20,
  }));

  const repo = entityCls.getRepository();
  const totalLen = data.length;
  const totalRound = Math.ceil(data.length / batchSize);
  let waitAllTasksCreated = Promise.resolve();

  const cursors = {
    dataIdx: 0,
  };
  // for (let cursors.dataIdx = 0; cursors.dataIdx < totalLen; cursors.dataIdx += batchSize) {
  // const curBatch = data.slice(cursors.dataIdx, cursors.dataIdx + batchSize);
  while (cursors.dataIdx < totalLen && data.length) {
    // splice from data
    const curBatch = data.splice(0, batchSize);
    const curIndex = cursors.dataIdx;

    if (currentSignal.aborted) {
      printLog && console.warn(`${loggerPrefix}Batch upsertion was aborted.`);
      break;
    }

    waitAllTasksCreated = waitAllTasksCreated.then(async () => {
      await sleep(delayBetweenTasks);
      if (currentSignal.aborted) {
        printLog &&
          console.warn(
            `${loggerPrefix}[waitAllTasksCreated] Batch upsertion was aborted before.`,
          );
        thisTickUpsertQueue.clear();
        return;
      }

      thisTickUpsertQueue.add(async () => {
        const round = Math.floor(curIndex / batchSize);
        const roundText = `${round + 1}`;
        const roundPercent = `${roundText} / ${totalRound}`;
        printLog &&
          console.debug(
            `${loggerPrefix}Batch ${roundPercent} upsertion started.`,
          );

        const eventPayload = {
          entityCls,
          owner_addr,
          taskFor: taskFor || '@unknown',
          syncDetails: {
            // items: batch,
            count: curBatch.length,
            total: totalLen,
            round: round,
            batchSize,
          },
        };

        const makeEmit = (success: boolean) => {
          if (currentSignal.aborted) return;

          // // leave here for debug
          // if (__DEV__) {
          //   console.debug(
          //     `[debug] will make emit: ${eventPayload.taskFor}:${eventPayload.owner_addr}`,
          //   );
          // }
          beforeEmit?.({ ...eventPayload, success });
          appOrmEvents.emit('onRemoteDataUpserted', {
            ...eventPayload,
            success,
          });
        };

        try {
          const disablePreparedUpsert =
            !__DEV__ &&
            getOnlineConfig().switches?.['20260105.disable_db_prepared_upsert'];
          const supportedPreparedStatement =
            !disablePreparedUpsert &&
            'getStatementSql' in entityCls &&
            typeof entityCls.getStatementSql === 'function';
          const stmSql = !supportedPreparedStatement
            ? ''
            : entityCls.getStatementSql?.('upsert') ?? '';

          if (supportedPreparedStatement && stmSql) {
            const { connection } = resolveDriverAndConnectionFromRepo(repo);
            const db = connection.getDb();
            const stm = db.prepareStatement(stmSql);

            for (const item of curBatch) {
              item.bindUpsertParams!(stm);
              try {
                const result = await stm.execute();
                // console.debug(`${loggerPrefix}[perf] upserted row:`, result);
              } catch (error) {
                console.error(
                  `${loggerPrefix}Error upserting row:`,
                  error,
                  item,
                );
              }
            }

            console.debug(
              `${loggerPrefix}[perf] upserted rows`,
              curBatch,
              stmSql,
            );
          } else {
            await repo.manager.upsert(entityCls, curBatch, {
              conflictPaths: ['_db_id'],
            });
          }

          printLog &&
            console.debug(
              `${loggerPrefix}Batch ${roundPercent} upsertion successfully.`,
            );

          makeEmit(true);
        } catch (error) {
          makeEmit(false);
          printLog &&
            console.error(
              `${loggerPrefix}Error inserting batch ${roundText}:`,
              error,
            );

          console.error(`upsert ${taskKey}`, error);
          // Re-throw the error to rollback the transaction
          throw error;
        }
      });
    });
    cursors.dataIdx += batchSize;
  }

  if (currentSignal) {
    const abortListener = () => {
      printLog && console.warn(`${loggerPrefix}Batch upsertion was aborted.`);
      thisTickUpsertQueue.clear();
    };

    currentSignal.addEventListener('abort', abortListener);

    try {
      await waitAllTasksCreated;
      if (!currentSignal.aborted) {
        printLog &&
          console.debug(
            `${loggerPrefix}Started to upsert ${totalLen} records with total ${totalRound} batches(size: ${batchSize}, concurrency: ${concurrency})`,
          );
      }
    } catch (error) {
      printLog &&
        console.error(`${loggerPrefix}Wait batch upsertion failed:`, error);
    } finally {
      currentSignal.removeEventListener('abort', abortListener);
    }
  } else {
    await waitAllTasksCreated;
    printLog &&
      console.debug(`${loggerPrefix}All batches have been processed.`);
  }

  if (waitTaskDoneReturn) {
    await thisTickUpsertQueue.onIdle();
  }

  return {
    taskKey,
    taskSignal: currentSignal,
    queueCompleted: waitTaskDoneReturn && !currentSignal?.aborted,
  };
}
