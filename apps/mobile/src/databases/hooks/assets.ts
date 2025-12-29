import { ComplexProtocol } from '@rabby-wallet/rabby-api/dist/types';
import { chunk } from 'lodash';
import { useCallback, useEffect, useState } from 'react';

import { ProtocolItemEntity } from '@/databases/entities/portocolItem';
import {
  syncRemotePortocols,
  syncRemotePortocol,
} from '@/databases/sync/assets';
import { batchQueryNFTsWithLocalCache } from '@/screens/Home/utils/nft';
import {
  batchLoadProjects,
  loadAppChainList,
  loadPortfolioSnapshot,
  snapshot2Display,
} from '@/screens/Home/utils/portfolio';

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
  syncRemotePortocols(address, [...protocols]);
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
    syncRemotePortocol(address, null, { deleteId: protocolId });
    return [];
  }

  syncRemotePortocol(address, projects[0]);
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
