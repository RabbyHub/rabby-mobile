import {
  ASSET_SYNC_PERSISTENCE_QUEUE_STORAGE_ID,
  MAX_ASSET_SYNC_PERSISTENCE_TASKS,
  createTokenSnapshotPersistenceTask,
  getAssetSyncPersistenceTaskIdFromKey,
  getAssetSyncPersistenceTaskKey,
  normalizeAssetSyncPersistenceAck,
  serializeAssetSyncPersistenceTask,
  type AssetSyncPersistenceAck,
  type TokenSnapshotPersistence,
} from '@rabby-wallet/asset-sync-worker-core';
import { MMKV } from 'react-native-mmkv';

import { ThreadSelf } from '../utils/ThreadSelf';

const PERSISTENCE_ACK_TIMEOUT_MS = 90_000;

type PendingPersistence = {
  promise: Promise<{
    rowCount: number;
    applied: boolean;
    committedAt: number;
  }>;
  resolve(value: {
    rowCount: number;
    applied: boolean;
    committedAt: number;
  }): void;
  reject(error: Error): void;
  timer: ReturnType<typeof setTimeout>;
};

const queueStorage = new MMKV({
  id: ASSET_SYNC_PERSISTENCE_QUEUE_STORAGE_ID,
});
const pendingPersistence = new Map<string, PendingPersistence>();

function getQueuedTaskCount() {
  return queueStorage
    .getAllKeys()
    .filter(key => getAssetSyncPersistenceTaskIdFromKey(key) !== null).length;
}

function createPendingPersistence(taskId: string) {
  const existing = pendingPersistence.get(taskId);
  if (existing) {
    return existing;
  }

  let resolve!: PendingPersistence['resolve'];
  let reject!: PendingPersistence['reject'];
  const promise = new Promise<{
    rowCount: number;
    applied: boolean;
    committedAt: number;
  }>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  const pending: PendingPersistence = {
    promise,
    resolve,
    reject,
    timer: setTimeout(() => {
      if (pendingPersistence.get(taskId) !== pending) {
        return;
      }
      pendingPersistence.delete(taskId);
      pending.reject(new Error('asset_sync_persistence_ack_timeout'));
    }, PERSISTENCE_ACK_TIMEOUT_MS),
  };
  pendingPersistence.set(taskId, pending);
  return pending;
}

export const workerTokenSnapshotPersistence: TokenSnapshotPersistence = {
  async commitTokenSnapshot(input) {
    const task = createTokenSnapshotPersistenceTask({
      requestId: input.requestId,
      createdAt: input.syncTimestamp,
      address: input.address,
      generation: input.syncTimestamp,
      replacementScope: input.replacementScope,
      chainIds: input.chainIds,
      failedChainIds: input.failedChainIds,
      rows: input.rows,
    });
    const key = getAssetSyncPersistenceTaskKey(task.taskId);
    const serialized = serializeAssetSyncPersistenceTask(task);
    const existing = queueStorage.getString(key);
    const hasExistingTask = typeof existing === 'string';
    if (hasExistingTask && existing !== serialized) {
      throw new Error('asset_sync_persistence_task_collision');
    }
    if (
      !hasExistingTask &&
      getQueuedTaskCount() >= MAX_ASSET_SYNC_PERSISTENCE_TASKS
    ) {
      throw new Error('asset_sync_persistence_queue_full');
    }

    const pending = createPendingPersistence(task.taskId);
    queueStorage.set(key, serialized);
    queueStorage.sync();
    ThreadSelf.postMessage({
      type: 'assetSync:persistence-task-ready',
      taskId: task.taskId,
    });
    return pending.promise;
  },
};

export function acknowledgeAssetSyncPersistenceTask(
  rawAck: AssetSyncPersistenceAck,
) {
  const ack = normalizeAssetSyncPersistenceAck(rawAck);
  const pending = pendingPersistence.get(ack.taskId);
  if (!pending) {
    return false;
  }

  pendingPersistence.delete(ack.taskId);
  clearTimeout(pending.timer);
  if (ack.status === 'rejected') {
    pending.reject(
      new Error(ack.errorCode || 'asset_sync_persistence_task_rejected'),
    );
  } else {
    pending.resolve({
      rowCount: ack.rowCount,
      applied: ack.applied,
      committedAt: ack.committedAt,
    });
  }
  return true;
}
