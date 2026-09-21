import type { TransactionBroadcastWatcherService } from '@/core/services/transactionBroadcastWatcher';
import { createDeferredServiceApi } from './createDeferredServiceApi';

export type TransactionBroadcastWatcherServiceApiContract =
  TransactionBroadcastWatcherService;
export const transactionBroadcastWatcherServiceApi = createDeferredServiceApi<
  'transactionBroadcastWatcherService',
  TransactionBroadcastWatcherServiceApiContract
>('transactionBroadcastWatcherService');
