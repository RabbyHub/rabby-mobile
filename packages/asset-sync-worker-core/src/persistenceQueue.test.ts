import {
  ASSET_SYNC_PERSISTENCE_QUEUE_SCHEMA_VERSION,
  createTokenSnapshotPersistenceTask,
  getAssetSyncPersistenceTaskIdFromKey,
  getAssetSyncPersistenceTaskKey,
  normalizeAssetSyncPersistenceAck,
  parseAssetSyncPersistenceTask,
  serializeAssetSyncPersistenceTask,
} from './persistenceQueue';
import { makeTokenCacheRows } from './tokenRows';

const ADDRESS = `0x${'a'.repeat(40)}`;
const GENERATION = 123;

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

describe('asset sync persistence queue protocol', () => {
  it('round-trips one complete token snapshot deterministically', () => {
    const task = makeTask();
    const serialized = serializeAssetSyncPersistenceTask(task);

    expect(serializeAssetSyncPersistenceTask(task)).toBe(serialized);
    expect(parseAssetSyncPersistenceTask(serialized)).toStrictEqual(task);
    expect(
      getAssetSyncPersistenceTaskIdFromKey(
        getAssetSyncPersistenceTaskKey(task.taskId),
      ),
    ).toBe(task.taskId);
  });

  it('accepts a partial chain snapshot with only successful-chain rows', () => {
    const task = createTokenSnapshotPersistenceTask({
      requestId: 'request-partial',
      createdAt: GENERATION,
      address: ADDRESS,
      generation: GENERATION,
      replacementScope: 'chains',
      chainIds: ['eth'],
      failedChainIds: ['arb'],
      rows: makeTokenCacheRows(
        ADDRESS,
        [{ id: 'eth', chain: 'eth', amount: 1, price: 2 }],
        GENERATION,
        { includeEmptySentinel: false },
      ),
    });

    expect(
      parseAssetSyncPersistenceTask(serializeAssetSyncPersistenceTask(task)),
    ).toMatchObject({
      replacementScope: 'chains',
      chainIds: ['eth'],
      failedChainIds: ['arb'],
    });
  });

  it('rejects unknown task schemas and kinds', () => {
    const task = makeTask();

    expect(() =>
      parseAssetSyncPersistenceTask(
        JSON.stringify({ ...task, schemaVersion: 2 }),
      ),
    ).toThrow('asset_sync_persistence_schema_mismatch');
    expect(() =>
      parseAssetSyncPersistenceTask(
        JSON.stringify({ ...task, kind: 'unknown' }),
      ),
    ).toThrow('asset_sync_persistence_kind_invalid');
  });

  it('rejects rows that escape the task owner or generation', () => {
    const task = makeTask();

    expect(() =>
      parseAssetSyncPersistenceTask(
        JSON.stringify({
          ...task,
          rows: task.rows.map(row => ({
            ...row,
            owner_addr: ADDRESS.replace(/a$/u, 'b'),
          })),
        }),
      ),
    ).toThrow('asset_sync_persistence_row_scope_invalid');
    expect(() =>
      parseAssetSyncPersistenceTask(
        JSON.stringify({
          ...task,
          rows: task.rows.map(row => ({
            ...row,
            _local_updated_at: GENERATION + 1,
          })),
        }),
      ),
    ).toThrow('asset_sync_persistence_row_scope_invalid');
  });

  it('normalizes only versioned committed or rejected acknowledgements', () => {
    const task = makeTask();

    expect(
      normalizeAssetSyncPersistenceAck({
        schemaVersion: ASSET_SYNC_PERSISTENCE_QUEUE_SCHEMA_VERSION,
        taskId: task.taskId,
        status: 'committed',
        rowCount: task.rows.length,
        applied: true,
        committedAt: task.generation,
        errorCode: '',
      }),
    ).toMatchObject({ status: 'committed', applied: true });
    expect(() =>
      normalizeAssetSyncPersistenceAck({
        schemaVersion: ASSET_SYNC_PERSISTENCE_QUEUE_SCHEMA_VERSION,
        taskId: task.taskId,
        status: 'committed',
        rowCount: task.rows.length,
        applied: true,
        committedAt: 0,
        errorCode: '',
      }),
    ).toThrow('asset_sync_persistence_ack_commit_missing');
  });
});
