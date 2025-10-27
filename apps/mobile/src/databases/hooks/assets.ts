import { ComplexProtocol } from '@rabby-wallet/rabby-api/dist/types';
import { chunk } from 'lodash';
import { useCallback, useEffect, useRef, useState } from 'react';
import { runOnJS } from 'react-native-reanimated';

import { ProtocolItemEntity } from '@/databases/entities/portocolItem';
import {
  syncRemotePortocols,
  syncRemotePortocol,
} from '@/databases/sync/assets';
import { KeyringAccountWithAlias } from '@/hooks/account';
import { useSafeState } from '@/hooks/useSafeState';
import { batchQueryNFTsWithLocalCache } from '@/screens/Home/utils/nft';
import {
  batchLoadProjects,
  loadAppChainList,
  loadPortfolioSnapshot,
  snapshot2Display,
} from '@/screens/Home/utils/portfolio';
import { batchQueryTokensWithLocalCache } from '@/screens/Home/utils/token';

import { TokenItemEntity } from '../entities/tokenitem';
import { formatAppChain, isAppChain } from '@/screens/Home/utils/appchain';

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

export const loadAppChainComplexProtocols = async (userAddr: string) => {
  try {
    const appChainListRes = await loadAppChainList(userAddr);
    const protocols: ComplexProtocol[] = [];
    if (appChainListRes?.apps?.length) {
      appChainListRes.apps.forEach(app => {
        protocols.push(formatAppChain(app));
      });
    }
    const errorAppIds = appChainListRes?.error_apps?.map(app => app.id) || [];
    return { protocols, errorAppIds };
  } catch (error) {
    //  just ignore the data
    console.error('app chain list load failed', error);
    return { protocols: [], errorAppIds: [] };
  }
};

export const syncTokens = async (
  address: string,
  force?: boolean,
  onlySync?: boolean,
) => {
  if (!address) {
    return [];
  }
  console.log('syncTokens', address);
  const tokenRes = await batchQueryTokensWithLocalCache(
    {
      user_id: address,
    },
    force,
    onlySync,
  );
  return (
    tokenRes?.map(i => ({
      ...i,
      owner_addr: address,
    })) || []
  );
};

export const syncProtocols = async (
  address: string,
  force?: boolean,
  onlySync?: boolean,
) => {
  if (!address) {
    return [];
  }
  const isExpired = await ProtocolItemEntity.isExpired(address);

  if (!isExpired && !force) {
    return onlySync ? [] : ProtocolItemEntity.batchQueryPortocols(address);
  }
  const snapshotRes = (await loadPortfolioSnapshot(address)) || [];
  const { list } = snapshot2Display(snapshotRes || []);
  const snapshotData = Object.values(list)?.sort(
    (m, n) => (n.netWorth || 0) - (m.netWorth || 0),
  );

  const chunkIds = chunk(
    snapshotData.map(i => i.id),
    5,
  );
  const protocols: ComplexProtocol[] = [];
  await Promise.all(
    chunkIds.map(async ids => {
      const projects = await batchLoadProjects(address, ids, false, true);
      if (!projects?.length) {
        return;
      }
      protocols.push(...projects.filter(i => !!i));
    }),
  );
  const { protocols: appChainProtocols } = await loadAppChainComplexProtocols(
    address,
  );
  protocols.push(...appChainProtocols);
  runOnJS(syncRemotePortocols)(address, [...protocols]);
  return protocols;
};

export const syncSpecificProtocol = async (
  address: string,
  protocolId: string,
  chain: string,
) => {
  if (!address || !protocolId || !chain) {
    return [];
  }

  const isAppChainProtocol = isAppChain(chain);
  let projects: ComplexProtocol[] = [];
  if (isAppChainProtocol) {
    const { protocols: appChainProtocols, errorAppIds } =
      await loadAppChainComplexProtocols(address);
    if (errorAppIds.includes(protocolId)) {
      throw new Error('App chain protocol error');
    }
    projects = appChainProtocols.filter(i => i.id === protocolId);
  } else {
    projects = (
      await batchLoadProjects(address, [protocolId], false, true)
    ).filter(i => !!i) as ComplexProtocol[];
  }
  if (
    !projects?.length ||
    !projects[0] ||
    !projects[0].portfolio_item_list?.length
  ) {
    runOnJS(syncRemotePortocol)(address, null, { deleteId: protocolId });
    return [];
  }

  runOnJS(syncRemotePortocol)(address, projects[0]);
  return projects;
};

export const syncNFTs = async (
  address: string,
  force?: boolean,
  onlySync?: boolean,
) => {
  try {
    const nfts = await batchQueryNFTsWithLocalCache(
      {
        id: address,
        isAll: true,
        sortByCredit: true,
      },
      force,
      onlySync,
    );
    return nfts;
  } catch (e) {
    console.error(e);
    return [];
  }
};

export const useSyncAssetsDB = (sortedAccounts: KeyringAccountWithAlias[]) => {
  const [isSyncing, setIsSyncing] = useSafeState(false);
  const [isFirstFetch, setIsFirstFetch] = useState(true);
  const abortRef = useRef(false);

  const interrupt = () => {
    abortRef.current = true;
  };

  const syncTop10Assets = async (force?: boolean) => {
    const top10Account = sortedAccounts.filter(i => !!i.balance).slice(0, 10);
    setIsSyncing(true);
    const addresses = [
      ...new Set([...top10Account.map(i => i.address.toLowerCase())]),
    ];
    try {
      for (const address of addresses) {
        if (abortRef.current) {
          console.log('Fetching interrupted.');
          setIsSyncing(false);
          setIsFirstFetch(false);
          break;
        }

        try {
          await Promise.all([
            syncTokens(address, force, true),
            syncProtocols(address, force, true),
            syncNFTs(address, force, true),
          ]);
        } catch (error) {
          console.error(`Error fetching data for ${address.slice(-4)}:`, error);
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
