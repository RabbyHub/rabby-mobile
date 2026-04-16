import type { TokenItem } from '@rabby-wallet/rabby-api/dist/types';

import { TokenItemEntity } from '../entities/tokenitem';
import { prepareAppDataSource } from '../imports';
import { batchSaveWithPQueueAndTransaction } from './_task';

export async function patchSingleToken(address: string, token: TokenItem) {
  const tokenItem = new TokenItemEntity();
  TokenItemEntity.fillEntity(tokenItem, address, token);
  await prepareAppDataSource();
  await batchSaveWithPQueueAndTransaction(TokenItemEntity, [tokenItem], {
    owner_addr: address,
    taskFor: 'token',
    batchSize: 100,
    concurrency: 1,
    noNeedAbort: true,
  })
    .then(({ taskSignal, taskKey }) => {
      if (taskSignal.aborted) {
        console.warn(`[${taskKey}] patchSingleToken upsertion was aborted.`);
      } else {
        console.debug(`[${taskKey}] patchSingleToken upsert tasks created`);
      }
    })
    .catch(error => {
      console.error('Batch upsert patchSingleToken failed:', error);
    });
}
