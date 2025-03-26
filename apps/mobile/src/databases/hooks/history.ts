import { useCallback, useEffect, useState } from 'react';

import { KeyringAccountWithAlias } from '@/hooks/account';
import { runOnJS } from 'react-native-reanimated';
import {
  syncRemoteBuyHistory,
  syncRemoteHistory,
  syncRemoteSwapHistory,
} from '../sync/assets';
import { HistoryItemEntity } from '../entities/historyItem';
import { useSafeState } from '@/hooks/useSafeState';
import { openapi } from '@/core/request';
import { transactionHistoryService } from '@/core/services';
import { SwapItemEntity } from '../entities/swapitem';
import { useHistoryTokenDict } from '@/hooks/historyTokenDict';
import { useMemoizedFn } from 'ahooks';
import PQueue from 'p-queue';
import { prepareAppDataSource } from '../imports';
import { BuyHistoryList, TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { BuyItemEntity } from '../entities/buyItem';
import dayjs from 'dayjs';

const waitQueueFinished = (q: PQueue) => {
  return new Promise(resolve => {
    q.on('empty', () => {
      if (q.pending <= 0) {
        resolve(null);
      }
    });
  });
};

export function useHistoryBasicInfo({ enableAutoFetch = false }) {
  const [assetsInfo, setInfo] = useState<{
    uniqueChainAddressCount: number;
    totalRecords: number;
  }>({ uniqueChainAddressCount: 0, totalRecords: 0 });

  const fetchAssetsInfo = useCallback(async () => {
    const [distinctCount, totalRecords] = await Promise.all([
      HistoryItemEntity.getCountOfAccount(),
      HistoryItemEntity.count(),
    ]);

    setInfo(prev => ({
      ...prev,
      uniqueChainAddressCount: distinctCount ?? 0,
      totalRecords,
    }));
  }, []);

  useEffect(() => {
    if (!enableAutoFetch) {
      return;
    }

    fetchAssetsInfo();
  }, [enableAutoFetch, fetchAssetsInfo]);

  return { assetsInfo, fetchAssetsInfo };
}

export const useSyncHistoryDB = (
  sortedAccounts: KeyringAccountWithAlias[] = [],
) => {
  const [isSyncing, setIsSyncing] = useSafeState(false);
  const {
    setProjectDict,
    setTokenDict,
    updateHistoryTime,
    updateHistoryTimeSingleAddress,
    setHistoryEnsureNoData,
  } = useHistoryTokenDict();

  const syncSwapHistory = useMemoizedFn(
    async (address: string, start_time?: number, latest_time?: number) => {
      if (!address) {
        return [];
      }

      const latestTime =
        latest_time || (await SwapItemEntity.getLatestTime(address));
      const isExpiredTimeAgo = new Date().getTime() - 15 * 24 * 60 * 60 * 1000; // 15 days ago
      const isAddUpdate = latestTime > isExpiredTimeAgo / 1000;

      const time = latestTime || 0;

      console.log(
        'syncSwapHistory CUSTOM_LOGGER:=>: lastTime',
        address,
        time,
        'isAddUpdate:',
        isAddUpdate,
      );
      const res = await openapi.getSwapTradeListV2({
        user_addr: address,
        start_time: Math.floor(start_time || 0),
        limit: isAddUpdate ? 20 : 100,
      });

      const lastItemTime =
        res.history_list[res.history_list.length - 1]?.create_at || 0;
      res.history_list = res.history_list.filter(i => i.create_at > latestTime);

      console.debug(
        'getSwapTradeListV2 sync data length:',
        res.history_list.length,
      );
      if (res.history_list.length) {
        runOnJS(syncRemoteSwapHistory)(address, res.history_list);
        if (isAddUpdate && lastItemTime > latestTime) {
          console.debug('getSwapTradeListV2 sync data need to loop:', address);
          syncSwapHistory(address, lastItemTime, latestTime);
        }
        return res.history_list;
      }
    },
  );

  const synHistoryInRealTimeApi = useMemoizedFn(
    async (address: string, latest_time: number, start_time?: number) => {
      try {
        const notNeedUpdateTime =
          new Date().getTime() / 1000 - 30 * 24 * 60 * 60; // 30 days ago
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
        const res = await openapi.listTxHisotry({
          id: address,
          start_time: startTime,
          page_count: 20,
        });

        console.debug(
          'synHistoryInRealTimeApi length:',
          res.history_list.length,
        );
        const tokenUUDict: Record<string, TokenItem> = {};
        Object.keys(res.token_dict).map(id => {
          const chain = res.token_dict[id].chain;
          tokenUUDict[`${chain}_token:${id}`] = res.token_dict[id];
        });
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
            runOnJS(syncRemoteHistory)(address, res.history_list);
            setProjectDict(prev => ({ ...prev, ...res.project_dict }));
            setTokenDict(prev => ({ ...prev, ...tokenUUDict }));
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
            runOnJS(syncRemoteHistory)(address, res.history_list);
            setProjectDict(prev => ({ ...prev, ...res.project_dict }));
            setTokenDict(prev => ({ ...prev, ...tokenUUDict }));
            synHistoryInRealTimeApi(address, latestTime, lastItemTime);
          }
        }
        !startTime &&
          setHistoryEnsureNoData(prev => ({
            ...prev,
            [address]: !res.history_list.length,
          }));
      } catch (error) {
        console.error('synHistoryInRealTimeApi Error fetching data:', error);
      }
      if (!address) {
        return [];
      }
    },
  );

  const syncBuyHistory = useMemoizedFn(
    async (address: string, start?: number) => {
      if (!address) {
        return [];
      }

      const latestTime = (await BuyItemEntity.getLatestTime(address)) || 0;
      const isExpiredTimeAgo = dayjs().subtract(15, 'days').unix(); // 15 days ago

      const isAddUpdate = latestTime > isExpiredTimeAgo;

      const pendingIdList = ((await BuyItemEntity.getAllPending(address)) || [])
        .filter(i => i.create_at > isExpiredTimeAgo)
        .map(e => e.id);

      const _start = 0 + (start || 0);
      const res = await openapi.getBuyHistory({
        user_addr: address,
        start: _start,
        limit: isAddUpdate ? 20 : 100,
      });

      const lastItemTime =
        res.histories[res.histories.length - 1]?.create_at || 0;

      res.histories = res.histories.filter(
        i => pendingIdList.includes(i.id) || i.create_at > latestTime,
      );

      console.debug('getBuyHistory sync data length:', res.histories.length);
      if (res.histories.length) {
        console.log('syncRemoteBuyHistory', address, res.histories);
        runOnJS(syncRemoteBuyHistory)(
          address,
          res.histories as unknown as BuyHistoryList['histories'],
        );
        if (isAddUpdate && lastItemTime > latestTime) {
          console.debug('getBuyHistory sync data need to loop:', address);
          syncBuyHistory(address, _start + res.histories.length - 1);
        }
        return res.histories;
      }
    },
  );

  const syncUserAllHistory = useMemoizedFn(
    async (
      address: string,
      start_time?: number,
      latest_time?: number,
      forceUseRealTime?: boolean,
    ) => {
      try {
        const latestTime =
          latest_time || (await HistoryItemEntity.getLatestTime(address));
        const isExpiredTimeAgo =
          new Date().getTime() - 15 * 24 * 60 * 60 * 1000; // 15 days ago
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

        console.debug('getAllTxHistory length:', res.history_list.length);
        if (res.history_list.length) {
          const lastItemTime =
            res.history_list[res.history_list.length - 1].time_at;
          if (lastItemTime < latestTime || !isAddUpdate) {
            // update done or not all update  to  interup loop
            res.history_list = res.history_list.filter(
              i => i.time_at > latestTime,
            );

            console.debug(
              '🔍syncUserAllHistory CUSTOM_LOGGER:=>: update',
              address,
              'add length:',
              res.history_list.length,
            );
            if (res.history_list.length) {
              runOnJS(syncRemoteHistory)(address, res.history_list);
              setProjectDict(prev => ({ ...prev, ...res.project_dict }));
              setTokenDict(prev => ({ ...prev, ...res.token_uuid_dict }));
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
            runOnJS(syncRemoteHistory)(address, res.history_list);
            setProjectDict(prev => ({ ...prev, ...res.project_dict }));
            setTokenDict(prev => ({ ...prev, ...res.token_uuid_dict }));
            syncUserAllHistory(
              address,
              lastItemTime,
              latestTime,
              forceUseRealTime,
            );
          }
        }
        !start_time &&
          setHistoryEnsureNoData(prev => ({
            ...prev,
            [address]: !res.history_list.length,
          }));
      } catch (error) {
        console.error('syncUserAllHistory Error fetching data:', error);
      }
      if (!address) {
        return [];
      }
    },
  );
  const isNeedSyncData = useMemoizedFn(async (add: string) => {
    if (transactionHistoryService.getIsNeedFetchTxHistory(add)) {
      // some tx done need to update
      console.debug('🔍syncTop10History some tx done so isNeedSyncData');
      return true;
    }

    await prepareAppDataSource();

    const latestTime = updateHistoryTime[add] || 0;

    const currentTime = Date.now();
    const gap = currentTime - latestTime;
    const expireTime = 10 * 60 * 1000; // 10 min
    console.log(
      '🔍syncTop10History isNeedSyncData time gap',
      gap,
      'isExpire:',
      gap > expireTime,
      'add:',
      add.slice(-4),
    );
    return gap > expireTime;
  });

  const syncTop10History = useMemoizedFn(
    async (force?: boolean, resetEntity?: boolean) => {
      const top10Account = sortedAccounts.slice(0, 10);
      if (top10Account.length === 0) {
        console.debug('🔍syncTop10History CUSTOM_LOGGER:=>: No account');
        return;
      }

      if (isSyncing) {
        console.debug('🔍syncTop10History  isSyncing maybe error');
        return;
      }
      try {
        console.log('🔍syncTop10History CUSTOM_LOGGER:=>: Fetching action');
        setIsSyncing(true);
        await prepareAppDataSource();
        if (resetEntity) {
          await HistoryItemEntity.clear();
          await SwapItemEntity.clear();
        }
        const queue = new PQueue({
          interval: 2000,
          intervalCap: 5,
        });
        for (const account of top10Account) {
          const address = account.address.toLowerCase();
          const isForceFetchFromApi = force || (await isNeedSyncData(address));
          if (isForceFetchFromApi) {
            const latestUpdateTime = updateHistoryTime[address] || 0;
            const isUserRealTiemApi =
              latestUpdateTime > Date.now() - 24 * 60 * 60 * 1000; // 1 days ago
            updateHistoryTimeSingleAddress(address);
            console.debug(
              '🔍syncTop10History CUSTOM_LOGGER:=>: update sync address:',
              address,
            );
            queue.add(async () => {
              try {
                await Promise.all([
                  syncUserAllHistory(address, 0, 0, isUserRealTiemApi),
                  syncBuyHistory(address),
                ]);
              } catch (error) {
                console.error(
                  `syncTop10History Error fetching data for ${account.address.slice(
                    -4,
                  )}:`,
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
        setIsSyncing(false);
      }
    },
  );

  const syncMultiAddressesHistory = useMemoizedFn(
    async (addresses: string[]) => {
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
        const latestUpdateTime = updateHistoryTime[address] || 0;
        const isUserRealTimeApi =
          latestUpdateTime > Date.now() - 24 * 60 * 60 * 1000; // 1 days ago
        updateHistoryTimeSingleAddress(address);
        queue.add(async () => {
          try {
            await Promise.all([
              syncUserAllHistory(address, 0, 0, isUserRealTimeApi),
              syncBuyHistory(address),
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
    },
  );

  const syncSingleAddress = useMemoizedFn(address => {
    const latestUpdateTime = updateHistoryTime[address] || 0;
    const isUserRealTiemApi =
      latestUpdateTime > Date.now() - 24 * 60 * 60 * 1000; // 1 days ago
    updateHistoryTimeSingleAddress(address);
    Promise.all([
      syncUserAllHistory(address.toLowerCase(), 0, 0, isUserRealTiemApi),
      syncBuyHistory(address.toLowerCase()),
    ]);
  });

  return {
    isSyncing,
    syncTop10History,
    syncSingleAddress,
    syncUserAllHistory,
    syncMultiAddressesHistory,
  };
};
