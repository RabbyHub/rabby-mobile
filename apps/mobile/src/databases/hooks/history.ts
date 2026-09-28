import { syncRemoteHistory } from '../sync/assets';
import { HistoryItemEntity } from '../entities/historyItem';
import { openapi } from '@/core/request';
import { transactionHistoryServiceApi } from '@/core/serviceApi/transactionHistory';
import {
  historyTimeStore,
  historyTxCountCheckStore,
  markHistoryTxCountChecked,
  setHistoryLoading,
  updateHistoryTimeSingleAddress,
} from '@/hooks/historyTokenDict';
import PQueue from 'p-queue';
import { prepareAppDataSource } from '../imports';
import type { TxHistoryResult } from '@rabby-wallet/rabby-api/dist/types';

const USE_REALTIME_API_DURATION = 24 * 5 * 60 * 60 * 1000; // use async history api if user not opened app in 5 days

type SyncTop10HistoryOptions = {
  forceAllHistoryApi?: boolean;
};

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

const synHistoryInRealTimeApi = async (
  address: string,
  latest_time: number,
  start_time?: number,
) => {
  try {
    const notNeedUpdateTime = new Date().getTime() / 1000 - 30 * 24 * 60 * 60; // 30 days ago
    const latestTime = latest_time || notNeedUpdateTime;
    const startTime = start_time || 0;

    console.log(
      'synHistoryInRealTimeApi CUSTOM_LOGGER:=>: start',
      address,
      'latestTime:',
      latestTime,
      'startTime:',
      startTime,
    );
    let hasNewTx = true;
    if (latest_time !== 0) {
      try {
        const { has_new_tx } = await openapi.hasNewTxFrom({
          address,
          startTime: Math.floor(latest_time),
        });
        hasNewTx = has_new_tx;
      } catch (e) {
        // NOTHING
      }
    }
    let res = {
      cate_dict: {},
      history_list: [] as TxHistoryResult['history_list'],
      project_dict: {},
      token_dict: {},
    };
    if (hasNewTx) {
      res = await openapi.listTxHistory({
        id: address,
        start_time: startTime,
        page_count: 20,
      });
    }

    const ninetyDaysAgo = new Date().getTime() / 1000 - 90 * 24 * 60 * 60; // 90 days ago
    res.history_list = res.history_list.filter(i => i.time_at > ninetyDaysAgo);

    if (res.history_list.length) {
      const lastItemTime =
        res.history_list[res.history_list.length - 1].time_at;
      if (lastItemTime < latestTime) {
        // update done or not all update  to  interup loop
        console.debug(
          'synHistoryInRealTimeApi CUSTOM_LOGGER:=>: update',
          address,
          'update length:',
          res.history_list.length,
        );
        await syncRemoteHistory(address, res);
        console.debug(
          'synHistoryInRealTimeApi CUSTOM_LOGGER:=>: No more history',
          address,
        );
      } else {
        // need more history, exec loop
        console.debug(
          'synHistoryInRealTimeApi CUSTOM_LOGGER:=>: fetch more history',
          address,
          'lastItemTime:',
          lastItemTime,
        );
        console.debug(
          'synHistoryInRealTimeApi CUSTOM_LOGGER:=>: loop update',
          address,
          'add length:',
          res.history_list.length,
        );
        await syncRemoteHistory(address, res);
        await synHistoryInRealTimeApi(address, latestTime, lastItemTime);
      }
    }
    !start_time &&
      !res.history_list.length &&
      setHistoryLoading(prev => ({ ...prev, [address]: false }));
  } catch (error) {
    // set time for next resend fetch
    updateHistoryTimeSingleAddress(address, 0);
    setHistoryLoading(prev => ({ ...prev, [address]: false }));
    console.error('synHistoryInRealTimeApi Error fetching data:', error);
  }
  if (!address) {
    return [];
  }
};

const syncUserAllHistory = async (
  address: string,
  start_time?: number,
  latest_time?: number,
  forceUseRealTime?: boolean,
) => {
  try {
    setHistoryLoading(prev => ({ ...prev, [address]: true }));
    const latestTime =
      latest_time || (await HistoryItemEntity.getLatestTime(address));
    const isExpiredTimeAgo = new Date().getTime() - 15 * 24 * 60 * 60 * 1000; // 15 days ago
    const isAddUpdate = latestTime > isExpiredTimeAgo / 1000;

    if (forceUseRealTime) {
      // use other fetch api
      await synHistoryInRealTimeApi(address, latestTime, start_time);
      return;
    }

    console.log(
      '🔍syncUserAllHistory CUSTOM_LOGGER:=>: start',
      address,
      'end_time:',
      latestTime,
      'isAddUpdate:',
      isAddUpdate,
    );
    // init time gap

    const res = await openapi.getAllTxHistory({
      id: address,
      start_time: start_time || 0,
      page_count: isAddUpdate ? 500 : 2000,
    });

    const ninetyDaysAgo = new Date().getTime() / 1000 - 90 * 24 * 60 * 60; // 90 days ago
    res.history_list = res.history_list.filter(i => i.time_at > ninetyDaysAgo);
    console.debug('getAllTxHistory length:', res.history_list.length);
    if (res.history_list.length) {
      const lastItemTime =
        res.history_list[res.history_list.length - 1].time_at;
      if (lastItemTime < latestTime || !isAddUpdate) {
        // update done or not all update  to  interup loop
        res.history_list = res.history_list.filter(i => i.time_at > latestTime);

        console.debug(
          '🔍syncUserAllHistory CUSTOM_LOGGER:=>: update',
          address,
          'add length:',
          res.history_list.length,
        );
        if (res.history_list.length) {
          await syncRemoteHistory(address, res);
        }
        console.debug(
          '🔍syncUserAllHistory CUSTOM_LOGGER:=>: No more history',
          address,
        );
      } else {
        // need more history, exec loop
        console.debug(
          '🔍syncUserAllHistory CUSTOM_LOGGER:=>: fetch more history',
          address,
          'lastItemTime:',
          lastItemTime,
        );
        console.debug(
          '🔍syncUserAllHistory CUSTOM_LOGGER:=>: loop update',
          address,
          'add length:',
          res.history_list.length,
        );
        await syncRemoteHistory(address, res);
        await syncUserAllHistory(
          address,
          lastItemTime,
          latestTime,
          forceUseRealTime,
        );
      }
    }
    !start_time &&
      !res.history_list.length &&
      setHistoryLoading(prev => ({ ...prev, [address]: false }));
  } catch (error) {
    // set time for next resend fetch
    updateHistoryTimeSingleAddress(address, 0);
    setHistoryLoading(prev => ({ ...prev, [address]: false }));
    console.error('syncUserAllHistory Error fetching data:', error);
  }
  if (!address) {
    return [];
  }
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
  let startTime = 0;
  for (let page = 0; page < REFETCH_MAX_PAGES; page++) {
    const res = await openapi.listTxHistory({
      id: address,
      start_time: startTime,
      page_count: REFETCH_PAGE_COUNT,
    });
    const inWindow = res.history_list.filter(i => i.time_at >= fromTs);
    if (inWindow.length) {
      await syncRemoteHistory(address, { ...res, history_list: inWindow });
    }
    const lastItem = res.history_list[res.history_list.length - 1];
    if (!lastItem || lastItem.time_at < fromTs) {
      return;
    }
    startTime = lastItem.time_at;
  }
  console.warn(
    `refetchHistorySince stopped after ${REFETCH_MAX_PAGES} pages for ${address.slice(
      -4,
    )}`,
  );
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
 * @returns true when the window was re-fetched (which also covers everything
 * newer than the local rows)
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
      openapi.getTxCount({ id: address, from_ts: fromTs, to_ts: toTs }),
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

    await refetchHistorySince(address, fromTs);
    markHistoryTxCountChecked(address);
    return true;
  } catch (error) {
    // not marked as checked, so the next sync retries
    console.error('refetchRecentHistoryIfIncomplete error', error);
    return false;
  }
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
      let isUseRealTimeApi = false;
      if (isForceFetchFromApi) {
        const latestUpdateTime = historyTimeStore.getState()?.[address] || 0;
        isUseRealTimeApi = options?.forceAllHistoryApi
          ? false
          : latestUpdateTime > Date.now() - USE_REALTIME_API_DURATION;
        updateHistoryTimeSingleAddress(address);
        console.debug(
          '🔍syncTop10History CUSTOM_LOGGER:=>: update sync address:',
          address,
        );
      }
      queue.add(async () => {
        try {
          // check before the regular sync so its pending writes cannot look like a gap
          const refetched =
            shouldCheckTxCount &&
            (await refetchRecentHistoryIfIncomplete(address));
          if (isForceFetchFromApi && !refetched) {
            await syncUserAllHistory(address, 0, 0, isUseRealTimeApi);
          }
        } catch (error) {
          console.error(
            `syncTop10History Error fetching data for ${address.slice(-4)}:`,
            error,
          );
        }
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
    const latestUpdateTime = historyTimeStore.getState()?.[address] || 0;
    const isUserRealTimeApi =
      latestUpdateTime > Date.now() - USE_REALTIME_API_DURATION;
    updateHistoryTimeSingleAddress(address);
    queue.add(async () => {
      try {
        await syncUserAllHistory(address, 0, 0, isUserRealTimeApi);
      } catch (error) {
        console.error(
          `syncMultiAccountsHistory Error fetching data for ${address.slice(
            -4,
          )}:`,
          error,
        );
      }
      await new Promise(resolve => setTimeout(resolve, 0));
    });
  }
  await queue.onIdle();
};

export const syncSingleAddress = async (_address: string) => {
  const address = _address.toLowerCase();
  const latestUpdateTime = historyTimeStore.getState()?.[address] || 0;
  const isUseRealTimeApi =
    latestUpdateTime > Date.now() - USE_REALTIME_API_DURATION;
  updateHistoryTimeSingleAddress(address);
  const refetched =
    isTxCountCheckDue(address) &&
    (await refetchRecentHistoryIfIncomplete(address));
  if (!refetched) {
    await syncUserAllHistory(address, 0, 0, isUseRealTimeApi);
  }
};

export const useHistoryTime = () => {
  return historyTimeStore(s => s);
};
