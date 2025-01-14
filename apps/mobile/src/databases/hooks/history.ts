import { useCallback, useEffect, useState } from 'react';

import { useCurrentAccount } from '@/hooks/account';
import { runOnJS } from 'react-native-reanimated';
import usePrevious from 'react-use/lib/usePrevious';
import { syncRemoteHistory } from '../sync/assets';
import { HistoryItemEntity } from '../entities/historyItem';

export function useSyncHistoryOnBoot({ enableAutoFetch = false }) {
  const { currentAccount } = useCurrentAccount();
  const prevCurrentAddr = usePrevious(currentAccount?.address);

  const syncData = useCallback(() => {
    if (!currentAccount?.address) return;
    // if (prevCurrentAddr === currentAccount?.address) return;
    // syncRemoteTokens(currentAccount?.address);
    runOnJS(syncRemoteHistory)(currentAccount?.address);
  }, [currentAccount?.address]);

  useEffect(() => {
    if (!enableAutoFetch) return;

    syncData();
  }, [enableAutoFetch, syncData]);
}

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
    if (!enableAutoFetch) return;

    fetchAssetsInfo();
  }, [enableAutoFetch, fetchAssetsInfo]);

  return { assetsInfo, fetchAssetsInfo };
}
