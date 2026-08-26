import {
  createTokenAssetSyncCoordinator,
  type AssetSyncWorkerBootstrap,
  type TokenAssetSyncRequest,
} from '@rabby-wallet/asset-sync-worker-core';

import { createWorkerTokenAssetApi } from './openApi';
import { workerTokenSnapshotPersistence } from './nativeTokenPersistence';

const cancelledRequestIds = new Set<string>();
let activeRuntime:
  | {
      bootstrapKey: string;
      coordinator: ReturnType<typeof createTokenAssetSyncCoordinator>;
    }
  | undefined;

function makeBootstrapKey(bootstrap: AssetSyncWorkerBootstrap) {
  return JSON.stringify([
    bootstrap.host,
    bootstrap.apiKey,
    bootstrap.apiTime,
    bootstrap.clientVersion,
  ]);
}

function getCoordinator(bootstrap: AssetSyncWorkerBootstrap) {
  const bootstrapKey = makeBootstrapKey(bootstrap);
  if (activeRuntime?.bootstrapKey !== bootstrapKey) {
    activeRuntime = {
      bootstrapKey,
      coordinator: createTokenAssetSyncCoordinator({
        api: createWorkerTokenAssetApi(bootstrap),
        persistence: workerTokenSnapshotPersistence,
        addressConcurrency: 6,
        chainConcurrency: 15,
        isCancelled: requestId => cancelledRequestIds.has(requestId),
      }),
    };
  }
  return activeRuntime.coordinator;
}

export async function syncTokenAssetsInWorker(request: TokenAssetSyncRequest) {
  try {
    return await getCoordinator(request.bootstrap).sync(request);
  } finally {
    cancelledRequestIds.delete(request.requestId);
  }
}

export function cancelAssetSyncInWorker(requestId: string) {
  if (!requestId) {
    return false;
  }
  cancelledRequestIds.add(requestId);
  return true;
}
