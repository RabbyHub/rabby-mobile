import {
  ASSET_SYNC_PERSISTENCE_QUEUE_SCHEMA_VERSION,
  ASSET_SYNC_PERSISTENCE_QUEUE_STORAGE_ID,
  getAssetSyncPersistenceTaskKey,
  makeTokenCacheRows,
  parseAssetSyncPersistenceTask,
} from '@rabby-wallet/asset-sync-worker-core';
import { MMKV } from 'react-native-mmkv';

jest.mock('../utils/ThreadSelf', () => ({
  ThreadSelf: {
    postMessage: jest.fn(),
  },
}));

import { ThreadSelf } from '../utils/ThreadSelf';
import {
  acknowledgeAssetSyncPersistenceTask,
  workerTokenSnapshotPersistence,
} from './nativeTokenPersistence';

const mockPostMessage = ThreadSelf.postMessage as jest.Mock;

const ADDRESS = `0x${'a'.repeat(40)}`;
const GENERATION = 123;

describe('worker token persistence queue', () => {
  const storage = new MMKV({
    id: ASSET_SYNC_PERSISTENCE_QUEUE_STORAGE_ID,
  });

  beforeEach(() => {
    storage.clearAll();
    mockPostMessage.mockReset();
  });

  it('persists a valid task before emitting and waits for its acknowledgement', async () => {
    let persistedTaskId = '';
    mockPostMessage.mockImplementationOnce(message => {
      persistedTaskId = message.taskId;
      const serialized = storage.getString(
        getAssetSyncPersistenceTaskKey(message.taskId),
      );
      expect(typeof serialized).toBe('string');
      expect(parseAssetSyncPersistenceTask(serialized!)).toMatchObject({
        taskId: message.taskId,
        address: ADDRESS,
        generation: GENERATION,
      });
    });

    const pending = workerTokenSnapshotPersistence.commitTokenSnapshot({
      requestId: 'request-1',
      address: ADDRESS,
      syncTimestamp: GENERATION,
      replacementScope: 'address',
      chainIds: ['eth'],
      failedChainIds: [],
      rows: makeTokenCacheRows(
        ADDRESS,
        [{ id: 'eth', chain: 'eth', amount: 1, price: 2 }],
        GENERATION,
      ),
    });

    expect(mockPostMessage).toHaveBeenCalledWith({
      type: 'assetSync:persistence-task-ready',
      taskId: persistedTaskId,
    });
    expect(
      acknowledgeAssetSyncPersistenceTask({
        schemaVersion: ASSET_SYNC_PERSISTENCE_QUEUE_SCHEMA_VERSION,
        taskId: persistedTaskId,
        status: 'committed',
        rowCount: 1,
        applied: true,
        committedAt: GENERATION,
        errorCode: '',
      }),
    ).toBe(true);
    await expect(pending).resolves.toEqual({
      rowCount: 1,
      applied: true,
      committedAt: GENERATION,
    });
  });
});
