import { useCallback, useEffect, useState } from 'react';

import { runOnJS } from 'react-native-reanimated';
import { syncRemoteHistory, syncRemoteSwapHistory } from '../sync/assets';
import { HistoryItemEntity } from '../entities/historyItem';
import { useSafeState } from '@/hooks/useSafeState';
import { openapi } from '@/core/request';
import { transactionHistoryService } from '@/core/services';
import { SwapItemEntity } from '../entities/swapitem';
import { useHistoryTokenDict } from '@/hooks/historyTokenDict';
import { useMemoizedFn } from 'ahooks';
import PQueue from 'p-queue';
import { prepareAppDataSource } from '../imports';
import { TxHistoryResult } from '@rabby-wallet/rabby-api/dist/types';

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

export const useSyncHistoryDB = (top10Addresses: string[] = []) => {
  const [isSyncing, setIsSyncing] = useSafeState(false);
  const {
    updateHistoryTime,
    updateHistoryTimeSingleAddress,
    setHistoryLoading,
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
        let hasNewTx = true;
        if (startTime !== 0) {
          try {
            const { has_new_tx } = await openapi.hasNewTxFrom({
              address,
              startTime,
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
          console.log('listTxHisotry', address);
          res = await openapi.listTxHisotry({
            id: address,
            start_time: startTime,
            page_count: 20,
          });
        }

        const ninetyDaysAgo = new Date().getTime() / 1000 - 90 * 24 * 60 * 60; // 90 days ago
        res.history_list = res.history_list.filter(
          i => i.time_at > ninetyDaysAgo,
        );

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
            runOnJS(syncRemoteHistory)(address, res, setHistoryLoading);
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
            runOnJS(syncRemoteHistory)(address, res, setHistoryLoading);
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
        setHistoryLoading(prev => ({ ...prev, [address]: true }));
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

        const ninetyDaysAgo = new Date().getTime() / 1000 - 90 * 24 * 60 * 60; // 90 days ago
        res.history_list = res.history_list.filter(
          i => i.time_at > ninetyDaysAgo,
        );
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
              runOnJS(syncRemoteHistory)(address, res, setHistoryLoading);
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
            runOnJS(syncRemoteHistory)(address, res, setHistoryLoading);
            syncUserAllHistory(
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
        console.error('syncUserAllHistory Error fetching data:', error);
      }
      if (!address) {
        return [];
      }
    },
  );
  const isNeedSyncData = useMemoizedFn(async (address: string) => {
    if (transactionHistoryService.getIsNeedFetchTxHistory(address)) {
      // some tx done need to update
      console.debug('🔍syncTop10History some tx done so isNeedSyncData');
      return true;
    }

    const latestTime = updateHistoryTime[address] || 0;

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
  });

  const syncTop10History = useMemoizedFn(
    async (force?: boolean, resetEntity?: boolean) => {
      if (top10Addresses.length === 0) {
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
        for (const item of top10Addresses) {
          const address = item.toLowerCase();
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
                await syncUserAllHistory(address, 0, 0, isUserRealTiemApi);
              } catch (error) {
                console.error(
                  `syncTop10History Error fetching data for ${address.slice(
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
    syncUserAllHistory(address.toLowerCase(), 0, 0, isUserRealTiemApi);
  });

  return {
    isSyncing,
    syncTop10History,
    syncSingleAddress,
    syncUserAllHistory,
    syncMultiAddressesHistory,
  };
};
