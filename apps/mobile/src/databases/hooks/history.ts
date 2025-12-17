import { syncRemoteHistory } from '../sync/assets';
import { HistoryItemEntity } from '../entities/historyItem';
import { openapi } from '@/core/request';
import { transactionHistoryService } from '@/core/services';
import {
  historyTimeStore,
  setHistoryLoading,
  updateHistoryTimeSingleAddress,
} from '@/hooks/historyTokenDict';
import PQueue from 'p-queue';
import { prepareAppDataSource } from '../imports';
import { TxHistoryResult } from '@rabby-wallet/rabby-api/dist/types';

const USE_REALTIME_API_DURATION = 24 * 5 * 60 * 60 * 1000; // use async history api if user not opened app in 5 days

const waitQueueFinished = (q: PQueue) => {
  return new Promise(resolve => {
    q.on('empty', () => {
      if (q.pending <= 0) {
        resolve(null);
      }
    });
  });
};

const isSyncingRef = {
  current: false,
};

const getIsNeedSyncData = (address: string) => {
  if (transactionHistoryService.getIsNeedFetchTxHistory(address)) {
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
      res = await openapi.listTxHisotry({
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
        // if (res.history_list.length) {
        syncRemoteHistory(address, res);
        // }
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
        syncRemoteHistory(address, res);
        synHistoryInRealTimeApi(address, latestTime, lastItemTime);
      }
    }
    !start_time &&
      !res.history_list.length &&
      setHistoryLoading(prev => ({ ...prev, [address]: false }));
  } catch (error) {
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
      synHistoryInRealTimeApi(address, latestTime, start_time);
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
          syncRemoteHistory(address, res);
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
        syncRemoteHistory(address, res);
        syncUserAllHistory(address, lastItemTime, latestTime, forceUseRealTime);
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

export const syncTop10History = async (
  top10Addresses: string[],
  force?: boolean,
  resetEntity?: boolean,
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
        const isUseRealTimeApi =
          latestUpdateTime > Date.now() - USE_REALTIME_API_DURATION;
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
    if (queue.size > 0) {
      await waitQueueFinished(queue);
    }
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
  if (queue.size > 0) {
    await waitQueueFinished(queue);
  }
};

export const syncSingleAddress = async (address: string) => {
  const latestUpdateTime = historyTimeStore.getState()?.[address] || 0;
  const isUseRealTimeApi =
    latestUpdateTime > Date.now() - USE_REALTIME_API_DURATION;
  updateHistoryTimeSingleAddress(address);
  syncUserAllHistory(address.toLowerCase(), 0, 0, isUseRealTimeApi);
};

export const useHistoryTime = () => {
  return historyTimeStore(s => s);
};
