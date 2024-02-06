import { findChainByID } from '@/utils/chain';
import {
  transactionBroadcastWatcherService,
  transactionHistoryService,
  transactionWatcherService,
} from '../services';

export const clearPendingTxs = (address: string) => {
  transactionHistoryService.clearPendingTransactions(address);
  transactionWatcherService.clearPendingTx(address);
  transactionBroadcastWatcherService.clearPendingTx(address);
  return;
};
