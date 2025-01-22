import { BaseEntity, Repository } from 'typeorm/browser';
import PQueue from 'p-queue';
import { ClassOf } from '@rabby-wallet/base-utils';

import { type EntityAddressAssetBase } from '../entities/base';

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const keyVaryUpsertQueue: Record<string, PQueue> = {};

export async function batchSaveWithPQueueAndTransaction<
  T extends EntityAddressAssetBase,
>(
  entityCls: ClassOf<T> & typeof BaseEntity,
  data: T[],
  options: {
    key?: string;
    batchSize?: number;
    concurrency?: number;
    delayBetweenTasks?: number;
    signal?: AbortSignal;
  },
) {
  const {
    batchSize = 50,
    concurrency = 2,
    delayBetweenTasks = 1 * 1e3,
    key,
    signal,
  } = options;

  const loggerPrefix = !key
    ? ''
    : `[batchSaveWithPQueueAndTransaction::${key}] `;

  if (signal?.aborted) {
    console.warn(`${loggerPrefix}Batch upsert was aborted before starting.`);
    return;
  }

  if (key && keyVaryUpsertQueue[key]) {
    keyVaryUpsertQueue[key].clear();
    delete keyVaryUpsertQueue[key];
  }

  const upsertQueue = !key
    ? new PQueue({ concurrency: 1 })
    : (keyVaryUpsertQueue[key] = new PQueue({ concurrency: 1 }));

  const repo = entityCls.getRepository();

  const totalRound = Math.ceil(data.length / batchSize);
  console.debug(
    `${loggerPrefix}Starting to upsert ${data.length} records with total ${totalRound} batches(size: ${batchSize}, concurrency: ${concurrency})`,
  );

  let previousTaskCompleted = Promise.resolve();
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);

    previousTaskCompleted = previousTaskCompleted.then(async () => {
      await sleep(delayBetweenTasks);
      if (signal?.aborted) {
        console.warn(
          `${loggerPrefix}Batch upsert was aborted before next task.`,
        );
        return;
      }

      upsertQueue.add(async () => {
        const round = `${i / batchSize + 1} / ${totalRound}`;
        console.debug(`${loggerPrefix}Batch ${round} upsert started.`);

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
          //       console.debug(`${loggerPrefix}Batch ${round} upsert successfully.`);
          //     })
          //     .catch(error => {
          //       console.error(`${loggerPrefix}Batch ${round} upsert failed.`);
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
          console.debug(`${loggerPrefix}Batch ${round} upsert successfully.`);
        } catch (error) {
          console.error(
            `${loggerPrefix}Error inserting batch ${round}:`,
            error,
          );
          // Re-throw the error to rollback the transaction
          throw error;
        }
      });
    });
  }

  // Wait for all tasks to complete
  const onIdlePromise = upsertQueue.onIdle();
  if (signal) {
    const abortListener = () => {
      console.warn(`${loggerPrefix}Batch insertion was aborted.`);
      upsertQueue.clear();
    };

    signal.addEventListener('abort', abortListener);

    try {
      await onIdlePromise;
    } finally {
      signal.removeEventListener('abort', abortListener);
    }
  } else {
    await onIdlePromise;
  }
  console.debug(`${loggerPrefix}All batches have been processed.`);
}
