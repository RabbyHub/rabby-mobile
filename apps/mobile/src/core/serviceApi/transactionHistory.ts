import type { TransactionHistoryService } from '@/core/services/transactionHistory';
import type {
  CustomTxItem,
  SendTxHistoryItem,
  TransactionGroup,
} from '@/core/services/transactionHistory';
import {
  callCoreService,
  getLoadedCoreService,
} from '@/core/services/serviceRegistry';
import { createDeferredServiceApi } from './createDeferredServiceApi';

export type TransactionHistoryServiceApiContract = TransactionHistoryService;
export const transactionHistoryServiceApi = createDeferredServiceApi<
  'transactionHistoryService',
  TransactionHistoryServiceApiContract
>('transactionHistoryService');

const EMPTY_TRANSACTION_LIST: {
  pendings: TransactionGroup[];
  completeds: TransactionGroup[];
} = {
  pendings: [],
  completeds: [],
};

export function getTransactionHistoryListSnapshot(address: string) {
  const service = getLoadedCoreService('transactionHistoryService');
  if (!service) {
    return EMPTY_TRANSACTION_LIST;
  }
  return service.getList(address);
}

export function getTransactionHistoryRecentPendingSnapshot(
  address: string,
  type: Parameters<TransactionHistoryService['getRecentPendingTxHistory']>[1],
) {
  const service = getLoadedCoreService('transactionHistoryService');
  if (!service) {
    return null;
  }
  return service.getRecentPendingTxHistory(address, type);
}

export function getTransactionHistoryRecentTxSnapshot(
  ...args: Parameters<TransactionHistoryService['getRecentTxHistory']>
) {
  const service = getLoadedCoreService('transactionHistoryService');
  if (!service) {
    return null;
  }
  return service.getRecentTxHistory(...args);
}

const EMPTY_CUSTOM_TX_ITEM_MAP: Record<string, CustomTxItem> = {};
const EMPTY_SEND_TX_HISTORY: SendTxHistoryItem[] = [];

export function getTransactionHistoryCustomTxItemMapSnapshot() {
  const service = getLoadedCoreService('transactionHistoryService');
  if (!service) {
    return EMPTY_CUSTOM_TX_ITEM_MAP;
  }
  return service.getCustomTxItemMap();
}

export function getTransactionHistorySendListSnapshot() {
  const service = getLoadedCoreService('transactionHistoryService');
  if (!service) {
    return EMPTY_SEND_TX_HISTORY;
  }
  return service.getStoreFieldSnapshot('sendTxHistory');
}

export async function getTransactionHistoryTransactions() {
  return callCoreService('transactionHistoryService', service =>
    service.getStoreFieldSnapshot('transactions'),
  );
}

export async function getTransactionHistoryCustomTxItemMap() {
  return callCoreService('transactionHistoryService', service =>
    service.getCustomTxItemMap(),
  );
}

export async function getTransactionHistorySwapFailTransactions(
  address: string,
) {
  return callCoreService('transactionHistoryService', service =>
    service.getSwapFailTransactions(address),
  );
}

export function getTransactionHistorySwapFailTransactionsSnapshot(
  address: string,
) {
  const service = getLoadedCoreService('transactionHistoryService');
  if (!service) {
    return [];
  }
  return service.getSwapFailTransactions(address);
}

export function getTransactionHistorySucceedListSnapshot() {
  const service = getLoadedCoreService('transactionHistoryService');
  if (!service) {
    return [];
  }
  return service.getSucceedList();
}

export function getTransactionHistorySucceedCountSnapshot(address?: string) {
  const service = getLoadedCoreService('transactionHistoryService');
  if (!service) {
    return 0;
  }
  return service.getSucceedCount(address);
}

export function getTransactionHistoryFailedCountSnapshot(address?: string) {
  const service = getLoadedCoreService('transactionHistoryService');
  if (!service) {
    return 0;
  }
  return service.getFailedCount(address);
}

export function getTransactionHistoryClearSuccessAndFailListTsSnapshot() {
  const service = getLoadedCoreService('transactionHistoryService');
  if (!service) {
    return Date.now();
  }
  return service.getClearSuccessAndFailListTs();
}

export function getTransactionHistoryPendingsAddressesSnapshot(
  addresses: string[],
) {
  const service = getLoadedCoreService('transactionHistoryService');
  if (!service) {
    return {
      pendings: [],
      pendingsLength: 0,
    };
  }
  return service.getPendingsAddresses(addresses);
}

export function getTransactionHistoryLendingSuccessListSnapshot(
  address: string,
) {
  const service = getLoadedCoreService('transactionHistoryService');
  if (!service) {
    return [];
  }
  return service.getLendingSuccessHistoryList(address);
}
