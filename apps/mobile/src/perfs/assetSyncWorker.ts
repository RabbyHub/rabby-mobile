import {
  ASSET_SYNC_WORKER_SCHEMA_VERSION,
  normalizeAssetSyncCompletion,
  type TokenAssetSyncReceipt,
  type TokenAssetSyncRequest,
} from '@rabby-wallet/asset-sync-worker-core';
import { stringUtils } from '@rabby-wallet/base-utils';

import { APP_VERSIONS, isNonPublicProductionEnv } from '@/constant';
import { openapi } from '@/core/request';
import { openApiStore } from '@/core/storage/openapiStore';
import { getWorkerTokenAssetSyncEnabled } from '@/hooks/appSettings';

import {
  isWorkerThreadRunning,
  startComputationThread,
  workerThread,
} from './thread';
import { dispatchAssetSyncCompletion } from './assetSyncCompletion';
import {
  notifyAssetSyncPersistenceTaskReady,
  recoverAssetSyncPersistenceQueue,
} from './assetSyncPersistenceQueue';

const TOKEN_SYNC_TIMEOUT_MS = 2 * 60 * 1000;
let activeTokenRequestId: string | null = null;
let lastTokenRequestIssuedAt = 0;
let didSubscribeAssetSyncCompletions = false;

function ensureAssetSyncCompletionEventsStarted() {
  if (didSubscribeAssetSyncCompletions) {
    return;
  }
  didSubscribeAssetSyncCompletions = true;
  void recoverAssetSyncPersistenceQueue();
  workerThread.onThreadMessage(message => {
    if (message.type === 'assetSync:persistence-task-ready') {
      void notifyAssetSyncPersistenceTaskReady(message.taskId);
      return;
    }
    if (message.type !== 'assetSync:completion') {
      return;
    }
    dispatchAssetSyncCompletion(message.data).catch(error => {
      if (isNonPublicProductionEnv) {
        console.warn('[WorkerAssetSync] completion event rejected', error);
      }
    });
  });
}

function logWorkerTokenSync(
  phase: string,
  details: Record<string, number | string | boolean>,
) {
  if (isNonPublicProductionEnv) {
    console.info(`[WorkerAssetSync] ${phase}`, details);
  }
}

function classifyWorkerError(errorCode?: string) {
  const normalized = errorCode?.toLowerCase() || '';
  const httpStatus = normalized.match(/(?:http|status code)\D*(\d{3})/);
  if (httpStatus) {
    return `http_${httpStatus[1]}`;
  }
  if (normalized.includes('xmlhttprequest')) {
    return 'xhr_unavailable';
  }
  if (normalized.includes('textdecoder')) {
    return 'text_decoder_unavailable';
  }
  if (normalized.includes('textencoder')) {
    return 'text_encoder_unavailable';
  }
  if (normalized.includes('timeout')) {
    return 'timeout';
  }
  if (normalized.includes('network')) {
    return 'network';
  }
  if (normalized.startsWith('asset_sync_')) {
    return normalized;
  }
  return normalized ? 'other' : 'unknown';
}

function summarizeWorkerErrors(receipt: TokenAssetSyncReceipt) {
  const counts = receipt.addresses.reduce<Record<string, number>>(
    (result, address) => {
      if (!address.errorCode) {
        return result;
      }
      const category = classifyWorkerError(address.errorCode);
      result[category] = (result[category] || 0) + 1;
      return result;
    },
    {},
  );
  return (
    Object.entries(counts)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([category, count]) => `${category}:${count}`)
      .join(',') || 'none'
  );
}

function nextTokenRequestIssuedAt() {
  lastTokenRequestIssuedAt = Math.max(Date.now(), lastTokenRequestIssuedAt + 1);
  return lastTokenRequestIssuedAt;
}

function isValidReceipt(
  receipt: TokenAssetSyncReceipt | undefined,
  requestId: string,
): receipt is TokenAssetSyncReceipt {
  try {
    return !!(
      receipt?.schemaVersion === ASSET_SYNC_WORKER_SCHEMA_VERSION &&
      receipt.requestId === requestId &&
      receipt.kind === 'token' &&
      Array.isArray(receipt.addresses) &&
      receipt.addresses.every(address => {
        const completion = normalizeAssetSyncCompletion(address);
        return (
          completion.requestId === requestId && completion.kind === 'token'
        );
      })
    );
  } catch {
    return false;
  }
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

  ensureAssetSyncCompletionEventsStarted();

  logWorkerTokenSync('start-requested', {
    addressCount: input.addresses.length,
    force: input.force,
  });
  await startComputationThread('worker_token_asset_sync');
  if (!isWorkerThreadRunning()) {
    logWorkerTokenSync('worker-unavailable', {
      addressCount: input.addresses.length,
    });
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
    const successfulCompletions = receipt.addresses.filter(
      completion => completion.success,
    );
    const applications = await Promise.allSettled(
      successfulCompletions.map(completion =>
        dispatchAssetSyncCompletion(completion),
      ),
    );
    if (applications.some(application => application.status === 'rejected')) {
      throw new Error('asset_sync_worker_commit_application_failed');
    }
    logWorkerTokenSync('receipt', {
      outcome: receipt.outcome,
      addressCount: receipt.addresses.length,
      completeAddressCount: receipt.addresses.filter(
        address => address.outcome === 'complete',
      ).length,
      committedRowCount: receipt.addresses.reduce(
        (count, address) => count + address.committedRowCount,
        0,
      ),
      durationMs: receipt.finishedAt - receipt.startedAt,
      errorSummary: summarizeWorkerErrors(receipt),
    });
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
