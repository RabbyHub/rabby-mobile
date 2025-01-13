import { useCallback, useEffect, useState } from 'react';

import { useCurrentAccount } from '@/hooks/account';
import { runOnJS } from 'react-native-reanimated';
import usePrevious from 'react-use/lib/usePrevious';
import { syncRemoteTokens } from '../sync/assets';
import { TokenItemEntity } from '../entities/tokenitem';

export function useSyncAssetsOnBoot({ enableAutoFetch = false }) {
  const { currentAccount } = useCurrentAccount();
  const prevCurrentAddr = usePrevious(currentAccount?.address);

  const syncData = useCallback(() => {
    if (!currentAccount?.address) return;
    if (prevCurrentAddr === currentAccount?.address) return;

    // syncRemoteTokens(currentAccount?.address);
    runOnJS(syncRemoteTokens)(currentAccount?.address);
  }, [prevCurrentAddr, currentAccount?.address]);

  useEffect(() => {
    if (!enableAutoFetch) return;

    syncData();
  }, [enableAutoFetch, syncData]);
}

export function useAssetsBasicInfo({ enableAutoFetch = false }) {
  const [assetsInfo, setInfo] = useState<{
    uniqueChainAddressCount: number;
    totalRecords: number;
  }>({ uniqueChainAddressCount: 0, totalRecords: 0 });

  const fetchAssetsInfo = useCallback(async () => {
    const [distinctCount, totalRecords] = await Promise.all([
      TokenItemEntity.getCountOfAccount(),
      TokenItemEntity.count(),
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
