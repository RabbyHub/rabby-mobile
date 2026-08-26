import {
  ASSET_SYNC_WORKER_SCHEMA_VERSION,
  type TokenAssetSyncReceipt,
  type TokenAssetSyncRequest,
} from '@rabby-wallet/asset-sync-worker-core';
import { stringUtils } from '@rabby-wallet/base-utils';

import { APP_VERSIONS } from '@/constant';
import { openapi } from '@/core/request';
import { openApiStore } from '@/core/storage/openapiStore';
import { getWorkerTokenAssetSyncEnabled } from '@/hooks/appSettings';

import {
  isWorkerThreadRunning,
  startComputationThread,
  workerThread,
} from './thread';

const TOKEN_SYNC_TIMEOUT_MS = 2 * 60 * 1000;
let activeTokenRequestId: string | null = null;
let lastTokenRequestIssuedAt = 0;

function nextTokenRequestIssuedAt() {
  lastTokenRequestIssuedAt = Math.max(Date.now(), lastTokenRequestIssuedAt + 1);
  return lastTokenRequestIssuedAt;
}

function isValidReceipt(
  receipt: TokenAssetSyncReceipt | undefined,
  requestId: string,
): receipt is TokenAssetSyncReceipt {
  return (
    receipt?.schemaVersion === ASSET_SYNC_WORKER_SCHEMA_VERSION &&
    receipt.requestId === requestId &&
    receipt.kind === 'token' &&
    Array.isArray(receipt.addresses)
  );
}

function cancelWorkerRequest(requestId: string) {
  void workerThread
    .remoteCall('assetSync:cancel', { requestId }, { timeout: 5 * 1000 })
    .catch(() => undefined);
}

export async function trySyncTokenAssetsOnWorker(input: {
  addresses: string[];
  force: boolean;
}): Promise<TokenAssetSyncReceipt | null> {
  if (!getWorkerTokenAssetSyncEnabled()) {
    return null;
  }

  await startComputationThread('worker_token_asset_sync');
  if (!isWorkerThreadRunning()) {
    return null;
  }

  if (activeTokenRequestId) {
    cancelWorkerRequest(activeTokenRequestId);
  }

  const requestId = `token-${Date.now()}-${stringUtils.randString()}`;
  activeTokenRequestId = requestId;
  const request: TokenAssetSyncRequest = {
    schemaVersion: ASSET_SYNC_WORKER_SCHEMA_VERSION,
    requestId,
    kind: 'token',
    addresses: input.addresses,
    force: input.force,
    issuedAt: nextTokenRequestIssuedAt(),
    bootstrap: {
      host: openapi.getHost(),
      apiKey: openApiStore.apiKey,
      apiTime: openApiStore.apiTime,
      clientVersion: APP_VERSIONS.fromJs,
    },
  };

  try {
    const receipt = await workerThread.remoteCall(
      'assetSync:token',
      { request },
      { timeout: TOKEN_SYNC_TIMEOUT_MS },
    );
    if (!isValidReceipt(receipt, requestId)) {
      throw new Error('asset_sync_worker_receipt_invalid');
    }
    return receipt;
  } catch (error) {
    cancelWorkerRequest(requestId);
    console.warn('Worker token synchronization fell back to main JS', error);
    return null;
  } finally {
    if (activeTokenRequestId === requestId) {
      activeTokenRequestId = null;
    }
  }
}
