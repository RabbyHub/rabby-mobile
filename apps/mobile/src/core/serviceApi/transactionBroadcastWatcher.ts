import type { TransactionBroadcastWatcherService } from '@/core/services/transactionBroadcastWatcher';
import {
  createDeferredServiceApi,
  registerLegacyCoreServiceLoader,
  runServiceSideEffectWhenReady,
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
  runServiceSideEffectWhenReady(
    'transactionBroadcastWatcherService',
    service => service.addTx(...args),
    'transactionBroadcastWatcherService.addTx',
  );
}
