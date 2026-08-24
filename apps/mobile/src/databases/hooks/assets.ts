import { ComplexProtocol } from '@rabby-wallet/rabby-api/dist/types';
import { useCallback, useEffect, useState } from 'react';

import { ProtocolItemEntity } from '@/databases/entities/portocolItem';
import { syncRemoteProtocol } from '@/databases/sync/assets';
import { batchQueryNFTSnapshotWithLocalCache } from '@/databases/hooks/nft';
import type { NftSnapshotLoadOptions } from '@/databases/hooks/nft';
import {
  batchLoadProjects,
  loadPortfolioSnapshot,
  type PortfolioSnapshotRequestDetails,
  type PortfolioSnapshotRequestPhase,
} from '@/core/apis/portfolio';

import { TokenItemEntity } from '../entities/tokenitem';
import { formatAppChain, isAppChain } from '@/utils/appchain';
import type { IProtocolItem } from '@/types/assets';
import { complexProtocol2ProtocolItem } from '@/utils/protocol';
import { useAppChainStore } from '@/store/appchain';
import {
  ASSET_REMOTE_ADDRESS_CONCURRENCY,
  mapWithConcurrency,
} from '@/core/utils/boundedConcurrency';

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

export const loadAppChainComplexProtocols = async (
  userAddr: string,
  force = false,
) => {
  try {
    // 从 appchain store 读取数据
    const lowerAddr = userAddr.toLowerCase();
    await useAppChainStore.getState().getAppChains(lowerAddr, force);
    const appChainMap = useAppChainStore.getState().appChainMap;
    const appChains = appChainMap[lowerAddr] || [];

    const protocols: ComplexProtocol[] = appChains.map(app =>
      formatAppChain(app),
    );

    // store 中只存储成功的数据，没有 error_apps
    const errorAppIds: string[] = [];
    return { protocols, errorAppIds };
  } catch (error) {
    //  just ignore the data
    console.error('app chain list load failed', error);
    return { protocols: [], errorAppIds: [] };
  }
};

export const loadProtocols = async (
  address: string,
  force?: boolean,
): Promise<LoadedProtocolResult> => {
  if (!address) {
    return {
      address,
      protocols: [],
    };
  }
  const normalizedAddress = address.toLowerCase();
  const isExpired = await ProtocolItemEntity.isExpired(normalizedAddress);

  if (!isExpired && !force) {
    const protocols = await ProtocolItemEntity.batchQueryProtocols(
      normalizedAddress,
    );
    return {
      address: normalizedAddress,
      protocols,
    };
  }
  const snapshotRes = (await loadPortfolioSnapshot(normalizedAddress)) || [];
  const { protocols: appChainProtocols } = await loadAppChainComplexProtocols(
    normalizedAddress,
    force,
  );
  const protocols = [...snapshotRes, ...appChainProtocols];
  return {
    address: normalizedAddress,
    protocols: protocols.map(p =>
      complexProtocol2ProtocolItem(p, normalizedAddress),
    ),
    remoteProtocols: snapshotRes,
  };
};

export type LoadedProtocolResult = {
  address: string;
  protocols: IProtocolItem[];
  remoteProtocols?: ComplexProtocol[];
};

async function loadProtocolsForSync(
  address: string,
  force?: boolean,
  diagnostics?: ProtocolAddressLoadDiagnostics,
): Promise<LoadedProtocolResult> {
  if (!address) {
    return {
      address,
      protocols: [],
    };
  }

  const normalizedAddress = address.toLowerCase();
  const isExpired = await ProtocolItemEntity.isExpired(normalizedAddress);

  if (!isExpired && !force) {
    const protocols = await ProtocolItemEntity.batchQueryProtocols(
      normalizedAddress,
    );
    return {
      address: normalizedAddress,
      protocols,
    };
  }

  const snapshotRes =
    (await loadPortfolioSnapshot(normalizedAddress, (phase, details) => {
      diagnostics?.markPortfolioRequest(phase, details);
    })) || [];
  diagnostics?.mark('portfolio-payload-ready', {
    itemCount: snapshotRes.length,
  });
  const appChainStartedAt = Date.now();
  const { protocols: appChainProtocols } = await loadAppChainComplexProtocols(
    normalizedAddress,
    force,
  );
  diagnostics?.mark('appchain-completed', {
    elapsedMs: Date.now() - appChainStartedAt,
    itemCount: appChainProtocols.length,
  });
  const protocols = [...snapshotRes, ...appChainProtocols];
  const conversionStartedAt = Date.now();
  const convertedProtocols = protocols.map(p =>
    complexProtocol2ProtocolItem(p, normalizedAddress),
  );
  diagnostics?.mark('protocol-conversion-completed', {
    elapsedMs: Date.now() - conversionStartedAt,
    itemCount: convertedProtocols.length,
  });

  return {
    address: normalizedAddress,
    protocols: convertedProtocols,
    remoteProtocols: snapshotRes,
  };
}

type ProtocolLoadDiagnosticDetails = Readonly<
  Record<string, string | number | boolean | null | undefined>
>;

export type ProtocolLoadDiagnostics = {
  mark: (phase: string, details?: ProtocolLoadDiagnosticDetails) => void;
};

type ProtocolAddressLoadDiagnostics = {
  mark: (phase: string, details?: ProtocolLoadDiagnosticDetails) => void;
  markPortfolioRequest: (
    phase: PortfolioSnapshotRequestPhase,
    details: PortfolioSnapshotRequestDetails,
  ) => void;
};

export type LoadedProtocolMapResult = {
  protocolMap: Record<string, IProtocolItem[]>;
  remoteProtocolMap: Record<string, ComplexProtocol[]>;
};

export const loadProtocolsForAddresses = async (
  addresses: string[],
  force?: boolean,
  diagnostics?: ProtocolLoadDiagnostics,
): Promise<LoadedProtocolMapResult> => {
  const lowerAddresses = Array.from(
    new Set(addresses.map(address => address.toLowerCase()).filter(Boolean)),
  );
  if (!lowerAddresses.length) {
    return {
      protocolMap: {},
      remoteProtocolMap: {},
    };
  }

  let settledAddressCount = 0;
  const results = await mapWithConcurrency(
    lowerAddresses,
    ASSET_REMOTE_ADDRESS_CONCURRENCY,
    (address, addressIndex) => {
      const mark = (phase: string, details?: ProtocolLoadDiagnosticDetails) =>
        diagnostics?.mark(phase, {
          addressIndex,
          addressCount: lowerAddresses.length,
          ...details,
        });
      return loadProtocolsForSync(address, force, {
        mark,
        markPortfolioRequest: (phase, details) =>
          mark(`portfolio-${phase}`, details),
      }).finally(() => {
        settledAddressCount += 1;
        mark('address-settled', { settledAddressCount });
      });
    },
  );
  const protocolMap: Record<string, IProtocolItem[]> = {};
  const remoteProtocolMap: Record<string, ComplexProtocol[]> = {};

  results.forEach(result => {
    protocolMap[result.address] = result.protocols;
    if (result.remoteProtocols) {
      remoteProtocolMap[result.address] = result.remoteProtocols;
    }
  });

  return {
    protocolMap,
    remoteProtocolMap,
  };
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
  if (!isAppChainProtocol) {
    syncRemoteProtocol(address, projects[0]);
  }
  return complexProtocol2ProtocolItem(projects[0], address);
};

export const syncNFTs = async (
  address: string,
  force?: boolean,
  onlySync?: boolean,
  options?: NftSnapshotLoadOptions,
) => {
  return batchQueryNFTSnapshotWithLocalCache(
    {
      id: address,
      isAll: true,
      sortByCredit: true,
    },
    force,
    onlySync,
    options,
  );
};
