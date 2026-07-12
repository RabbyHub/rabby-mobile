import type { TransactionWatcherService } from '@/core/services/transactionWatcher';
import {
  createDeferredServiceApi,
  registerLegacyCoreServiceLoader,
  runServiceSideEffectWhenReady,
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
  runServiceSideEffectWhenReady(
    'transactionWatcherService',
    service => service.addTx(...args),
    'transactionWatcherService.addTx',
  );
}
