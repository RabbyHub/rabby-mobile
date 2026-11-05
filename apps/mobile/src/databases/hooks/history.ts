import { last } from 'lodash';
import { syncRemoteHistory } from '../sync/assets';
import { HistoryItemEntity } from '../entities/historyItem';
import { openapi } from '@/core/request';
import { transactionHistoryServiceApi } from '@/core/serviceApi/transactionHistory';
import {
  historySyncCoverageMetaStore,
  historySyncCoverageStore,
  historyTimeStore,
  historyTxCountCheckStore,
  markHistoryTxCountChecked,
  setHistoryLoading,
  setHistorySyncCoverage,
  updateHistoryTimeSingleAddress,
  type HistorySyncCoverage,
} from '@/hooks/historyTokenDict';
import PQueue from 'p-queue';
import { prepareAppDataSource } from '../imports';
import type {
  TxAllHistoryResult,
  TxHistoryResult,
} from '@rabby-wallet/rabby-api/dist/types';

const USE_REALTIME_API_DURATION = 24 * 5 * 60 * 60 * 1000; // use async history api if user not opened app in 5 days

const HISTORY_WINDOW_SEC = 90 * 24 * 60 * 60; // the local DB keeps 90 days of history
const ALL_HISTORY_PAGE_COUNT = 2000;
// a gap of up to two weeks fits smaller all-history pages
const ALL_HISTORY_SHORT_RANGE_SEC = 15 * 24 * 60 * 60;
const ALL_HISTORY_SHORT_RANGE_PAGE_COUNT = 500;
const ALL_HISTORY_MAX_PAGES = 5; // bounds a 90-day sync to ~10000 txs
const REALTIME_PAGE_COUNT = 20;
const REALTIME_MAX_PAGES = 25; // past ~500 new txs, finish with the all-history API

type SyncTop10HistoryOptions = {
  forceAllHistoryApi?: boolean;
};

type HistoryPage = TxAllHistoryResult | TxHistoryResult;

const nowSec = () => Math.floor(Date.now() / 1000);

const isSyncingRef = {
  current: false,
};

// a forced sync (e.g. pull to refresh) arriving mid-sync is replayed once the current round finishes
const pendingForceSyncRef: {
  current: { addresses: string[]; options?: SyncTop10HistoryOptions } | null;
} = {
  current: null,
};

const getIsNeedSyncData = async (address: string) => {
  if (await transactionHistoryServiceApi.getIsNeedFetchTxHistory(address)) {
    // some tx done need to update
    console.debug('🔍syncTop10History some tx done so isNeedSyncData');
    return true;
  }

  const latestTime = historyTimeStore.getState()?.[address] || 0;

  const currentTime = Date.now();
  const gap = currentTime - latestTime;
  const expireTime = 10 * 60 * 1000; // 10 min
  console.log(
    '🔍syncTop10History isNeedSyncData time gap',
    gap,
    'isExpire:',
    gap > expireTime,
    'add:',
    address.slice(-4),
  );
  return gap > expireTime;
};

const isRecentlySynced = (address: string) => {
  const latestUpdateTime = historyTimeStore.getState()?.[address] || 0;
  return latestUpdateTime > Date.now() - USE_REALTIME_API_DURATION;
};

const writeHistoryPage = async (address: string, res: HistoryPage) => {
  if (!(await syncRemoteHistory(address, res))) {
    // an unwritten page must not count as synced, or later syncs skip over it
    throw new Error(`history write for ${address.slice(-4)} did not complete`);
  }
};

/**
 * Walk history pages from the newest tx back to `until` (seconds), writing each
 * page before fetching the next.
 *
 * @returns the newest written `time_at` (0 when none), and whether `until` was
 * reached before `maxPages` ran out
 */
const syncPagesUntil = async (
  address: string,
  until: number,
  {
    pageCount,
    maxPages,
    fetchPage,
  }: {
    pageCount: number;
    maxPages: number;
    fetchPage: (startTime: number, pageCount: number) => Promise<HistoryPage>;
  },
) => {
  let startTime = 0;
  let newest = 0;
  for (let page = 0; page < maxPages; page++) {
    const res = await fetchPage(startTime, pageCount);
    const inRange = res.history_list.filter(i => i.time_at >= until);
    if (inRange.length) {
      await writeHistoryPage(address, { ...res, history_list: inRange });
      newest = Math.max(newest, ...inRange.map(i => i.time_at));
    }
    const lastItem = last(res.history_list);
    if (!lastItem || lastItem.time_at < until) {
      return { newest, reached: true };
    }
    startTime = lastItem.time_at;
  }
  return { newest, reached: false };
};

const fetchAllHistoryPage =
  (address: string) => (startTime: number, pageCount: number) =>
    openapi.getAllTxHistory({
      id: address,
      start_time: startTime,
      page_count: pageCount,
    });

const fetchRealTimeHistoryPage =
  (address: string) => (startTime: number, pageCount: number) =>
    openapi.listTxHistory({
      id: address,
      start_time: startTime,
      page_count: pageCount,
    });

/**
 * The 90-day completeness check: local history counts as complete only once a
 * sync has written the whole window, and only while the rows it wrote are
 * still there (the DB can be reset or cleared outside the sync).
 */
const getCompleteHistoryCoverage = async (address: string) => {
  const coverage = historySyncCoverageStore.getState()[address];
  if (!coverage) {
    return null;
  }
  if (
    coverage.to > coverage.from &&
    (await HistoryItemEntity.getLatestTime(address)) < coverage.to
  ) {
    return null;
  }
  return coverage;
};

let legacyCoverageSeeding: Promise<void> | null = null;

/**
 * History synced before coverage records existed is trusted as is: once per
 * install, before any sync writes, every address with rows gets a record. From
 * then on, rows without a record mean a backfill that did not finish.
 */
const seedLegacyHistoryCoverage = () => {
  if (historySyncCoverageMetaStore.getState().legacySeeded) {
    return Promise.resolve();
  }
  if (!legacyCoverageSeeding) {
    legacyCoverageSeeding = (async () => {
      const latestTimes = await HistoryItemEntity.getLatestTimeByOwner();
      const from = nowSec() - HISTORY_WINDOW_SEC;
      historySyncCoverageStore.setState(prev => {
        const next = { ...prev };
        Object.entries(latestTimes).forEach(([address, latestTime]) => {
          next[address] ??= { from, to: Math.max(from, latestTime) };
        });
        return next;
      }, true);
      historySyncCoverageMetaStore.setState({ legacySeeded: true });
    })().finally(() => {
      legacyCoverageSeeding = null;
    });
  }
  return legacyCoverageSeeding;
};

/**
 * Fetch and store the whole 90-day window, then record it as complete. Past
 * ALL_HISTORY_MAX_PAGES the oldest txs are left out on purpose.
 */
const backfillHistoryWindow = async (address: string) => {
  const from = nowSec() - HISTORY_WINDOW_SEC;
  const { newest, reached } = await syncPagesUntil(address, from, {
    pageCount: ALL_HISTORY_PAGE_COUNT,
    maxPages: ALL_HISTORY_MAX_PAGES,
    fetchPage: fetchAllHistoryPage(address),
  });
  if (!reached) {
    console.warn(
      `backfillHistoryWindow stopped after ${ALL_HISTORY_MAX_PAGES} pages for ${address.slice(
        -4,
      )}`,
    );
  }
  setHistorySyncCoverage(address, { from, to: Math.max(from, newest) });
};

const syncSinceWithRealTimeApi = async (address: string, since: number) => {
  try {
    const { has_new_tx } = await openapi.hasNewTxFrom({
      address,
      startTime: Math.floor(since),
    });
    if (!has_new_tx) {
      return { newest: 0, reached: true };
    }
  } catch (e) {
    // NOTHING, list the history to find out
  }
  return syncPagesUntil(address, since, {
    pageCount: REALTIME_PAGE_COUNT,
    maxPages: REALTIME_MAX_PAGES,
    fetchPage: fetchRealTimeHistoryPage(address),
  });
};

/**
 * Store the txs newer than the complete range and extend the range over them.
 * The range is anchored at its own end rather than at the newest local row:
 * after an interrupted write the newest rows may exist while older ones do not.
 */
const syncNewHistory = async (
  address: string,
  coverage: HistorySyncCoverage,
  useRealTimeApi: boolean,
) => {
  const since = Math.max(coverage.to, nowSec() - HISTORY_WINDOW_SEC);
  let { newest, reached } = useRealTimeApi
    ? await syncSinceWithRealTimeApi(address, since)
    : { newest: 0, reached: false };
  if (!reached) {
    const allHistory = await syncPagesUntil(address, since, {
      pageCount:
        nowSec() - since > ALL_HISTORY_SHORT_RANGE_SEC
          ? ALL_HISTORY_PAGE_COUNT
          : ALL_HISTORY_SHORT_RANGE_PAGE_COUNT,
      maxPages: ALL_HISTORY_MAX_PAGES,
      fetchPage: fetchAllHistoryPage(address),
    });
    newest = Math.max(newest, allHistory.newest);
    reached = allHistory.reached;
  }
  if (!reached) {
    // the rows between `since` and the oldest fetched one are missing, so the
    // next sync backfills the window instead
    console.warn(
      `syncNewHistory did not reach the synced range for ${address.slice(-4)}`,
    );
    setHistorySyncCoverage(address, null);
    return;
  }
  // the window moved past the old range, so only the window is complete
  const from = since > coverage.to ? since : coverage.from;
  setHistorySyncCoverage(address, {
    from,
    to: Math.max(from, coverage.to, newest),
  });
};

const TX_COUNT_CHECK_INTERVAL = 24 * 60 * 60 * 1000; // compare with the server once a day
const TX_COUNT_WINDOW_SEC = 24 * 60 * 60; // compare the last 24 hours
const REFETCH_PAGE_COUNT = 20;
const REFETCH_MAX_PAGES = 25; // bounds a refetch to ~500 txs

const isTxCountCheckDue = (address: string) => {
  const lastCheckedAt = historyTxCountCheckStore.getState()?.[address] || 0;
  return Date.now() - lastCheckedAt >= TX_COUNT_CHECK_INTERVAL;
};

const refetchHistorySince = async (address: string, fromTs: number) => {
  const { reached } = await syncPagesUntil(address, fromTs, {
    pageCount: REFETCH_PAGE_COUNT,
    maxPages: REFETCH_MAX_PAGES,
    fetchPage: fetchRealTimeHistoryPage(address),
  });
  if (!reached) {
    console.warn(
      `refetchHistorySince stopped after ${REFETCH_MAX_PAGES} pages for ${address.slice(
        -4,
      )}`,
    );
  }
  return reached;
};

const txCountCheckInFlight = new Map<string, Promise<boolean>>();

/**
 * Compare the server tx count of the last 24 hours with the local rows and
 * re-fetch that window when the local DB is missing some.
 *
 * The window ends at the newest local row: anything newer is the regular
 * incremental sync's job, so a mismatch here means a gap in data we already
 * consider synced.
 *
 * @returns true when the whole window was re-fetched (which also covers
 * everything newer than the local rows)
 */
export const refetchRecentHistoryIfIncomplete = (address: string) => {
  // Home and single-address syncs may check the same address at once
  const inFlight = txCountCheckInFlight.get(address);
  if (inFlight) {
    return inFlight;
  }
  const check = checkRecentTxCountAndRefetch(address).finally(() => {
    txCountCheckInFlight.delete(address);
  });
  txCountCheckInFlight.set(address, check);
  return check;
};

const checkRecentTxCountAndRefetch = async (address: string) => {
  try {
    const fromTs = Math.floor(Date.now() / 1000) - TX_COUNT_WINDOW_SEC;
    const toTs = await HistoryItemEntity.getLatestTime(address);
    if (toTs < fromTs) {
      // nothing local in the window yet, the regular sync fetches it
      return false;
    }

    const [{ tx_count }, localCount] = await Promise.all([
      // the server's to_ts is exclusive, +1 keeps the newest local row in range
      openapi.getTxCount({ id: address, from_ts: fromTs, to_ts: toTs + 1 }),
      HistoryItemEntity.countInTimeRange(address, fromTs, toTs),
    ]);
    console.debug('refetchRecentHistoryIfIncomplete', address.slice(-4), {
      tx_count,
      localCount,
    });
    if (localCount >= tx_count) {
      markHistoryTxCountChecked(address);
      return false;
    }

    const refetched = await refetchHistorySince(address, fromTs);
    markHistoryTxCountChecked(address);
    return refetched;
  } catch (error) {
    // not marked as checked, so the next sync retries
    console.error('refetchRecentHistoryIfIncomplete error', error);
    return false;
  }
};

type AddressHistorySyncTask = {
  /** the regular sync is due: fetch the txs newer than the local history */
  fetchNew: boolean;
  /** compare the recent tx count with the server first */
  checkTxCount: boolean;
  useRealTimeApi: boolean;
};

const runAddressHistorySync = async (
  address: string,
  { fetchNew, checkTxCount, useRealTimeApi }: AddressHistorySyncTask,
) => {
  // recorded only once the data is written, so an interrupted sync is not
  // taken for a finished one
  const startedAt = Date.now();
  let isLoading = false;
  const startLoading = () => {
    isLoading = true;
    setHistoryLoading(prev => ({ ...prev, [address]: true }));
  };
  try {
    await seedLegacyHistoryCoverage();
    const coverage = await getCompleteHistoryCoverage(address);
    if (!coverage) {
      // the first sync of an address, an empty or reset DB, or a backfill
      // that did not finish
      startLoading();
      await backfillHistoryWindow(address);
      updateHistoryTimeSingleAddress(address, startedAt);
      return;
    }

    // check before the regular sync so its writes cannot look like a gap
    const refetched =
      checkTxCount && (await refetchRecentHistoryIfIncomplete(address));
    if (!fetchNew) {
      return;
    }
    if (!refetched) {
      startLoading();
      await syncNewHistory(address, coverage, useRealTimeApi);
    }
    updateHistoryTimeSingleAddress(address, startedAt);
  } catch (error) {
    // reset so the next sync is not throttled
    updateHistoryTimeSingleAddress(address, 0);
    console.error(`syncAddressHistory error for ${address.slice(-4)}:`, error);
  } finally {
    if (isLoading) {
      setHistoryLoading(prev => ({ ...prev, [address]: false }));
    }
  }
};

const addressHistorySyncInFlight = new Map<
  string,
  { task: AddressHistorySyncTask; run: Promise<void> }
>();

/**
 * Home, single-address and import syncs of one address share a run. A request
 * asking for more than the running sync does (a fetch joining a Home round that
 * only checks the count, or a count check joining an import sync) runs the
 * missing part once that run finishes.
 */
const syncAddressHistory = (
  address: string,
  task: AddressHistorySyncTask,
): Promise<void> => {
  const inFlight = addressHistorySyncInFlight.get(address);
  if (inFlight) {
    const missing = {
      ...task,
      fetchNew: task.fetchNew && !inFlight.task.fetchNew,
      checkTxCount: task.checkTxCount && !inFlight.task.checkTxCount,
    };
    if (!missing.fetchNew && !missing.checkTxCount) {
      return inFlight.run;
    }
    return inFlight.run.then(() => syncAddressHistory(address, missing));
  }
  const run = runAddressHistorySync(address, task).finally(() => {
    addressHistorySyncInFlight.delete(address);
  });
  addressHistorySyncInFlight.set(address, { task, run });
  return run;
};

export const syncTop10History = async (
  top10Addresses: string[],
  force?: boolean,
  resetEntity?: boolean,
  options?: SyncTop10HistoryOptions,
) => {
  if (top10Addresses.length === 0) {
    console.debug('🔍syncTop10History CUSTOM_LOGGER:=>: No account');
    return;
  }

  if (isSyncingRef.current) {
    if (force) {
      pendingForceSyncRef.current = { addresses: top10Addresses, options };
    }
    console.debug('🔍syncTop10History isSyncing, force queued:', !!force);
    return;
  }
  try {
    console.log('🔍syncTop10History CUSTOM_LOGGER:=>: Fetching action');
    isSyncingRef.current = true;
    await prepareAppDataSource();
    if (resetEntity) {
      await HistoryItemEntity.clear();
      historySyncCoverageStore.setState({}, true);
    }
    const queue = new PQueue({
      interval: 2000,
      intervalCap: 5,
    });
    for (const item of top10Addresses) {
      const address = item.toLowerCase();
      const isForceFetchFromApi = force || (await getIsNeedSyncData(address));
      const shouldCheckTxCount = isTxCountCheckDue(address);
      if (!isForceFetchFromApi && !shouldCheckTxCount) {
        continue;
      }
      if (isForceFetchFromApi) {
        console.debug(
          '🔍syncTop10History CUSTOM_LOGGER:=>: update sync address:',
          address,
        );
      }
      const useRealTimeApi =
        !options?.forceAllHistoryApi && isRecentlySynced(address);
      queue.add(async () => {
        await syncAddressHistory(address, {
          fetchNew: isForceFetchFromApi,
          checkTxCount: shouldCheckTxCount,
          useRealTimeApi,
        });
        await new Promise(resolve => setTimeout(resolve, 0));
      });
    }
    await queue.onIdle();
  } finally {
    isSyncingRef.current = false;
    const pendingForceSync = pendingForceSyncRef.current;
    pendingForceSyncRef.current = null;
    if (pendingForceSync) {
      void syncTop10History(
        pendingForceSync.addresses,
        true,
        false,
        pendingForceSync.options,
      );
    }
  }
};

export const syncMultiAddressesHistory = async (addresses: string[]) => {
  if (addresses.length === 0) {
    console.debug('syncMultiAccountsHistory CUSTOM_LOGGER:=>: No account');
    return;
  }

  console.log('syncMultiAccountsHistory CUSTOM_LOGGER:=>: Fetching action');
  const queue = new PQueue({
    interval: 2000,
    intervalCap: 5,
  });
  for (const item of addresses) {
    const address = item.toLowerCase();
    const useRealTimeApi = isRecentlySynced(address);
    queue.add(async () => {
      await syncAddressHistory(address, {
        fetchNew: true,
        checkTxCount: false,
        useRealTimeApi,
      });
      await new Promise(resolve => setTimeout(resolve, 0));
    });
  }
  await queue.onIdle();
};

export const syncSingleAddress = async (_address: string) => {
  const address = _address.toLowerCase();
  await syncAddressHistory(address, {
    fetchNew: true,
    checkTxCount: isTxCountCheckDue(address),
    useRealTimeApi: isRecentlySynced(address),
  });
};

export const useHistoryTime = () => {
  return historyTimeStore(s => s);
};
