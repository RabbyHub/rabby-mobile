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
import { PERPS_FUNDING_PENDING_VISIBILITY_TTL_MS } from './fundingHistoryReconciliation';
import { startPerpsFundingLedgerPolling } from './fundingHistoryPolling';

export const usePerpsFundingHistoryJournal = ({
  enabled = true,
}: { enabled?: boolean } = {}) => {
  const currentAccount = perpsStore(state => state.currentPerpsAccount);
  const pendingFundingCount = perpsStore(state =>
    getPerpsPendingFundingCount(state.localLoadingHistory),
  );
  const nextPendingVisibilityExpirationAt = perpsStore(state => {
    let earliest: number | null = null;
    state.localLoadingHistory.forEach(item => {
      if (item.status !== 'pending' || !Number.isFinite(item.time)) {
        return;
      }
      const expirationAt = item.time + PERPS_FUNDING_PENDING_VISIBILITY_TTL_MS;
      earliest =
        earliest === null ? expirationAt : Math.min(earliest, expirationAt);
    });
    return earliest;
  });
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
    const fundingState = perpsStore.getState();
    const current = [
      ...fundingState.localLoadingHistory,
      ...fundingState.hiddenLocalFundingHistory,
    ];
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
      reconcilePerpsFundingHistoryObservation({
        confirmedHistory: fundingState.userAccountHistory,
        localHistory: next,
        observation: 'baseline',
      });
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
      const fundingState = perpsStore.getState();
      const existing = [
        ...fundingState.localLoadingHistory,
        ...fundingState.hiddenLocalFundingHistory,
      ];
      const persistedIds = new Set(
        persisted.flatMap(item => (item.operationId ? [item.operationId] : [])),
      );
      const unpersisted = existing.filter(
        item => !item.operationId || !persistedIds.has(item.operationId),
      );
      const remoteHistory = fundingState.userAccountHistory;
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
    if (
      !enabled ||
      !accountAddress ||
      nextPendingVisibilityExpirationAt === null
    ) {
      return;
    }
    let timer: ReturnType<typeof setTimeout> | null = null;
    const normalizedAddress = accountAddress.toLowerCase();
    const expireAtDeadline = () => {
      const remaining = nextPendingVisibilityExpirationAt - Date.now();
      if (remaining > 0) {
        timer = setTimeout(expireAtDeadline, remaining);
        return;
      }
      const fundingState = perpsStore.getState();
      const activeAccount = fundingState.currentPerpsAccount;
      if (
        !activeAccount ||
        activeAccount.address.toLowerCase() !== normalizedAddress ||
        activeAccount.type !== accountType
      ) {
        return;
      }
      reconcilePerpsFundingHistoryObservation({
        confirmedHistory: fundingState.userAccountHistory,
        observation: 'baseline',
      });
    };
    timer = setTimeout(
      expireAtDeadline,
      Math.max(0, nextPendingVisibilityExpirationAt - Date.now()),
    );
    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [accountAddress, accountType, enabled, nextPendingVisibilityExpirationAt]);

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
