import { ComplexProtocol } from '@rabby-wallet/rabby-api/dist/types';
import { useCallback, useEffect, useState } from 'react';

import { ProtocolItemEntity } from '@/databases/entities/portocolItem';
import {
  syncRemoteProtocols,
  syncRemoteProtocol,
} from '@/databases/sync/assets';
import { batchQueryNFTsWithLocalCache } from '@/screens/Home/utils/nft';
import {
  batchLoadProjects,
  loadAppChainList,
  loadPortfolioSnapshot,
} from '@/screens/Home/utils/portfolio';

import { TokenItemEntity } from '../entities/tokenitem';
import { formatAppChain, isAppChain } from '@/screens/Home/utils/appchain';
import { IProtocolItem } from '@/store/protocols';
import { complexProtocol2ProtocolItem } from '@/utils/protocol';

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
): Promise<IProtocolItem[]> => {
  if (!address) {
    return [];
  }
  const isExpired = await ProtocolItemEntity.isExpired(address);

  if (!isExpired && !force) {
    const protocols = await ProtocolItemEntity.batchQueryProtocols(address);
    return protocols;
  }
  const snapshotRes = (await loadPortfolioSnapshot(address)) || [];
  const { protocols: appChainProtocols } = await loadAppChainComplexProtocols(
    address,
  );
  const protocols = [...snapshotRes, ...appChainProtocols];
  syncRemoteProtocols(address, protocols);
  return protocols.map(p => complexProtocol2ProtocolItem(p, address));
};

export const syncSpecificProtocol = async (
  address: string,
  protocolId: string,
  chain: string,
): Promise<IProtocolItem | undefined> => {
  if (!address || !protocolId || !chain) {
    return undefined;
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
    syncRemoteProtocol(address, null, { deleteId: protocolId });
    return undefined;
  }

  syncRemoteProtocol(address, projects[0]);
  return complexProtocol2ProtocolItem(projects[0], address);
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
