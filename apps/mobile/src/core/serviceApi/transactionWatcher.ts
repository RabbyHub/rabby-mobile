import type { TransactionWatcherService } from '@/core/services/transactionWatcher';
import { createDeferredServiceApi } from './createDeferredServiceApi';

export type TransactionWatcherServiceApiContract = TransactionWatcherService;
export const transactionWatcherServiceApi = createDeferredServiceApi<
  'transactionWatcherService',
  TransactionWatcherServiceApiContract
>('transactionWatcherService');
