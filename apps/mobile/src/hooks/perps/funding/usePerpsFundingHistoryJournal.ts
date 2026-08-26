import { useCallback, useEffect, useRef } from 'react';

import { getTransactionHistoryListSnapshot } from '@/core/serviceApi/transactionHistory';
import { useTransactionHistoryServiceReady } from '@/core/serviceApi/transactionHistoryHooks';
import { eventBus, EVENTS } from '@/utils/events';

import {
  fetchUserNonFundingLedgerUpdates,
  perpsStore,
  reconcilePerpsFundingHistoryObservation,
} from '../usePerpsStore';
import {
  getPerpsPendingFundingCount,
  isPerpsFundingJournalEntryForAccount,
  readPerpsFundingJournal,
  updatePerpsFundingJournalStatus,
} from './fundingJournal';
import { mapPerpsFundingJournalEntryToHistory } from './fundingHistory';
import { startPerpsFundingLedgerPolling } from './fundingHistoryPolling';

export const usePerpsFundingHistoryJournal = ({
  enabled = true,
}: { enabled?: boolean } = {}) => {
  const currentAccount = perpsStore(state => state.currentPerpsAccount);
  const pendingFundingCount = perpsStore(state =>
    getPerpsPendingFundingCount(state.localLoadingHistory),
  );
  const transactionHistoryReady = useTransactionHistoryServiceReady();
  const accountAddress = currentAccount?.address;
  const accountType = currentAccount?.type;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const reconcileSourceTransactions = useCallback(() => {
    if (!transactionHistoryReady || !accountAddress) {
      return;
    }
    const { completeds } = getTransactionHistoryListSnapshot(accountAddress);
    const failedHashes = new Set(
      completeds
        .filter(
          group => group.isFailed || group.isSubmitFailed || group.isWithdrawed,
        )
        .flatMap(group => group.txs)
        .flatMap(tx => (tx.hash ? [tx.hash.toLowerCase()] : [])),
    );
    const successfulHashes = new Set(
      completeds
        .filter(
          group =>
            !group.isFailed && !group.isSubmitFailed && !group.isWithdrawed,
        )
        .flatMap(group => group.txs)
        .flatMap(tx => (tx.hash ? [tx.hash.toLowerCase()] : [])),
    );
    const current = perpsStore.getState().localLoadingHistory;
    let changed = false;
    let shouldRefreshLedger = false;
    const next = current.map(item => {
      const sourceHash = item.sourceHash || item.hash;
      if (item.status !== 'pending' || !sourceHash) {
        return item;
      }
      const normalizedSourceHash = sourceHash.toLowerCase();
      if (successfulHashes.has(normalizedSourceHash)) {
        shouldRefreshLedger = true;
      }
      if (!failedHashes.has(normalizedSourceHash)) {
        return item;
      }
      changed = true;
      if (item.operationId) {
        void updatePerpsFundingJournalStatus(item.operationId, 'failed');
      }
      return { ...item, status: 'failed' as const };
    });
    if (changed) {
      perpsStore.setState(state => ({ ...state, localLoadingHistory: next }));
    }
    if (enabledRef.current && shouldRefreshLedger) {
      void fetchUserNonFundingLedgerUpdates();
    }
  }, [accountAddress, transactionHistoryReady]);

  useEffect(() => {
    if (!currentAccount) {
      return;
    }
    let active = true;
    void readPerpsFundingJournal().then(entries => {
      if (!active) {
        return;
      }
      const persisted = entries
        .filter(entry =>
          isPerpsFundingJournalEntryForAccount(entry, currentAccount),
        )
        .filter(entry => entry.status !== 'confirmed')
        .map(mapPerpsFundingJournalEntryToHistory);
      const existing = perpsStore.getState().localLoadingHistory;
      const persistedIds = new Set(
        persisted.flatMap(item => (item.operationId ? [item.operationId] : [])),
      );
      const unpersisted = existing.filter(
        item => !item.operationId || !persistedIds.has(item.operationId),
      );
      const remoteHistory = perpsStore.getState().userAccountHistory;
      reconcilePerpsFundingHistoryObservation({
        confirmedHistory: remoteHistory,
        localHistory: [...persisted, ...unpersisted],
        observation: 'baseline',
        remoteWrite: 'replace',
      });
      reconcileSourceTransactions();
    });
    return () => {
      active = false;
    };
  }, [
    accountAddress,
    accountType,
    currentAccount,
    reconcileSourceTransactions,
  ]);

  useEffect(() => {
    if (!transactionHistoryReady || !accountAddress) {
      return;
    }
    reconcileSourceTransactions();
    eventBus.addListener(EVENTS.RELOAD_TX, reconcileSourceTransactions);
    return () => {
      eventBus.removeListener(EVENTS.RELOAD_TX, reconcileSourceTransactions);
    };
  }, [accountAddress, reconcileSourceTransactions, transactionHistoryReady]);

  useEffect(() => {
    if (!enabled || !accountAddress || pendingFundingCount === 0) {
      return;
    }
    const normalizedAddress = accountAddress.toLowerCase();
    return startPerpsFundingLedgerPolling({
      fetchLedger: fetchUserNonFundingLedgerUpdates,
      shouldContinue: () => {
        const state = perpsStore.getState();
        const activeAccount = state.currentPerpsAccount;
        return (
          !!activeAccount &&
          activeAccount.address.toLowerCase() === normalizedAddress &&
          activeAccount.type === accountType &&
          getPerpsPendingFundingCount(state.localLoadingHistory) > 0
        );
      },
    });
  }, [accountAddress, accountType, enabled, pendingFundingCount]);
};
