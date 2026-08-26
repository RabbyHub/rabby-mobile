import {
  ASSET_SYNC_PERSISTENCE_QUARANTINE_KEY_PREFIX,
  ASSET_SYNC_PERSISTENCE_QUEUE_SCHEMA_VERSION,
  createTokenSnapshotPersistenceTask,
  getAssetSyncPersistenceTaskKey,
  makeTokenCacheRows,
  serializeAssetSyncPersistenceTask,
  type AssetSyncPersistenceAck,
  type AssetSyncCompletion,
  type TokenSnapshotPersistenceTask,
} from '@rabby-wallet/asset-sync-worker-core';

import {
  createAssetSyncPersistenceQueueController,
  type AssetSyncPersistenceQueueStorage,
} from './assetSyncPersistenceQueue';

const ADDRESS = `0x${'a'.repeat(40)}`;
const GENERATION = 123;

class MemoryQueueStorage implements AssetSyncPersistenceQueueStorage {
  readonly values = new Map<string, string>();
  readonly operations: string[] = [];

  getAllKeys() {
    return Array.from(this.values.keys());
  }

  getString(key: string) {
    return this.values.get(key);
  }

  set(key: string, value: string) {
    this.operations.push(`set:${key}`);
    this.values.set(key, value);
  }

  delete(key: string) {
    this.operations.push(`delete:${key}`);
    this.values.delete(key);
  }

  clearAll() {
    this.operations.push('clear');
    this.values.clear();
  }

  sync() {
    this.operations.push('sync');
  }

  reload() {
    this.operations.push('reload');
  }
}

const makeTask = () =>
  createTokenSnapshotPersistenceTask({
    requestId: 'request-1',
    createdAt: GENERATION,
    address: ADDRESS,
    generation: GENERATION,
    replacementScope: 'address',
    chainIds: ['eth'],
    failedChainIds: [],
    rows: makeTokenCacheRows(
      ADDRESS,
      [{ id: 'eth', chain: 'eth', amount: 1, price: 2 }],
      GENERATION,
    ),
  });

const storeTask = (
  storage: MemoryQueueStorage,
  task: TokenSnapshotPersistenceTask,
) => {
  storage.set(
    getAssetSyncPersistenceTaskKey(task.taskId),
    serializeAssetSyncPersistenceTask(task),
  );
  storage.sync();
  storage.operations.length = 0;
};

const makeDependencies = (
  storage: MemoryQueueStorage,
  overrides: Record<string, unknown> = {},
) => ({
  storage,
  commitTask: jest.fn(async (task: TokenSnapshotPersistenceTask) => ({
    rowCount: task.rows.length,
    applied: true,
    committedAt: task.generation,
  })),
  dispatchCompletion: jest.fn(
    async (completion: AssetSyncCompletion) => completion,
  ),
  hasCompletionHandler: jest.fn(() => true),
  shouldAcknowledgeWorker: jest.fn(() => true),
  acknowledgeWorker: jest.fn(async (_ack: AssetSyncPersistenceAck) => true),
  now: jest.fn(() => 999),
  schedule: jest.fn((run: () => void) => setTimeout(run, 0)),
  cancelSchedule: jest.fn((timer: ReturnType<typeof setTimeout>) =>
    clearTimeout(timer),
  ),
  reportError: jest.fn(),
  ...overrides,
});

describe('asset sync persistence queue', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('recovers and consumes a durable task in commit, apply, ack, delete order', async () => {
    const storage = new MemoryQueueStorage();
    const task = makeTask();
    storeTask(storage, task);
    const order: string[] = [];
    const dependencies = makeDependencies(storage, {
      commitTask: jest.fn(async () => {
        order.push('commit');
        return {
          rowCount: task.rows.length,
          applied: true,
          committedAt: task.generation,
        };
      }),
      dispatchCompletion: jest.fn(async (completion: AssetSyncCompletion) => {
        order.push('dispatch');
        return completion;
      }),
      acknowledgeWorker: jest.fn(async () => {
        order.push('ack');
        return true;
      }),
    });
    const originalDelete = storage.delete.bind(storage);
    storage.delete = key => {
      order.push('delete');
      originalDelete(key);
    };

    await createAssetSyncPersistenceQueueController(dependencies).recover();

    expect(order).toEqual(['commit', 'dispatch', 'ack', 'delete']);
    expect(
      storage.getString(getAssetSyncPersistenceTaskKey(task.taskId)),
    ).toBeUndefined();
    expect(dependencies.acknowledgeWorker).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaVersion: ASSET_SYNC_PERSISTENCE_QUEUE_SCHEMA_VERSION,
        taskId: task.taskId,
        status: 'committed',
      }),
    );
  });

  it('deduplicates concurrent notifications for the same task', async () => {
    const storage = new MemoryQueueStorage();
    const task = makeTask();
    storeTask(storage, task);
    let releaseCommit!: () => void;
    const commitGate = new Promise<void>(resolve => {
      releaseCommit = resolve;
    });
    const dependencies = makeDependencies(storage, {
      commitTask: jest.fn(async () => {
        await commitGate;
        return { rowCount: 1, applied: true, committedAt: task.generation };
      }),
    });
    const controller = createAssetSyncPersistenceQueueController(dependencies);

    const first = controller.notify(task.taskId);
    const second = controller.notify(task.taskId);
    releaseCommit();
    await Promise.all([first, second]);

    expect(dependencies.commitTask).toHaveBeenCalledTimes(1);
    expect(dependencies.dispatchCompletion).toHaveBeenCalledTimes(1);
  });

  it('keeps a failed task durable and retries it', async () => {
    const storage = new MemoryQueueStorage();
    const task = makeTask();
    storeTask(storage, task);
    const scheduled: Array<() => void> = [];
    const dependencies = makeDependencies(storage, {
      commitTask: jest
        .fn()
        .mockRejectedValueOnce(new Error('database busy'))
        .mockResolvedValueOnce({
          rowCount: 1,
          applied: true,
          committedAt: task.generation,
        }),
      schedule: jest.fn((run: () => void) => {
        scheduled.push(run);
        return scheduled.length as unknown as ReturnType<typeof setTimeout>;
      }),
      cancelSchedule: jest.fn(),
    });
    const controller = createAssetSyncPersistenceQueueController(dependencies);

    await controller.notify(task.taskId);
    expect(
      storage.getString(getAssetSyncPersistenceTaskKey(task.taskId)),
    ).toBeDefined();
    expect(scheduled).toHaveLength(1);

    scheduled[0]();
    await controller.notify(task.taskId);

    expect(dependencies.commitTask).toHaveBeenCalledTimes(2);
    expect(
      storage.getString(getAssetSyncPersistenceTaskKey(task.taskId)),
    ).toBeUndefined();
  });

  it('treats the same committed generation as an idempotent replay', async () => {
    const storage = new MemoryQueueStorage();
    const task = makeTask();
    storeTask(storage, task);
    const dependencies = makeDependencies(storage, {
      commitTask: jest.fn(async () => ({
        rowCount: task.rows.length,
        applied: true,
        committedAt: task.generation,
        replayed: true,
      })),
    });

    await createAssetSyncPersistenceQueueController(dependencies).recover();

    expect(dependencies.dispatchCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'replayed',
        superseded: false,
        committedRowCount: task.rows.length,
      }),
    );
    expect(dependencies.acknowledgeWorker).toHaveBeenCalledWith(
      expect.objectContaining({ applied: true, rowCount: task.rows.length }),
    );
  });

  it('quarantines an unsupported task without committing it', async () => {
    const storage = new MemoryQueueStorage();
    const task = makeTask();
    const key = getAssetSyncPersistenceTaskKey(task.taskId);
    storage.set(
      key,
      JSON.stringify({
        ...task,
        schemaVersion: ASSET_SYNC_PERSISTENCE_QUEUE_SCHEMA_VERSION + 1,
      }),
    );
    const dependencies = makeDependencies(storage);

    await createAssetSyncPersistenceQueueController(dependencies).recover();

    expect(dependencies.commitTask).not.toHaveBeenCalled();
    expect(storage.getString(key)).toBeUndefined();
    expect(
      storage
        .getAllKeys()
        .some(candidate =>
          candidate.startsWith(ASSET_SYNC_PERSISTENCE_QUARANTINE_KEY_PREFIX),
        ),
    ).toBe(true);
    expect(dependencies.acknowledgeWorker).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: task.taskId, status: 'rejected' }),
    );
  });

  it('replays into SQLite without importing a missing live Store handler', async () => {
    const storage = new MemoryQueueStorage();
    const task = makeTask();
    storeTask(storage, task);
    const dependencies = makeDependencies(storage, {
      hasCompletionHandler: jest.fn(() => false),
      shouldAcknowledgeWorker: jest.fn(() => false),
    });

    await createAssetSyncPersistenceQueueController(dependencies).recover();

    expect(dependencies.commitTask).toHaveBeenCalledTimes(1);
    expect(dependencies.dispatchCompletion).not.toHaveBeenCalled();
    expect(dependencies.acknowledgeWorker).not.toHaveBeenCalled();
    expect(
      storage.getString(getAssetSyncPersistenceTaskKey(task.taskId)),
    ).toBeUndefined();
  });
});
