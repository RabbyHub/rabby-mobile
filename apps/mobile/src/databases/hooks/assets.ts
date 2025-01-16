import { ComplexProtocol } from '@rabby-wallet/rabby-api/dist/types';
import { chunk } from 'lodash';
import { useCallback, useEffect, useRef, useState } from 'react';
import { runOnJS } from 'react-native-reanimated';

import { PortocolItemEntity } from '@/databases/entities/portocolItem';
import { syncRemotePortocols } from '@/databases/sync/assets';
import { useMyAccounts } from '@/hooks/account';
import { getExpandListSwitch } from '@/hooks/useExpandList';
import { useSafeState } from '@/hooks/useSafeState';
import { useSortAddressList } from '@/screens/Address/useSortAddressList';
import { batchQueryNFTsWithLocalCache } from '@/screens/Home/utils/nft';
import {
  batchLoadProjects,
  loadPortfolioSnapshot,
  snapshot2Display,
} from '@/screens/Home/utils/portfolio';
import { batchQueryTokensWithLocalCache } from '@/screens/Home/utils/token';

import { TokenItemEntity } from '../entities/tokenitem';

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
    if (!enableAutoFetch) {
      return;
    }

    fetchAssetsInfo();
  }, [enableAutoFetch, fetchAssetsInfo]);

  return { assetsInfo, fetchAssetsInfo };
}

export const syncTokens = async (address: string, force?: boolean) => {
  if (!address) {
    return [];
  }
  const tokenRes = await batchQueryTokensWithLocalCache(
    {
      user_id: address,
    },
    force,
  );
  return tokenRes || [];
};

export const syncProtocols = async (address: string, force?: boolean) => {
  if (!address) {
    return [];
  }
  const isExpired = await PortocolItemEntity.isExpired(address);
  console.log(
    '🔍 CUSTOM_LOGGER:=>isExpired defi',
    isExpired,
    'force',
    force,
    address.slice(-4),
  );

  if (!isExpired && !force) {
    return PortocolItemEntity.batchQueryPortocols(address);
  }
  const snapshotRes = (await loadPortfolioSnapshot(address)) || [];
  const { list, netWorth: snapshotNetWorth } = snapshot2Display(
    snapshotRes || [],
  );
  const snapshotData = Object.values(list)?.sort(
    (m, n) => (n.netWorth || 0) - (m.netWorth || 0),
  );

  const { thresholdIndex, hasExpandSwitch } = getExpandListSwitch(
    snapshotData,
    snapshotNetWorth,
  );

  const realtimeIds = hasExpandSwitch
    ? snapshotData.slice(0, thresholdIndex).map(x => x.id)
    : snapshotRes?.map(x => x.id) || [];

  const chunkIds = chunk(realtimeIds, 5);

  console.log('🔍 CUSTOM_LOGGER:=>: fetch protocol', address.slice(-4));
  const protocols: ComplexProtocol[] = [];
  await Promise.all(
    chunkIds.map(async ids => {
      const projects = await batchLoadProjects(address, ids);
      if (!projects?.length) {
        return;
      }
      protocols.push(...projects.filter(i => !!i));
    }),
  );
  runOnJS(syncRemotePortocols)(address, protocols);
  return protocols;
};

export const syncNFTs = async (address: string, force?: boolean) => {
  try {
    const nfts = await batchQueryNFTsWithLocalCache(
      {
        id: address,
        isAll: true,
        sortByCredit: true,
      },
      force,
    );
    return nfts;
  } catch (e) {
    console.error(e);
    return [];
  }
};

export const useSyncAssetsDB = () => {
  const [isSyncing, setIsSyncing] = useSafeState(false);
  const { accounts } = useMyAccounts({
    disableAutoFetch: true,
  });
  const sortedAccounts = useSortAddressList(accounts);
  const [isFirstFetch, setIsFirstFetch] = useState(true);
  const abortRef = useRef(false);

  const interrupt = () => {
    abortRef.current = true;
  };

  const syncTop10Assets = async (force?: boolean) => {
    const top10Account = sortedAccounts.slice(0, 10);
    setIsSyncing(true);
    try {
      for (const account of top10Account) {
        if (abortRef.current) {
          console.log('🔍 CUSTOM_LOGGER:=>: Fetching interrupted.');
          setIsSyncing(false);
          setIsFirstFetch(false);
          break;
        }

        try {
          await Promise.all([
            syncTokens(account.address, force),
            syncProtocols(account.address, force),
            syncNFTs(account.address, force),
          ]);
        } catch (error) {
          console.error(
            `Error fetching data for ${account.address.slice(-4)}:`,
            error,
          );
        }
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    } finally {
      setIsSyncing(false);
      setIsFirstFetch(false);
    }
  };

  return {
    isSyncing,
    syncTop10Assets,
    interrupt,
    refreshing: !!isSyncing && !isFirstFetch,
  };
};
