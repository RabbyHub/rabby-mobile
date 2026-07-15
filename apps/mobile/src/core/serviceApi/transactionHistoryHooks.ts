import {
  serviceDependency,
  useCoreServiceDependencies,
} from './serviceDependencies';

const TRANSACTION_HISTORY_DEPENDENCIES = [
  serviceDependency('transactionHistoryService'),
] as const;

/**
 * Activates transaction history on demand and lets reactive snapshot consumers
 * sample again after the deferred service becomes available.
 */
export function useTransactionHistoryServiceReady() {
  return (
    useCoreServiceDependencies(TRANSACTION_HISTORY_DEPENDENCIES).status ===
    'ready'
  );
}
