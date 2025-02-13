import { BaseEntity } from 'typeorm/browser';
import PQueue from 'p-queue';
import { ClassOf } from '@rabby-wallet/base-utils';

import { type EntityAddressAssetBase } from '../entities/base';
import { appOrmEvents, SyncTaskOptions } from './_event';

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

export async function batchSaveWithPQueueAndTransaction<
  T extends EntityAddressAssetBase,
>(
  entityCls: ClassOf<T> & typeof BaseEntity,
  data: T[],
  options: SyncTaskOptions & {
    batchSize?: number;
    concurrency?: number;
    delayBetweenTasks?: number;
    printLog?: boolean;
    // signal?: AbortSignal;
  },
) {
  const {
    batchSize = 50,
    concurrency = 2,
    delayBetweenTasks = 1 * 1e3,
    owner_addr,
    taskFor,
    printLog = false,
    // signal = syncAbortControllers[taskFor],
  } = options;

  const taskKey = makeTaskKey(taskFor, owner_addr);
  const curAbortController = new AbortController();
  if (syncAbortControllers[taskKey]) syncAbortControllers[taskKey].abort();
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
    concurrency: 1,
  }));

  const repo = entityCls.getRepository();

  const totalRound = Math.ceil(data.length / batchSize);

  let waitAllTasksCreated = Promise.resolve();
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);

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
        const round = Math.floor(i / batchSize);
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
            items: batch,
            count: batch.length,
            total: data.length,
            round: round,
            batchSize,
          },
        };

        const makeEmit = (success: boolean) => {
          if (currentSignal.aborted) return;

          // leave here for debug
          if (eventPayload.taskFor === 'all-history') {
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
          // await repo.manager.transaction(async transactionalEntityManager => {
          //   await Promise.all(batch.map(async item => {
          //     // const modal = await transactionalEntityManager.findOne(entityCls, { where: { _db_id: item._db_id } });
          //     // if (!modal) {
          //     //   await transactionalEntityManager.save(item);
          //     //   // printLog && console.debug(`${loggerPrefix} inserted ${item._db_id}`);
          //     // } else {
          //     //   await transactionalEntityManager.update(entityCls, { _db_id: item._db_id }, item);
          //     //   // printLog && console.debug(`${loggerPrefix} updated ${item._db_id}`);
          //     // }
          //   }))
          //     .then(() => {
          //       printLog && console.debug(`${loggerPrefix}Batch ${roundPercent} upsertion successfully.`);
          //     })
          //     .catch(error => {
          //       printLog && console.error(`${loggerPrefix}Batch ${roundPercent} upsertion failed.`);
          //       throw error
          //     });
          // });
          await repo.manager.upsert(
            entityCls,
            // @ts-expect-error
            batch,
            // bar
            { conflictPaths: ['_db_id'] },
          );
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

  return {
    taskKey,
    taskSignal: currentSignal,
  };
}
