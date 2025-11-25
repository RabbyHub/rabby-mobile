import { BaseEntity } from 'typeorm/browser';
import PQueue from 'p-queue';
import { ClassOf } from '@rabby-wallet/base-utils';

import { type EntityAddressAssetBase } from '../entities/base';
import { appOrmEvents, SyncTaskOptions } from './_event';
import { runSqliteSyncWorklet } from '@/core/databases/perf';

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

/**
 * @warning the `data` list would be mutated internally for performance consideration
 */
export async function batchSaveWithPQueueAndTransaction<
  T extends EntityAddressAssetBase,
>(
  entityCls: ClassOf<T> & typeof BaseEntity,
  data: T[],
  options: SyncTaskOptions & {
    batchSize?: number;
    concurrency?: number;
    delayBetweenTasks?: number;
    noNeedAbort?: boolean;
    printLog?: boolean;
    // signal?: AbortSignal;
    waitTaskDoneReturn?: boolean;
  },
  setHistoryLoading?: any,
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
  const totalRound = Math.ceil(data.length / batchSize);

  let waitAllTasksCreated = Promise.resolve();
  const totalLen = data.length;

  // for (let dataIdx = 0; dataIdx < totalLen; dataIdx += batchSize) {
  let batch: T[] = [];
  while (data.length > 0) {
    const dataIdx = totalLen - data.length;
    //
    // const batch = data.slice(dataIdx, dataIdx + batchSize);
    // splice from data
    batch = data.splice(0, batchSize);

    if (currentSignal.aborted) {
      printLog && console.warn(`${loggerPrefix}Batch upsertion was aborted.`);
      break;
    }

    // groups.push(batch);

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

      // const gIndex = groupTotal - groups.length;
      // const batch = groups.shift();
      // if (!batch) return;

      thisTickUpsertQueue.add(async () => {
        const round = Math.floor(dataIdx / batchSize);
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
            count: batch.length,
            total: totalLen,
            round: round,
            batchSize,
          },
        };

        const makeEmit = (success: boolean) => {
          if (currentSignal.aborted) return;

          // leave here for debug
          if (__DEV__ && eventPayload.taskFor === 'all-history') {
            setTimeout(() => {
              setHistoryLoading?.(prev => ({
                ...prev,
                [eventPayload.owner_addr]: false,
              }));
            }, 2000);
            printLog &&
              console.debug(
                `[debug] will make emit: ${eventPayload.taskFor}:${eventPayload.owner_addr}`,
              );
          }
          appOrmEvents.emit('onRemoteDataUpserted', {
            ...eventPayload,
            success,
          });
        };

        try {
          // await runSqliteSyncWorklet(
          //   async (entityCls: any, batch: any) => {
          //     'worklet';
          //     console.debug('_task::runSqliteSyncWorklet::prepare transaction upsert:: [0]');
          //     const repo = entityCls.getRepository();
          //     console.debug('_task::runSqliteSyncWorklet::prepare transaction upsert::', entityCls, batch);
          //     await repo.manager.transaction(async entityManager => {
          //       console.debug('_task::runSqliteSyncWorklet::transaction::upsert::', entityCls, batch);
          //       const tRepo = entityManager.getRepository(entityCls);
          //       await tRepo
          //         .upsert(
          //           batch,
          //           { conflictPaths: ['_db_id'] },
          //         )
          //         .then(() => {
          //           printLog &&
          //             console.debug(
          //               `${loggerPrefix}Batch ${roundPercent} upsertion successfully.`,
          //             );
          //         })
          //         .catch(error => {
          //           printLog &&
          //             console.error(
          //               `${loggerPrefix}Batch ${roundPercent} upsertion failed.`,
          //             );
          //           throw error;
          //         });
          //     });
          //   },
          // )(entityCls, JSON.parse(JSON.stringify(batch)));

          await repo.manager.upsert(
            entityCls,
            // @ts-expect-error
            batch,
            // bar
            { conflictPaths: ['_db_id'] },
          );
          // await runSqliteSyncWorklet(
          //   async (entityCls: any, batch: any, options: any) => {
          //     'worklet';
          //     console.debug('_task::runSqliteSyncWorklet upsert::', entityCls, batch);
          //     return repo.manager.upsert(entityCls, batch, options);
          //   },
          // )(entityCls, JSON.parse(JSON.stringify(batch)), { conflictPaths: ['_db_id'] });
          printLog &&
            console.debug(
              `${loggerPrefix}Batch ${roundPercent} upsertion successfully.`,
            );

          // const repo = entityCls.getRepository();
          // await repo.manager.transaction(async entityManager => {
          //   console.debug('_task::transaction::upsert::', entityCls, batch);
          //   const tRepo = entityManager.getRepository(entityCls);
          //   // await Promise.all(batch.map(item => {
          //   //   return tRepo.upsert(
          //   //     // @ts-expect-error
          //   //     item,
          //   //     { conflictPaths: ['_db_id'] },
          //   //   )
          //   // }))
          //   await tRepo.upsert(
          //       // @ts-expect-error
          //       batch,
          //       { conflictPaths: ['_db_id'] },
          //     )
          //     .then(() => {
          //       printLog &&
          //         console.debug(
          //           `${loggerPrefix}Batch ${roundPercent} upsertion successfully.`,
          //         );
          //     })
          //     .catch(error => {
          //       printLog &&
          //         console.error(
          //           `${loggerPrefix}Batch ${roundPercent} upsertion failed.`,
          //         );
          //       throw error;
          //     });
          // });
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
            `${loggerPrefix}Started to upsert ${data.length} records with total ${totalRound} batches(size: ${batchSize}, concurrency: ${concurrency})`,
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
