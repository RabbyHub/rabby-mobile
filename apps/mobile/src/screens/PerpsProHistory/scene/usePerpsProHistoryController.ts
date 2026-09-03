import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import type { WsFill } from '@rabby-wallet/hyperliquid-sdk';
import type { PerpsFundingJournalEntry } from '@/core/services/perpsService';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useTranslation } from 'react-i18next';

import { showToast } from '@/hooks/perps/showToast';
import {
  isPerpsFundingJournalEntryForAccount,
  readPerpsFundingJournal,
} from '@/hooks/perps/funding/fundingJournal';
import { PERPS_FUNDING_PENDING_VISIBILITY_TTL_MS } from '@/hooks/perps/funding/fundingHistoryReconciliation';
import { mergeUserFills, reconcileHttpFills } from '@/hooks/perps/userFills';
import {
  confirmPerpsFundingOperations,
  fetchSpotMeta,
  getPerpsAccountRuntimeContext,
  perpsStore,
} from '@/hooks/perps/usePerpsStore';

import { mergePerpsProHistoryRows } from '../model/historyModel';
import { mergePerpsProLocalTransactionHistory } from '../model/localTransactionHistory';
import { mapPerpsProHistoryRawRows } from '../model/historyRows';
import {
  applyPerpsProOrderExecution,
  buildPerpsProOrderExecutionIndex,
} from '../model/orderExecution';
import {
  isPerpsProHistorySdkSupported,
  perpsProHistoryRepository,
} from '../repository/perpsProHistoryRepository';
import type {
  PerpsProHistoryRow,
  PerpsProHistoryTab,
  PerpsProHistoryTabState,
} from '../types';
import {
  createPerpsProHistoryState,
  getPerpsProHistoryOldestTime,
  getPerpsProHistoryRowsStatus,
  getPerpsProHistoryTabLimit,
  makePerpsProHistoryEarlierWindow,
  PERPS_PRO_HISTORY_TABS,
  type PerpsProHistoryControllerState,
  type UpdatePerpsProHistoryTabState,
} from './perpsProHistoryControllerState';
import {
  loadEarlierPerpsProHistoryBatch,
  loadLatestPerpsProHistoryBatch,
} from './perpsProHistoryRequests';
import { usePerpsProHistorySubscriptions } from './usePerpsProHistorySubscriptions';

type RequestToken = Readonly<{
  accountAddress: string;
  accountGeneration: number;
  sequence: number;
  tab: PerpsProHistoryTab;
}>;

type RefreshPresentation = 'background' | 'manual';
const EMPTY_LOCAL_FUNDING_HISTORY = [] as const;

const getNextPendingPresentationExpirationAt = ({
  journalEntries,
  localHistory,
  now,
}: {
  journalEntries: readonly PerpsFundingJournalEntry[];
  localHistory: readonly { status: string; time: number }[];
  now: number;
}) => {
  let earliest: number | null = null;
  const include = (status: string, time: number) => {
    if (status !== 'pending' || !Number.isFinite(time)) {
      return;
    }
    const expirationAt = time + PERPS_FUNDING_PENDING_VISIBILITY_TTL_MS;
    if (expirationAt <= now) {
      return;
    }
    earliest =
      earliest === null ? expirationAt : Math.min(earliest, expirationAt);
  };
  journalEntries.forEach(entry => include(entry.status, entry.createdAt));
  localHistory.forEach(item => include(item.status, item.time));
  return earliest;
};

export const usePerpsProHistoryController = (
  initialTab: PerpsProHistoryTab = 'orders',
  active = true,
) => {
  const { t } = useTranslation();
  const currentAccount = perpsStore(state => state.currentPerpsAccount);
  const localFundingHistory = perpsStore(
    state => state.localLoadingHistory ?? EMPTY_LOCAL_FUNDING_HISTORY,
  );
  const isRuntimeInitialized = perpsStore(state => state.isInitialized);
  const [appState, setAppState] = useState<AppStateStatus>(
    AppState.currentState,
  );
  const [activeTab, setActiveTabState] =
    useState<PerpsProHistoryTab>(initialTab);
  const [historyState, setHistoryState] =
    useState<PerpsProHistoryControllerState>(createPerpsProHistoryState);
  const [fundingJournalEntries, setFundingJournalEntries] = useState<
    PerpsFundingJournalEntry[]
  >([]);
  const [pendingPresentationClock, setPendingPresentationClock] = useState(
    Date.now,
  );
  const stateRef = useRef(historyState);
  const requestSequencesRef = useRef<Record<PerpsProHistoryTab, number>>({
    funding: 0,
    orders: 0,
    trade: 0,
    transaction: 0,
  });
  const inFlightRequestsRef = useRef<Record<PerpsProHistoryTab, boolean>>({
    funding: false,
    orders: false,
    trade: false,
    transaction: false,
  });
  const accountIdentityRef = useRef<string | null>(null);
  const orderFillsRef = useRef<WsFill[]>([]);
  const orderExecutionIndexRef = useRef(buildPerpsProOrderExecutionIndex([]));
  const externalActiveRef = useRef(active);
  const sdkSupported = useMemo(isPerpsProHistorySdkSupported, []);
  const accountAddress = currentAccount?.address ?? null;
  const accountIdentity = currentAccount
    ? `${currentAccount.address.toLowerCase()}::${currentAccount.type}`
    : null;
  const nextPendingPresentationExpirationAt =
    getNextPendingPresentationExpirationAt({
      journalEntries: fundingJournalEntries,
      localHistory: localFundingHistory,
      now: pendingPresentationClock,
    });
  const accountGeneration = getPerpsAccountRuntimeContext().generation;
  const refreshFailedMessage = t('page.perps.pro.history.refreshFailed');
  const enabled =
    active &&
    appState === 'active' &&
    !!accountAddress &&
    isRuntimeInitialized &&
    sdkSupported;
  const guardRef = useRef({
    accountAddress,
    accountGeneration,
    activeTab,
    enabled,
  });
  guardRef.current = {
    accountAddress,
    accountGeneration,
    activeTab,
    enabled,
  };

  useEffect(() => {
    stateRef.current = historyState;
  }, [historyState]);

  useEffect(() => {
    const wasActive = externalActiveRef.current;
    externalActiveRef.current = active;
    if (wasActive || !active) {
      return;
    }
    const previous = stateRef.current;
    const next = { ...previous };
    let changed = false;
    PERPS_PRO_HISTORY_TABS.forEach(tab => {
      const tabState = previous[tab];
      const status = tabState.status === 'loading' ? 'idle' : tabState.status;
      if (
        status !== tabState.status ||
        tabState.refreshing ||
        tabState.loadingEarlier
      ) {
        changed = true;
        next[tab] = {
          ...tabState,
          loadingEarlier: false,
          refreshing: false,
          status,
        };
      }
    });
    if (changed) {
      stateRef.current = next;
      setHistoryState(next);
    }
  }, [active]);

  useEffect(() => {
    if (!active) {
      return;
    }
    if (!currentAccount) {
      setFundingJournalEntries([]);
      return;
    }
    let requestActive = true;
    void readPerpsFundingJournal().then(entries => {
      if (requestActive) {
        setFundingJournalEntries(
          entries.filter(entry =>
            isPerpsFundingJournalEntryForAccount(entry, currentAccount),
          ),
        );
      }
    });
    return () => {
      requestActive = false;
    };
  }, [accountIdentity, active, currentAccount, localFundingHistory]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', setAppState);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!enabled || nextPendingPresentationExpirationAt === null) {
      return;
    }
    let timer: ReturnType<typeof setTimeout> | null = null;
    const expireAtDeadline = () => {
      const remaining = nextPendingPresentationExpirationAt - Date.now();
      if (remaining > 0) {
        timer = setTimeout(expireAtDeadline, remaining);
        return;
      }
      setPendingPresentationClock(Date.now());
    };
    timer = setTimeout(
      expireAtDeadline,
      Math.max(0, nextPendingPresentationExpirationAt - Date.now()),
    );
    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [enabled, nextPendingPresentationExpirationAt]);

  const invalidateAll = useCallback(() => {
    PERPS_PRO_HISTORY_TABS.forEach(tab => {
      requestSequencesRef.current[tab] += 1;
      inFlightRequestsRef.current[tab] = false;
    });
  }, []);

  useEffect(
    () => () => {
      guardRef.current = {
        ...guardRef.current,
        enabled: false,
      };
      invalidateAll();
    },
    [invalidateAll],
  );

  useEffect(() => {
    if (accountIdentityRef.current === null) {
      accountIdentityRef.current = accountIdentity;
      return;
    }
    if (accountIdentityRef.current === accountIdentity) {
      return;
    }
    accountIdentityRef.current = accountIdentity;
    orderFillsRef.current = [];
    orderExecutionIndexRef.current = buildPerpsProOrderExecutionIndex([]);
    invalidateAll();
    const nextState = createPerpsProHistoryState();
    stateRef.current = nextState;
    setHistoryState(nextState);
  }, [accountIdentity, invalidateAll]);

  useEffect(() => {
    if (enabled) {
      return;
    }
    invalidateAll();
    if (!active) {
      return;
    }
    setHistoryState(previous => {
      const next = { ...previous };
      let changed = false;
      PERPS_PRO_HISTORY_TABS.forEach(tab => {
        const tabState = previous[tab];
        const status = tabState.status === 'loading' ? 'idle' : tabState.status;
        if (
          status !== tabState.status ||
          tabState.refreshing ||
          tabState.loadingEarlier
        ) {
          changed = true;
          next[tab] = {
            ...tabState,
            loadingEarlier: false,
            refreshing: false,
            status,
          };
        }
      });
      if (!changed) {
        return previous;
      }
      stateRef.current = next;
      return next;
    });
  }, [active, enabled, invalidateAll]);

  const updateTabState = useCallback<UpdatePerpsProHistoryTabState>(
    (tab, updater) => {
      setHistoryState(previous => {
        const next = {
          ...previous,
          [tab]: updater(previous[tab]),
        };
        stateRef.current = next;
        return next;
      });
    },
    [],
  );

  const beginRequest = useCallback(
    (tab: PerpsProHistoryTab): RequestToken | null => {
      const guard = guardRef.current;
      if (
        !guard.enabled ||
        !guard.accountAddress ||
        inFlightRequestsRef.current[tab]
      ) {
        return null;
      }
      const sequence = requestSequencesRef.current[tab] + 1;
      requestSequencesRef.current[tab] = sequence;
      inFlightRequestsRef.current[tab] = true;
      return {
        accountAddress: guard.accountAddress,
        accountGeneration: guard.accountGeneration,
        sequence,
        tab,
      };
    },
    [],
  );

  const finishRequest = useCallback((token: RequestToken) => {
    if (requestSequencesRef.current[token.tab] === token.sequence) {
      inFlightRequestsRef.current[token.tab] = false;
    }
  }, []);

  const isRequestCurrent = useCallback((token: RequestToken) => {
    const guard = guardRef.current;
    return (
      guard.enabled &&
      guard.accountGeneration === token.accountGeneration &&
      !!guard.accountAddress &&
      isSameAddress(guard.accountAddress, token.accountAddress) &&
      requestSequencesRef.current[token.tab] === token.sequence
    );
  }, []);

  const isSubscriptionCurrent = useCallback(
    (
      tab: PerpsProHistoryTab,
      subscribedAddress: string,
      subscribedGeneration: number,
    ) => {
      const guard = guardRef.current;
      return (
        guard.enabled &&
        guard.activeTab === tab &&
        guard.accountGeneration === subscribedGeneration &&
        !!guard.accountAddress &&
        isSameAddress(guard.accountAddress, subscribedAddress)
      );
    },
    [],
  );

  const mapRawRows = useCallback(
    (
      tab: PerpsProHistoryTab,
      rawItems: unknown[],
      address: string,
    ): PerpsProHistoryRow[] =>
      mapPerpsProHistoryRawRows(
        tab,
        rawItems,
        address,
        perpsStore.getState().marketDataMap,
        orderExecutionIndexRef.current,
        perpsStore.getState().spotMeta,
      ),
    [],
  );

  const rememberOrderFills = useCallback(
    (fills: WsFill[], isSnapshot: boolean) => {
      orderFillsRef.current = isSnapshot
        ? reconcileHttpFills(fills, orderFillsRef.current)
        : mergeUserFills(fills, orderFillsRef.current);
      orderExecutionIndexRef.current = buildPerpsProOrderExecutionIndex(
        orderFillsRef.current,
      );
      return orderExecutionIndexRef.current;
    },
    [],
  );

  const handleOrderFills = useCallback(
    (fills: WsFill[], isSnapshot: boolean) => {
      const executionIndex = rememberOrderFills(fills, isSnapshot);
      updateTabState('orders', previous => ({
        ...previous,
        rows: previous.rows.map(row =>
          row.kind === 'orders'
            ? applyPerpsProOrderExecution(row, executionIndex)
            : row,
        ),
      }));
    },
    [rememberOrderFills, updateTabState],
  );

  const mergeBatch = useCallback(
    (
      tab: PerpsProHistoryTab,
      rawItems: unknown[],
      address: string,
      previous: PerpsProHistoryTabState,
    ) =>
      mergePerpsProHistoryRows(
        mapRawRows(tab, rawItems, address),
        previous.rows,
        getPerpsProHistoryTabLimit(tab),
      ),
    [mapRawRows],
  );

  const loadInitial = useCallback(
    async (tab: PerpsProHistoryTab, latestFills?: Promise<WsFill[]>) => {
      const token = beginRequest(tab);
      if (!token) {
        return;
      }
      updateTabState(tab, previous => ({
        ...previous,
        error: undefined,
        status: 'loading',
      }));

      try {
        const [batch] = await Promise.all([
          loadLatestPerpsProHistoryBatch({
            accountAddress: token.accountAddress,
            latestFills,
            now: Date.now(),
            tab,
          }),
          fetchSpotMeta(),
        ]);
        if (!isRequestCurrent(token)) {
          return;
        }
        if (tab === 'orders' && batch.orderFills) {
          rememberOrderFills(batch.orderFills, true);
        }
        updateTabState(tab, previous => {
          const rows = mergeBatch(
            tab,
            batch.rawItems,
            token.accountAddress,
            previous,
          );
          return {
            ...previous,
            coveredWindow: batch.coveredWindow,
            error: undefined,
            hasEarlier:
              batch.hasEarlier && rows.length < getPerpsProHistoryTabLimit(tab),
            oldestLoadedTime: getPerpsProHistoryOldestTime(rows),
            rows,
            status: getPerpsProHistoryRowsStatus(rows),
          };
        });
      } catch (error) {
        if (!isRequestCurrent(token)) {
          return;
        }
        updateTabState(tab, previous => ({
          ...previous,
          error: error instanceof Error ? error.message : String(error),
          status: 'error',
        }));
      } finally {
        finishRequest(token);
      }
    },
    [
      beginRequest,
      finishRequest,
      isRequestCurrent,
      mergeBatch,
      rememberOrderFills,
      updateTabState,
    ],
  );

  const refreshLatest = useCallback(
    async (
      tab: PerpsProHistoryTab,
      latestFills?: Promise<WsFill[]>,
      presentation: RefreshPresentation = 'manual',
    ) => {
      const current = stateRef.current[tab];
      if (current.refreshing || current.loadingEarlier) {
        return;
      }
      if (current.status === 'idle' || current.status === 'error') {
        await loadInitial(tab, latestFills);
        return;
      }
      const token = beginRequest(tab);
      if (!token) {
        return;
      }
      if (presentation === 'manual') {
        updateTabState(tab, previous => ({
          ...previous,
          refreshError: undefined,
          refreshing: true,
        }));
      }

      try {
        const [batch] = await Promise.all([
          loadLatestPerpsProHistoryBatch({
            accountAddress: token.accountAddress,
            latestFills,
            now: Date.now(),
            tab,
          }),
          fetchSpotMeta(),
        ]);
        if (!isRequestCurrent(token)) {
          return;
        }
        if (tab === 'orders' && batch.orderFills) {
          rememberOrderFills(batch.orderFills, true);
        }
        updateTabState(tab, previous => {
          const rows = mergeBatch(
            tab,
            batch.rawItems,
            token.accountAddress,
            previous,
          );
          const coveredWindow = batch.coveredWindow
            ? {
                endTime: batch.coveredWindow.endTime,
                startTime: Math.min(
                  previous.coveredWindow?.startTime ??
                    batch.coveredWindow.startTime,
                  batch.coveredWindow.startTime,
                ),
              }
            : previous.coveredWindow;
          return {
            ...previous,
            coveredWindow,
            hasEarlier:
              previous.hasEarlier ||
              (batch.hasEarlier &&
                rows.length < getPerpsProHistoryTabLimit(tab)),
            oldestLoadedTime: getPerpsProHistoryOldestTime(rows),
            refreshError: undefined,
            refreshing: false,
            rows,
            status: getPerpsProHistoryRowsStatus(rows),
          };
        });
      } catch (error) {
        if (!isRequestCurrent(token)) {
          return;
        }
        updateTabState(tab, previous => ({
          ...previous,
          refreshError: error instanceof Error ? error.message : String(error),
          refreshing: false,
        }));
        showToast(refreshFailedMessage, 'error');
      } finally {
        finishRequest(token);
      }
    },
    [
      beginRequest,
      finishRequest,
      isRequestCurrent,
      loadInitial,
      mergeBatch,
      rememberOrderFills,
      refreshFailedMessage,
      updateTabState,
    ],
  );

  const refresh = useCallback(
    (
      tab: PerpsProHistoryTab = guardRef.current.activeTab,
      latestFills?: Promise<WsFill[]>,
    ) => refreshLatest(tab, latestFills, 'manual'),
    [refreshLatest],
  );

  const loadEarlier = useCallback(
    async (tab: PerpsProHistoryTab = guardRef.current.activeTab) => {
      const current = stateRef.current[tab];
      if (
        tab === 'orders' ||
        !current.hasEarlier ||
        current.loadingEarlier ||
        current.refreshing
      ) {
        return;
      }
      const window = makePerpsProHistoryEarlierWindow(current);
      if (!window) {
        return;
      }
      const remaining = getPerpsProHistoryTabLimit(tab) - current.rows.length;
      if (remaining <= 0) {
        updateTabState(tab, previous => ({
          ...previous,
          hasEarlier: false,
        }));
        return;
      }
      const token = beginRequest(tab);
      if (!token) {
        return;
      }
      updateTabState(tab, previous => ({
        ...previous,
        loadEarlierError: undefined,
        loadingEarlier: true,
      }));

      try {
        const [batch] = await Promise.all([
          loadEarlierPerpsProHistoryBatch({
            accountAddress: token.accountAddress,
            limit: remaining,
            tab,
            window,
          }),
          fetchSpotMeta(),
        ]);
        if (!isRequestCurrent(token)) {
          return;
        }
        updateTabState(tab, previous => {
          const rows = mergeBatch(
            tab,
            batch.rawItems,
            token.accountAddress,
            previous,
          );
          return {
            ...previous,
            coveredWindow: {
              endTime: previous.coveredWindow?.endTime ?? batch.window.endTime,
              startTime: batch.window.startTime,
            },
            hasEarlier:
              batch.rawItems.length > 0 &&
              rows.length < getPerpsProHistoryTabLimit(tab),
            loadEarlierError: undefined,
            loadingEarlier: false,
            oldestLoadedTime: getPerpsProHistoryOldestTime(rows),
            rows,
            status: getPerpsProHistoryRowsStatus(rows),
          };
        });
      } catch (error) {
        if (!isRequestCurrent(token)) {
          return;
        }
        updateTabState(tab, previous => ({
          ...previous,
          loadEarlierError:
            error instanceof Error ? error.message : String(error),
          loadingEarlier: false,
        }));
      } finally {
        finishRequest(token);
      }
    },
    [beginRequest, finishRequest, isRequestCurrent, mergeBatch, updateTabState],
  );

  const setActiveTab = useCallback((nextTab: PerpsProHistoryTab) => {
    const currentTab = guardRef.current.activeTab;
    if (nextTab === currentTab) {
      return;
    }
    setActiveTabState(nextTab);
  }, []);

  useEffect(() => {
    if (!enabled || !accountAddress) {
      return;
    }
    const idleTabs = PERPS_PRO_HISTORY_TABS.filter(
      tab => stateRef.current[tab].status === 'idle',
    );
    if (idleTabs.length === 0) {
      refreshLatest(activeTab, undefined, 'background');
      return;
    }
    const shouldLoadLatestFills = idleTabs.some(
      tab => tab === 'orders' || tab === 'trade',
    );
    const latestFills = shouldLoadLatestFills
      ? perpsProHistoryRepository.fetchLatestTrades(accountAddress)
      : undefined;
    idleTabs.forEach(tab => {
      loadInitial(
        tab,
        tab === 'orders' || tab === 'trade' ? latestFills : undefined,
      );
    });
  }, [
    accountGeneration,
    accountIdentity,
    accountAddress,
    activeTab,
    enabled,
    loadInitial,
    refreshLatest,
  ]);

  useEffect(() => {
    if (
      !active ||
      appState !== 'active' ||
      !accountAddress ||
      !isRuntimeInitialized ||
      sdkSupported
    ) {
      return;
    }
    updateTabState(activeTab, previous =>
      previous.status === 'idle'
        ? {
            ...previous,
            error: 'Perps history SDK capability is unavailable',
            status: 'error',
          }
        : previous,
    );
  }, [
    accountAddress,
    activeTab,
    appState,
    active,
    isRuntimeInitialized,
    sdkSupported,
    updateTabState,
  ]);

  usePerpsProHistorySubscriptions({
    accountAddress,
    accountGeneration,
    activeTab,
    enabled,
    isSubscriptionCurrent,
    mapRawRows,
    onOrderFills: handleOrderFills,
    updateTabState,
  });

  const transactionProjection = useMemo(
    () =>
      mergePerpsProLocalTransactionHistory({
        journalEntries: fundingJournalEntries,
        localHistory: localFundingHistory,
        now: Math.max(pendingPresentationClock, Date.now()),
        remoteRows: historyState.transaction.rows.filter(
          row => row.kind === 'transaction',
        ),
      }),
    [
      fundingJournalEntries,
      historyState.transaction.rows,
      localFundingHistory,
      pendingPresentationClock,
    ],
  );
  const unsettledConfirmations = useMemo(() => {
    const unsettled = new Set(
      fundingJournalEntries
        .filter(entry => entry.status !== 'confirmed')
        .map(entry => entry.operationId),
    );
    localFundingHistory.forEach(item => {
      if (item.operationId) {
        unsettled.add(item.operationId);
      }
    });
    return transactionProjection.confirmations.filter(confirmation =>
      unsettled.has(confirmation.operationId),
    );
  }, [
    fundingJournalEntries,
    localFundingHistory,
    transactionProjection.confirmations,
  ]);
  const confirmedOperationSignature = JSON.stringify(unsettledConfirmations);

  useEffect(() => {
    if (!enabled || unsettledConfirmations.length === 0 || !currentAccount) {
      return;
    }
    const confirmationByOperationId = new Map(
      unsettledConfirmations.map(confirmation => [
        confirmation.operationId,
        confirmation,
      ]),
    );
    confirmPerpsFundingOperations(unsettledConfirmations);
    setFundingJournalEntries(entries =>
      entries.map(entry => {
        const confirmation = confirmationByOperationId.get(entry.operationId);
        return confirmation
          ? {
              ...entry,
              providerSettlementIdentity:
                confirmation.providerSettlementIdentity ??
                entry.providerSettlementIdentity,
              status: 'confirmed' as const,
            }
          : entry;
      }),
    );
  }, [
    confirmedOperationSignature,
    currentAccount,
    enabled,
    unsettledConfirmations,
  ]);

  const presentedHistoryState = useMemo<PerpsProHistoryControllerState>(
    () => ({
      ...historyState,
      transaction: {
        ...historyState.transaction,
        rows: transactionProjection.rows,
        status:
          historyState.transaction.status === 'empty' &&
          transactionProjection.rows.length > 0
            ? 'ready'
            : historyState.transaction.status,
      },
    }),
    [historyState, transactionProjection.rows],
  );

  return {
    activeTab,
    loadEarlier,
    refresh,
    sdkSupported,
    setActiveTab,
    state: presentedHistoryState,
    tabState: presentedHistoryState[activeTab],
  };
};

export { createPerpsProHistoryState } from './perpsProHistoryControllerState';
