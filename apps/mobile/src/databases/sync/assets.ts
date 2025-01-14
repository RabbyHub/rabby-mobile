import { Repository } from 'typeorm/browser';
import PQueue from 'p-queue';

import { batchQueryTokens } from '@/screens/Home/utils/token';
import { type EntityAddressAssetBase } from '../entities/base';
import { TokenItemEntity } from '../entities/tokenitem';
import { prepareAppDataSource } from '../orm';
import { HistoryItemEntity } from '../entities/historyItem';
import { openapi } from '@/core/request';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const keyVaryUpsertQueue: Record<string, PQueue> = {};

async function batchSaveWithPQueueAndTransaction<
  T extends EntityAddressAssetBase,
>(
  repo: Repository<T>,
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

  console.debug(
    `${loggerPrefix}Starting to upsert ${data.length} records in batches of ${batchSize} with concurrency level ${concurrency}.`,
  );

  const totalRound = Math.ceil(data.length / batchSize);
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
        await repo.manager.transaction(async transactionalEntityManager => {
          try {
            const round = `${i / batchSize + 1} / ${totalRound}`;
            console.debug(`${loggerPrefix}Batch ${round} upsert started.`);
            // await transactionalEntityManager.upsert(batch);
            await transactionalEntityManager.save(batch);
            console.debug(`${loggerPrefix}Batch ${round} upsert successfully.`);
          } catch (error) {
            console.error(
              `${loggerPrefix}Error inserting batch ${i / batchSize + 1}:`,
              error,
            );
            // Re-throw the error to rollback the transaction
            throw error;
          }
        });
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

export async function syncRemoteTokens(address: string, tokens: TokenItem[]) {
  const tokenItems = tokens.map(raw => {
    const tokenItem = new TokenItemEntity();
    TokenItemEntity.fillEntity(tokenItem, address, raw);

    return tokenItem;
  });

  await prepareAppDataSource();

  // // leave here for debug save
  // const saveResult = await TokenItemEntity.save(tokenItems).catch(err => {
  //   console.error('TokenItemEntity.save err', err);
  //   throw err;
  // });
  await batchSaveWithPQueueAndTransaction(
    TokenItemEntity.getRepository(),
    tokenItems,
    {
      key: address,
      batchSize: 100,
      concurrency: 1,
      delayBetweenTasks: 1.5 * 1e3,
    },
  )
    .then(() => {
      console.debug('batch upsert tasks created');
    })
    .catch(error => {
      console.error('Batch upsert failed:', error);
    });
}

export async function syncRemoteHistory(address: string) {
  try {
    const res = await openapi.listTxHisotry({
      id: address,
      start_time: 0,
      page_count: 1000,
      chain_id: undefined,
      token_id: undefined,
    });

    console.debug(
      'syncRemoteHistory res.history_list.length',
      res.history_list.length,
    );

    const historyItems = res.history_list.map(raw => {
      const item = new HistoryItemEntity();
      HistoryItemEntity.fillEntity(item, address, raw);

      return item;
    });
    await prepareAppDataSource();
    // // leave here for debug save
    // const saveResult = await TokenItemEntity.save(tokenItems).catch(err => {
    //   console.error('TokenItemEntity.save err', err);
    //   throw err;
    // });
    console.debug('syncRemoteHistory batchSaveWithPQueueAndTransaction');
    await batchSaveWithPQueueAndTransaction(
      HistoryItemEntity.getRepository(),
      historyItems,
      {
        key: address,
        batchSize: 100,
        concurrency: 1,
        delayBetweenTasks: 1.5 * 1e3,
      },
    )
      .then(() => {
        console.debug('batch upsert tasks created');
      })
      .catch(error => {
        console.error('Batch upsert failed:', error);
      });

    console.debug('syncRemoteHistory batchSaveWithPQueueAndTransaction done');
    return {
      address,
      res,
      history_list: res.history_list,
    };
  } catch (e) {
    console.error('syncRemoteHistory', e);
  }
}
