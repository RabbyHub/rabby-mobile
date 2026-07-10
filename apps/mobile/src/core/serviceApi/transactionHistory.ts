import type { TransactionHistoryService } from '@/core/services/transactionHistory';
import type {
  CustomTxItem,
  TransactionGroup,
} from '@/core/services/transactionHistory';
import { getRegisteredService } from '@/core/services/serviceRegistry';
import {
  createDeferredServiceApi,
  registerLegacyCoreServiceLoader,
} from './createDeferredServiceApi';

export type TransactionHistoryServiceApiContract = TransactionHistoryService;

registerLegacyCoreServiceLoader('transactionHistoryService');

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
  const service = getRegisteredService('transactionHistoryService');
  if (!service) {
    return EMPTY_TRANSACTION_LIST;
  }
  return service.getList(address);
}

export function getTransactionHistoryRecentPendingSnapshot(
  address: string,
  type: Parameters<TransactionHistoryService['getRecentPendingTxHistory']>[1],
) {
  const service = getRegisteredService('transactionHistoryService');
  if (!service) {
    return null;
  }
  return service.getRecentPendingTxHistory(address, type);
}

export function getTransactionHistoryRecentTxSnapshot(
  ...args: Parameters<TransactionHistoryService['getRecentTxHistory']>
) {
  const service = getRegisteredService('transactionHistoryService');
  if (!service) {
    return null;
  }
  return service.getRecentTxHistory(...args);
}

const EMPTY_CUSTOM_TX_ITEM_MAP: Record<string, CustomTxItem> = {};

export function getTransactionHistoryCustomTxItemMapSnapshot() {
  const service = getRegisteredService('transactionHistoryService');
  if (!service) {
    return EMPTY_CUSTOM_TX_ITEM_MAP;
  }
  return service.getCustomTxItemMap();
}

export function getTransactionHistoryTransactionsSnapshot() {
  const service = getRegisteredService('transactionHistoryService');
  if (!service) {
    return [];
  }
  return service.store.transactions;
}

export function getTransactionHistorySwapFailTransactionsSnapshot(
  address: string,
) {
  const service = getRegisteredService('transactionHistoryService');
  if (!service) {
    return [];
  }
  return service.getSwapFailTransactions(address);
}

export function getTransactionHistorySucceedListSnapshot() {
  const service = getRegisteredService('transactionHistoryService');
  if (!service) {
    return [];
  }
  return service.getSucceedList();
}

export function getTransactionHistorySucceedCountSnapshot(address?: string) {
  const service = getRegisteredService('transactionHistoryService');
  if (!service) {
    return 0;
  }
  return service.getSucceedCount(address);
}

export function getTransactionHistoryFailedCountSnapshot(address?: string) {
  const service = getRegisteredService('transactionHistoryService');
  if (!service) {
    return 0;
  }
  return service.getFailedCount(address);
}

export function getTransactionHistoryClearSuccessAndFailListTsSnapshot() {
  const service = getRegisteredService('transactionHistoryService');
  if (!service) {
    return Date.now();
  }
  return service.getClearSuccessAndFailListTs();
}

export function getTransactionHistoryPendingsAddressesSnapshot(
  addresses: string[],
) {
  const service = getRegisteredService('transactionHistoryService');
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
  const service = getRegisteredService('transactionHistoryService');
  if (!service) {
    return [];
  }
  return service.getLendingSuccessHistoryList(address);
}
