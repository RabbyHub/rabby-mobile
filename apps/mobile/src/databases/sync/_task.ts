import { BaseEntity } from 'typeorm/browser';
import PQueue from 'p-queue';
import { ClassOf } from '@rabby-wallet/base-utils';

import { type EntityAddressAssetBase } from '../entities/base';
import { appOrmEvents, SyncTaskOptions } from './_event';

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const keyVaryUpsertQueue: Record<string, PQueue> = {};

/**
 * @description In most cases, you don't need call it manually,
 * if you want to do that, make sure you know what you are doing.
 */
const syncAbortControllers: {
  [P in SyncTaskOptions['taskFor']]: AbortController | null;
} = {
  balance: null,
  token: null,
  nfts: null,
  protocols: null,
  'all-history': null,
  'swap-history': null,
};

export function abortAllSyncTasks() {
  for (const key in syncAbortControllers) {
    const controller = syncAbortControllers[key] as AbortController | null;
    controller?.abort();
  }
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
    // signal?: AbortSignal;
  },
) {
  const {
    batchSize = 50,
    concurrency = 2,
    delayBetweenTasks = 1 * 1e3,
    owner_addr,
    taskFor,
    // signal = syncAbortControllers[taskFor],
  } = options;

  if (syncAbortControllers[taskFor]) {
    syncAbortControllers[taskFor].abort();
    syncAbortControllers[taskFor] = new AbortController();
  }

  const currentSignal = syncAbortControllers[taskFor]?.signal;

  const key = [owner_addr, taskFor].filter(Boolean).join('-');
  const loggerPrefix = !owner_addr
    ? ''
    : `[batchSaveWithPQueueAndTransaction::${key}] `;

  if (key && keyVaryUpsertQueue[key]) {
    keyVaryUpsertQueue[key].clear();
    delete keyVaryUpsertQueue[key];
  }

  const thisTickUpsertQueue = !key
    ? new PQueue({ concurrency: 1 })
    : (keyVaryUpsertQueue[key] = new PQueue({ concurrency: 1 }));

  const repo = entityCls.getRepository();

  const totalRound = Math.ceil(data.length / batchSize);
  console.debug(
    `${loggerPrefix}Starting to upsert ${data.length} records with total ${totalRound} batches(size: ${batchSize}, concurrency: ${concurrency})`,
  );

  let waitTaskCompleted = Promise.resolve();
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);

    if (currentSignal?.aborted) break;

    waitTaskCompleted = waitTaskCompleted.then(async () => {
      await sleep(delayBetweenTasks);
      if (currentSignal?.aborted) {
        console.warn(
          `${loggerPrefix}Batch upsertion was upsertion before next task.`,
        );
        thisTickUpsertQueue.clear();
        return;
      }

      thisTickUpsertQueue.add(async () => {
        const round = Math.floor(i / batchSize);
        const roundText = `${round + 1}`;
        const roundPercent = `${roundText} / ${totalRound}`;
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

        try {
          // await repo.manager.transaction(async transactionalEntityManager => {
          //   await Promise.all(batch.map(async item => {
          //     // const modal = await transactionalEntityManager.findOne(entityCls, { where: { _db_id: item._db_id } });
          //     // if (!modal) {
          //     //   await transactionalEntityManager.save(item);
          //     //   // console.debug(`${loggerPrefix} inserted ${item._db_id}`);
          //     // } else {
          //     //   await transactionalEntityManager.update(entityCls, { _db_id: item._db_id }, item);
          //     //   // console.debug(`${loggerPrefix} updated ${item._db_id}`);
          //     // }
          //   }))
          //     .then(() => {
          //       console.debug(`${loggerPrefix}Batch ${roundPercent} upsertion successfully.`);
          //     })
          //     .catch(error => {
          //       console.error(`${loggerPrefix}Batch ${roundPercent} upsertion failed.`);
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
          console.debug(
            `${loggerPrefix}Batch ${roundPercent} upsertion successfully.`,
          );
          appOrmEvents.emit('onRemoteDataUpserted', {
            ...eventPayload,
            success: true,
          });
        } catch (error) {
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

  // Wait for all tasks to complete
  const waitFinalTask = await Promise.all([
    thisTickUpsertQueue.onIdle(),
    waitTaskCompleted,
  ]);

  if (currentSignal) {
    const abortListener = () => {
      console.warn(`${loggerPrefix}Batch upsertion was aborted.`);
      thisTickUpsertQueue.clear();
      currentSignal.removeEventListener('abort', abortListener);
    };

    currentSignal.addEventListener('abort', abortListener);

    try {
      waitFinalTask;
    } catch (error) {
      console.error(`${loggerPrefix}Wait batch upsertion failed:`, error);
    } finally {
      currentSignal.removeEventListener('abort', abortListener);
    }
  } else {
    waitFinalTask;
    console.debug(`${loggerPrefix}All batches have been processed.`);
  }
}
