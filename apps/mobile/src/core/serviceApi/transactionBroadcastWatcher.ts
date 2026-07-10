import type { TransactionBroadcastWatcherService } from '@/core/services/transactionBroadcastWatcher';
import { getRegisteredService } from '@/core/services/serviceRegistry';
import {
  createDeferredServiceApi,
  registerLegacyCoreServiceLoader,
} from './createDeferredServiceApi';

export type TransactionBroadcastWatcherServiceApiContract =
  TransactionBroadcastWatcherService;

registerLegacyCoreServiceLoader('transactionBroadcastWatcherService');

export const transactionBroadcastWatcherServiceApi = createDeferredServiceApi<
  'transactionBroadcastWatcherService',
  TransactionBroadcastWatcherServiceApiContract
>('transactionBroadcastWatcherService');

export function addBroadcastTransactionSync(
  ...args: Parameters<TransactionBroadcastWatcherService['addTx']>
) {
  const service = getRegisteredService('transactionBroadcastWatcherService');
  if (!service) {
    throw new Error('transactionBroadcastWatcherService is not ready');
  }
  service.addTx(...args);
}
