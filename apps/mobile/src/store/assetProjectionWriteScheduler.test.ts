jest.mock('@/core/utils/startupDiagnostics', () => ({
  traceStartupDiagnostic: jest.fn(),
}));
jest.mock('@/databases/assetProjection', () => ({
  persistAssetProjection: jest.fn(),
  restoreLatestAssetProjection: jest.fn(),
}));
jest.mock('@/databases/entities/assetProjection', () => ({
  AssetProjectionSnapshotEntity: class AssetProjectionSnapshotEntity {},
}));
jest.mock('@/databases/sync/abort', () => ({
  registerSyncAbortHandler: jest.fn(),
}));
jest.mock('@/databases/sync/scheduler', () => {
  class SyncTaskAbortError extends Error {}
  return {
    SyncTaskAbortError,
    isSyncTaskAbortError: (error: unknown) =>
      error instanceof SyncTaskAbortError,
    submitSyncTask: jest.fn(),
  };
});

import { persistAssetProjection } from '@/databases/assetProjection';
import { registerSyncAbortHandler } from '@/databases/sync/abort';
import { submitSyncTask } from '@/databases/sync/scheduler';
import { OPSQLiteEvents } from '@/core/databases/op-sqlite/events';
import {
  isAssetProjectionPersistenceActive,
  scheduleAssetProjectionPersistence,
  subscribeAssetProjectionDatabaseCommits,
} from './assetProjectionPersistence';

const mockedPersist = jest.mocked(persistAssetProjection);
const mockedSubmit = jest.mocked(submitSyncTask);
const mockedRegisterAbort = jest.mocked(registerSyncAbortHandler);

const input = {
  runtimeKey: '0xabc::all',
  kind: 'token' as const,
  scene: 'single-address' as const,
  rows: [{ type: 'token' as const, id: '0xabc:eth:token' }],
};

describe('asset projection write scheduling', () => {
  const abortAll = mockedRegisterAbort.mock.calls[0]?.[0];

  beforeEach(() => {
    abortAll?.();
    mockedPersist.mockReset();
    mockedSubmit.mockReset();
    mockedSubmit.mockImplementation(options => {
      const promise = options.runner({
        taskId: 1,
        signal: options.signal,
        setStage: jest.fn(),
        setMethod: jest.fn(),
        markBatch: jest.fn(),
        waitIfPaused: jest.fn(async () => undefined),
      });
      return { taskId: 1, promise };
    });
  });

  it('coalesces identical active and already persisted projections', async () => {
    let finishPersist: (() => void) | undefined;
    mockedPersist.mockImplementation(
      () =>
        new Promise(resolve => {
          finishPersist = () =>
            resolve({ generation: 1, committedAt: Date.now() });
        }),
    );

    const first = scheduleAssetProjectionPersistence(input);
    expect(first).toBeDefined();
    expect(isAssetProjectionPersistenceActive(input)).toBe(true);
    expect(scheduleAssetProjectionPersistence(input)).toBeUndefined();
    expect(mockedSubmit).toHaveBeenCalledTimes(1);

    await Promise.resolve();
    await Promise.resolve();
    expect(finishPersist).toBeDefined();
    finishPersist?.();
    await first?.promise;
    await Promise.resolve();
    expect(isAssetProjectionPersistenceActive(input)).toBe(false);

    expect(scheduleAssetProjectionPersistence(input)).toBeUndefined();
    expect(mockedSubmit).toHaveBeenCalledTimes(1);
  });

  it('only forwards committed projection snapshots', () => {
    const listener = jest.fn();
    const subscription = subscribeAssetProjectionDatabaseCommits(listener);

    OPSQLiteEvents.emit('DATABASE_COMMITTED', {
      tables: ['rabby_projection_item_20260818'],
    });
    expect(listener).not.toHaveBeenCalled();

    OPSQLiteEvents.emit('DATABASE_COMMITTED', {
      tables: [
        'rabby_projection_item_20260818',
        'rabby_projection_snapshot_20260818',
      ],
    });
    expect(listener).toHaveBeenCalledTimes(1);
    subscription.remove();
  });

  it('allows the same projection after a database reset abort', async () => {
    mockedPersist.mockResolvedValue({
      generation: 1,
      committedAt: Date.now(),
    });
    const first = scheduleAssetProjectionPersistence(input);
    await first?.promise;
    expect(scheduleAssetProjectionPersistence(input)).toBeUndefined();

    abortAll?.();
    const afterReset = scheduleAssetProjectionPersistence(input);
    expect(afterReset).toBeDefined();
    await afterReset?.promise;
    expect(mockedSubmit).toHaveBeenCalledTimes(2);
  });

  it('schedules changed ordering as a new low-priority generation', async () => {
    mockedPersist.mockResolvedValue({
      generation: 1,
      committedAt: Date.now(),
    });
    const first = scheduleAssetProjectionPersistence(input);
    await first?.promise;

    const changed = scheduleAssetProjectionPersistence({
      ...input,
      rows: [{ type: 'token', id: '0xabc:eth:other' }, ...input.rows],
    });
    await changed?.promise;

    expect(mockedSubmit).toHaveBeenLastCalledWith(
      expect.objectContaining({ priority: 'low' }),
    );
    expect(mockedPersist).toHaveBeenCalledTimes(2);
  });
});
