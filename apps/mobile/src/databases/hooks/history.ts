import { syncRemoteHistory } from '../sync/assets';
import { HistoryItemEntity } from '../entities/historyItem';
import { openapi } from '@/core/request';
import { transactionHistoryServiceApi } from '@/core/serviceApi/transactionHistory';
import {
  historyTimeStore,
  setHistoryLoading,
  updateHistoryTimeSingleAddress,
} from '@/hooks/historyTokenDict';
import PQueue from 'p-queue';
import { prepareAppDataSource } from '../imports';

const USE_REALTIME_API_DURATION = 24 * 5 * 60 * 60 * 1000; // use async history api if user not opened app in 5 days
// getAllTxHistory can be cached for 10 minutes; double that window for late data.
const REALTIME_API_OVERLAP_SECONDS = 20 * 60;
const REALTIME_API_PAGE_COUNT = 20;

export const getRealtimeApiLatestTime = (latestTime: number) => {
  if (!latestTime) {
    return 0;
  }

  return Math.max(latestTime - REALTIME_API_OVERLAP_SECONDS, 0);
};

const waitQueueFinished = (q: PQueue) => q.onIdle();

const isSyncingRef = {
  current: false,
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

const syncHistoryInRealTimeApi = async (
  address: string,
  latest_time: number,
  start_time?: number,
) => {
  if (!address) {
    return [];
  }

  const notNeedUpdateTime = Date.now() / 1000 - 30 * 24 * 60 * 60; // 30 days ago
  const latestTime = latest_time || notNeedUpdateTime;
  let nextStartTime = start_time || 0;
  const ninetyDaysAgo = Date.now() / 1000 - 90 * 24 * 60 * 60; // 90 days ago

  console.log(
    'syncHistoryInRealTimeApi CUSTOM_LOGGER:=>: start',
    address,
    'latestTime:',
    latestTime,
    'startTime:',
    nextStartTime,
  );

  while (true) {
    const res = await openapi.listTxHisotry({
      id: address,
      start_time: nextStartTime,
      page_count: REALTIME_API_PAGE_COUNT,
    });

    res.history_list = res.history_list.filter(i => i.time_at > ninetyDaysAgo);
    const lastItem = res.history_list[res.history_list.length - 1];

    await syncRemoteHistory(address, res);

    if (
      !lastItem ||
      lastItem.time_at < latestTime ||
      res.history_list.length < REALTIME_API_PAGE_COUNT
    ) {
      console.debug(
        'syncHistoryInRealTimeApi CUSTOM_LOGGER:=>: No more history',
        address,
      );
      break;
    }

    nextStartTime = lastItem.time_at;
  }
};

const syncHistoryInAllHistoryApi = async (
  address: string,
  start_time: number,
  latestTime: number,
) => {
  const isExpiredTimeAgo = Date.now() - 15 * 24 * 60 * 60 * 1000; // 15 days ago
  const isAddUpdate = latestTime > isExpiredTimeAgo / 1000;
  let nextStartTime = start_time;

  console.log(
    'syncHistoryInAllHistoryApi CUSTOM_LOGGER:=>: start',
    address,
    'end_time:',
    latestTime,
    'isAddUpdate:',
    isAddUpdate,
  );

  while (true) {
    const res = await openapi.getAllTxHistory({
      id: address,
      start_time: nextStartTime,
      page_count: isAddUpdate ? 500 : 2000,
    });

    const ninetyDaysAgo = Date.now() / 1000 - 90 * 24 * 60 * 60; // 90 days ago
    res.history_list = res.history_list.filter(i => i.time_at > ninetyDaysAgo);
    console.debug('getAllTxHistory length:', res.history_list.length);

    if (!res.history_list.length) {
      break;
    }

    const lastItemTime = res.history_list[res.history_list.length - 1].time_at;
    if (lastItemTime < latestTime || !isAddUpdate) {
      res.history_list = res.history_list.filter(i => i.time_at > latestTime);

      console.debug(
        'syncHistoryInAllHistoryApi CUSTOM_LOGGER:=>: update',
        address,
        'add length:',
        res.history_list.length,
      );
      if (res.history_list.length) {
        await syncRemoteHistory(address, res);
      }
      break;
    }

    console.debug(
      'syncHistoryInAllHistoryApi CUSTOM_LOGGER:=>: fetch more history',
      address,
      'lastItemTime:',
      lastItemTime,
    );
    await syncRemoteHistory(address, res);
    nextStartTime = lastItemTime;
  }
};

export const syncUserAllHistory = async (
  address: string,
  start_time?: number,
  latest_time?: number,
  forceUseRealTime?: boolean,
) => {
  try {
    setHistoryLoading(prev => ({ ...prev, [address]: true }));
    const latestTime =
      latest_time || (await HistoryItemEntity.getLatestTime(address));

    if (forceUseRealTime) {
      await syncHistoryInRealTimeApi(
        address,
        getRealtimeApiLatestTime(latestTime),
        start_time,
      );
      return;
    }

    let hasNewTx = true;
    if (latestTime) {
      try {
        const { has_new_tx } = await openapi.hasNewTxFrom({
          address,
          startTime: Math.floor(latestTime),
        });
        hasNewTx = has_new_tx;
      } catch {
        // Fall through to the history APIs when the lightweight probe fails.
      }
    }

    if (!hasNewTx) {
      await syncHistoryInRealTimeApi(
        address,
        getRealtimeApiLatestTime(latestTime),
        start_time,
      );
      return;
    }

    await syncHistoryInAllHistoryApi(address, start_time || 0, latestTime);

    const latestItemTime = await HistoryItemEntity.getLatestTime(address);
    await syncHistoryInRealTimeApi(
      address,
      getRealtimeApiLatestTime(latestItemTime),
      0,
    );
  } catch (error) {
    // set time for next resend fetch
    updateHistoryTimeSingleAddress(address, 0);
    console.error('syncUserAllHistory Error fetching data:', error);
  } finally {
    setHistoryLoading(prev => ({ ...prev, [address]: false }));
  }
  if (!address) {
    return [];
  }
};

export const syncTop10History = async (
  top10Addresses: string[],
  force?: boolean,
  resetEntity?: boolean,
  options?: {
    forceAllHistoryApi?: boolean;
  },
) => {
  if (top10Addresses.length === 0) {
    console.debug('🔍syncTop10History CUSTOM_LOGGER:=>: No account');
    return;
  }

  if (isSyncingRef.current) {
    console.debug('🔍syncTop10History  isSyncing maybe error');
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
      if (isForceFetchFromApi) {
        const latestUpdateTime = historyTimeStore.getState()?.[address] || 0;
        const isUseRealTimeApi = options?.forceAllHistoryApi
          ? false
          : latestUpdateTime > Date.now() - USE_REALTIME_API_DURATION;
        updateHistoryTimeSingleAddress(address);
        console.debug(
          '🔍syncTop10History CUSTOM_LOGGER:=>: update sync address:',
          address,
        );
        queue.add(async () => {
          try {
            await syncUserAllHistory(address, 0, 0, isUseRealTimeApi);
          } catch (error) {
            console.error(
              `syncTop10History Error fetching data for ${address.slice(-4)}:`,
              error,
            );
          }
          await new Promise(resolve => setTimeout(resolve, 0));
        });
      }
    }
    await waitQueueFinished(queue);
  } finally {
    isSyncingRef.current = false;
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
        await Promise.all([
          syncUserAllHistory(address, 0, 0, isUserRealTimeApi),
        ]);
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
  await waitQueueFinished(queue);
};

export const syncSingleAddress = async (address: string) => {
  const latestUpdateTime = historyTimeStore.getState()?.[address] || 0;
  const isUseRealTimeApi =
    latestUpdateTime > Date.now() - USE_REALTIME_API_DURATION;
  updateHistoryTimeSingleAddress(address);
  return syncUserAllHistory(address.toLowerCase(), 0, 0, isUseRealTimeApi);
};

export const useHistoryTime = () => {
  return historyTimeStore(s => s);
};
