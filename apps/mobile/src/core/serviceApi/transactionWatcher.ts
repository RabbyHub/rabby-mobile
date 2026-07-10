import type { TransactionWatcherService } from '@/core/services/transactionWatcher';
import { getRegisteredService } from '@/core/services/serviceRegistry';
import {
  createDeferredServiceApi,
  registerLegacyCoreServiceLoader,
} from './createDeferredServiceApi';

export type TransactionWatcherServiceApiContract = TransactionWatcherService;

registerLegacyCoreServiceLoader('transactionWatcherService');

export const transactionWatcherServiceApi = createDeferredServiceApi<
  'transactionWatcherService',
  TransactionWatcherServiceApiContract
>('transactionWatcherService');

export function addWatchedTransactionSync(
  ...args: Parameters<TransactionWatcherService['addTx']>
) {
  const service = getRegisteredService('transactionWatcherService');
  if (!service) {
    throw new Error('transactionWatcherService is not ready');
  }
  service.addTx(...args);
}
