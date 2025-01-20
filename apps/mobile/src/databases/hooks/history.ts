import { useCallback, useEffect, useRef, useState } from 'react';

import { KeyringAccountWithAlias, useCurrentAccount } from '@/hooks/account';
import { runOnJS } from 'react-native-reanimated';
import usePrevious from 'react-use/lib/usePrevious';
import { syncRemoteHistory, syncRemoteSwapHistory } from '../sync/assets';
import { HistoryItemEntity } from '../entities/historyItem';
import { useSafeState } from '@/hooks/useSafeState';
import { openapi } from '@/core/request';
import { transactionHistoryService } from '@/core/services';
import { SwapItemEntity } from '../entities/swapitem';
import { useHistoryTokenDict } from '@/hooks/historyTokenDict';
import { useMemoizedFn } from 'ahooks';
import PQueue from 'p-queue';

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
  sortedAccounts: KeyringAccountWithAlias[],
  cacheTime: number = 10 * 60 * 1000,
) => {
  const [isSyncing, setIsSyncing] = useSafeState(false);
  const [isFirstFetch, setIsFirstFetch] = useState(true);
  const { setProjectDict, setTokenDict } = useHistoryTokenDict();
  const abortRef = useRef(false);
  const lastTimeStamps = useRef<number>(0);

  const isNeedFetchData = useMemoizedFn(() => {
    const currentTime = Date.now();
    const diff = currentTime - lastTimeStamps.current;
    if (diff > cacheTime) {
      lastTimeStamps.current = currentTime;
      return true;
    }
    return false;
  });

  const interrupt = () => {
    abortRef.current = true;
  };

  const syncSwapHistory = useMemoizedFn(
    async (address: string, force?: boolean, lastTime: number = 0) => {
      if (!address) {
        return [];
      }

      let time = lastTime;
      if (!lastTime) {
        const localLastTime = await SwapItemEntity.getLatestTime(address);
        time = localLastTime || 0;
      }

      console.log('syncSwapHistory CUSTOM_LOGGER:=>: lastTime', time);
      const res = await openapi.getSwapTradeListV2({
        user_addr: address,
        start_time: Math.floor(time),
        limit: 100,
      });

      console.debug(
        'getSwapTradeListV2',
        res.history_list.length,
        res.total_cnt,
      );
      if (!res.history_list.length) {
        // interupt loop
        console.debug(
          'syncSwapHistory CUSTOM_LOGGER:=>: No more history',
          address,
        );
        return true;
      } else {
        runOnJS(syncRemoteSwapHistory)(address, res.history_list);
        await syncSwapHistory(
          address,
          force,
          res.history_list[res.history_list.length - 1].create_at,
        );
      }
    },
  );

  const syncUserAllHistory = useMemoizedFn(
    async (address: string, lastTime: number = 0) => {
      if (!address) {
        return [];
      }

      let time = lastTime;
      if (!lastTime) {
        const localLastTime = await HistoryItemEntity.getLatestTime(address);
        time = localLastTime || 0;
      }

      console.log(
        '🔍syncUserAllHistory CUSTOM_LOGGER:=>: start',
        address,
        'lastTime:',
        time,
      );
      const res = await openapi.getAllTxHistory({
        id: address,
        start_time: time,
      });

      console.debug('getAllTxHistory', res.history_list.length);
      if (!res.history_list.length) {
        // interupt loop
        console.debug(
          '🔍syncUserAllHistory CUSTOM_LOGGER:=>: No more history',
          address,
        );
        return true;
      } else {
        runOnJS(syncRemoteHistory)(address, res.history_list);
        setProjectDict(prev => ({ ...prev, ...res.project_dict }));
        setTokenDict(prev => ({ ...prev, ...res.token_uuid_dict }));

        syncUserAllHistory(
          address,
          res.history_list[res.history_list.length - 1].time_at,
        );
      }
    },
  );

  const syncTop10History = useMemoizedFn(
    async (force?: boolean, resetEntity?: boolean) => {
      const isForceFetchFromApi = isNeedFetchData() || force;
      if (!isForceFetchFromApi) {
        console.debug('🔍syncTop10History CUSTOM_LOGGER:=>: not update');
        return;
      } else {
        lastTimeStamps.current = Date.now();
      }

      console.log('🔍syncTop10History CUSTOM_LOGGER:=>: Fetching action');
      const top10Account = sortedAccounts.slice(0, 10);
      setIsSyncing(true);

      try {
        if (isSyncing) {
          console.debug('🔍syncTop10History  isSyncing return this sync');
          return;
        }

        if (resetEntity) {
          await HistoryItemEntity.clear();
          await SwapItemEntity.clear();
        }

        const queue = new PQueue({
          interval: 2000,
          intervalCap: 5,
        });
        for (const account of top10Account) {
          queue.add(async () => {
            if (abortRef.current) {
              console.log(
                '🔍syncTop10History CUSTOM_LOGGER:=>: Fetching interrupted.',
              );
              setIsSyncing(false);
              setIsFirstFetch(false);
            }

            try {
              await Promise.allSettled([
                syncUserAllHistory(account.address),
                syncSwapHistory(account.address),
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
        await waitQueueFinished(queue);
      } finally {
        setIsSyncing(false);
        setIsFirstFetch(false);
      }
    },
  );

  return {
    isSyncing,
    syncTop10History,
    interrupt,
    refreshing: !!isSyncing && !isFirstFetch,
  };
};
