/* eslint-disable jsdoc/require-param, jsdoc/require-returns */

import {
  TOKEN_CACHE_COLUMNS,
  type TokenCacheRow,
  type TokenCacheScalar,
} from './tokenRows';

export const ASSET_SYNC_PERSISTENCE_QUEUE_SCHEMA_VERSION = 1 as const;
export const ASSET_SYNC_PERSISTENCE_QUEUE_STORAGE_ID =
  'mmkv.assetSyncPersistenceQueue.v1';
export const ASSET_SYNC_PERSISTENCE_TASK_KEY_PREFIX =
  'asset-sync/persistence/v1/task/';
export const ASSET_SYNC_PERSISTENCE_QUARANTINE_KEY_PREFIX =
  'asset-sync/persistence/v1/quarantine/';

export const MAX_ASSET_SYNC_PERSISTENCE_TASKS = 128;
export const MAX_ASSET_SYNC_TOKEN_ROWS_PER_TASK = 25_000;
export const MAX_ASSET_SYNC_PERSISTENCE_TASK_JSON_LENGTH = 16 * 1024 * 1024;

const TASK_ID_PATTERN = /^[a-zA-Z0-9:._-]{1,240}$/u;
const ADDRESS_PATTERN = /^0x[a-f0-9]{40}$/u;
const MAX_CHAIN_ID_LENGTH = 128;
const MAX_CHAIN_IDS = 512;
const MAX_SCALAR_STRING_LENGTH = 512 * 1024;

export type TokenSnapshotPersistenceTask = {
  schemaVersion: typeof ASSET_SYNC_PERSISTENCE_QUEUE_SCHEMA_VERSION;
  kind: 'token-snapshot';
  taskId: string;
  requestId: string;
  createdAt: number;
  address: string;
  generation: number;
  replacementScope: 'address' | 'chains';
  chainIds: string[];
  failedChainIds: string[];
  rows: TokenCacheRow[];
};

export type AssetSyncPersistenceTask = TokenSnapshotPersistenceTask;

export type AssetSyncPersistenceAck = {
  schemaVersion: typeof ASSET_SYNC_PERSISTENCE_QUEUE_SCHEMA_VERSION;
  taskId: string;
  status: 'committed' | 'rejected';
  rowCount: number;
  applied: boolean;
  committedAt: number;
  errorCode: string;
};

type CreateTokenSnapshotPersistenceTaskInput = Omit<
  TokenSnapshotPersistenceTask,
  'schemaVersion' | 'kind' | 'taskId' | 'createdAt'
> & {
  createdAt?: number;
};

const asRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('asset_sync_persistence_task_invalid');
  }
  return value as Record<string, unknown>;
};

const readString = (
  record: Record<string, unknown>,
  key: string,
  options: { allowEmpty?: boolean; maxLength?: number } = {},
) => {
  const value = record[key];
  if (
    typeof value !== 'string' ||
    (!options.allowEmpty && !value) ||
    value.length > (options.maxLength ?? 512)
  ) {
    throw new Error(`asset_sync_persistence_${key}_invalid`);
  }
  return value;
};

const readInteger = (
  record: Record<string, unknown>,
  key: string,
  minimum = 0,
) => {
  const value = record[key];
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < minimum
  ) {
    throw new Error(`asset_sync_persistence_${key}_invalid`);
  }
  return value;
};

const normalizeTaskId = (value: unknown) => {
  if (typeof value !== 'string' || !TASK_ID_PATTERN.test(value)) {
    throw new Error('asset_sync_persistence_task_id_invalid');
  }
  return value;
};

const normalizeAddress = (value: unknown) => {
  if (typeof value !== 'string') {
    throw new Error('asset_sync_persistence_address_invalid');
  }
  const address = value.toLowerCase();
  if (!ADDRESS_PATTERN.test(address)) {
    throw new Error('asset_sync_persistence_address_invalid');
  }
  return address;
};

const normalizeStringArray = (
  value: unknown,
  key: string,
  maximum = MAX_CHAIN_IDS,
) => {
  if (
    !Array.isArray(value) ||
    value.length > maximum ||
    value.some(
      item =>
        typeof item !== 'string' || !item || item.length > MAX_CHAIN_ID_LENGTH,
    )
  ) {
    throw new Error(`asset_sync_persistence_${key}_invalid`);
  }
  return Array.from(new Set(value));
};

const normalizeScalar = (value: unknown): TokenCacheScalar => {
  if (value === null || typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error('asset_sync_persistence_row_number_invalid');
    }
    return value;
  }
  if (typeof value === 'string') {
    if (value.length > MAX_SCALAR_STRING_LENGTH) {
      throw new Error('asset_sync_persistence_row_string_too_large');
    }
    return value;
  }
  throw new Error('asset_sync_persistence_row_scalar_invalid');
};

const normalizeTokenRows = (
  value: unknown,
  address: string,
  generation: number,
  replacementScope: 'address' | 'chains',
  chainIds: string[],
) => {
  if (
    !Array.isArray(value) ||
    value.length > MAX_ASSET_SYNC_TOKEN_ROWS_PER_TASK ||
    (replacementScope === 'address' && value.length === 0)
  ) {
    throw new Error('asset_sync_persistence_rows_invalid');
  }

  const chainIdSet = new Set(chainIds);
  return value.map(rawRow => {
    const record = asRecord(rawRow);
    if (
      Object.keys(record).length !== TOKEN_CACHE_COLUMNS.length ||
      TOKEN_CACHE_COLUMNS.some(column => !(column in record))
    ) {
      throw new Error('asset_sync_persistence_row_shape_invalid');
    }
    const row = Object.fromEntries(
      TOKEN_CACHE_COLUMNS.map(column => [
        column,
        normalizeScalar(record[column]),
      ]),
    ) as TokenCacheRow;
    if (
      row.owner_addr !== address ||
      row._local_updated_at !== generation ||
      row._local_created_at !== generation
    ) {
      throw new Error('asset_sync_persistence_row_scope_invalid');
    }
    if (replacementScope === 'chains' && !chainIdSet.has(String(row.chain))) {
      throw new Error('asset_sync_persistence_row_chain_invalid');
    }
    return Object.freeze(row);
  });
};

/** Build a deterministic id so retries address the same durable task. */
export function makeTokenSnapshotPersistenceTaskId(input: {
  requestId: string;
  address: string;
  generation: number;
}) {
  const requestId = readString({ requestId: input.requestId }, 'requestId', {
    maxLength: 140,
  });
  if (!/^[a-zA-Z0-9._-]+$/u.test(requestId)) {
    throw new Error('asset_sync_persistence_request_id_invalid');
  }
  const address = normalizeAddress(input.address);
  if (!Number.isSafeInteger(input.generation) || input.generation <= 0) {
    throw new Error('asset_sync_persistence_generation_invalid');
  }
  return `token:${requestId}:${address}:${input.generation}`;
}

/** Convert a validated task id into its durable MMKV key. */
export function getAssetSyncPersistenceTaskKey(taskId: string) {
  return `${ASSET_SYNC_PERSISTENCE_TASK_KEY_PREFIX}${normalizeTaskId(taskId)}`;
}

/** Read a validated task id from a durable MMKV key. */
export function getAssetSyncPersistenceTaskIdFromKey(key: string) {
  if (!key.startsWith(ASSET_SYNC_PERSISTENCE_TASK_KEY_PREFIX)) {
    return null;
  }
  try {
    return normalizeTaskId(
      key.slice(ASSET_SYNC_PERSISTENCE_TASK_KEY_PREFIX.length),
    );
  } catch {
    return null;
  }
}

/** Validate and freeze one untrusted durable persistence task. */
export function normalizeAssetSyncPersistenceTask(
  value: unknown,
): AssetSyncPersistenceTask {
  const record = asRecord(value);
  if (record.schemaVersion !== ASSET_SYNC_PERSISTENCE_QUEUE_SCHEMA_VERSION) {
    throw new Error('asset_sync_persistence_schema_mismatch');
  }
  if (record.kind !== 'token-snapshot') {
    throw new Error('asset_sync_persistence_kind_invalid');
  }
  const taskId = normalizeTaskId(record.taskId);
  const requestId = readString(record, 'requestId', { maxLength: 140 });
  const address = normalizeAddress(record.address);
  const generation = readInteger(record, 'generation', 1);
  const createdAt = readInteger(record, 'createdAt', 1);
  if (
    record.replacementScope !== 'address' &&
    record.replacementScope !== 'chains'
  ) {
    throw new Error('asset_sync_persistence_scope_invalid');
  }
  const { replacementScope } = record;
  const chainIds = normalizeStringArray(record.chainIds, 'chain_ids');
  const failedChainIds = normalizeStringArray(
    record.failedChainIds,
    'failed_chain_ids',
  );
  if (chainIds.some(chainId => failedChainIds.includes(chainId))) {
    throw new Error('asset_sync_persistence_chain_overlap');
  }
  if (
    (replacementScope === 'address' && failedChainIds.length > 0) ||
    (replacementScope === 'chains' &&
      (chainIds.length === 0 || failedChainIds.length === 0))
  ) {
    throw new Error('asset_sync_persistence_scope_inconsistent');
  }
  if (
    taskId !==
    makeTokenSnapshotPersistenceTaskId({
      requestId,
      address,
      generation,
    })
  ) {
    throw new Error('asset_sync_persistence_task_identity_mismatch');
  }
  const rows = normalizeTokenRows(
    record.rows,
    address,
    generation,
    replacementScope,
    chainIds,
  );

  return Object.freeze({
    schemaVersion: ASSET_SYNC_PERSISTENCE_QUEUE_SCHEMA_VERSION,
    kind: 'token-snapshot',
    taskId,
    requestId,
    createdAt,
    address,
    generation,
    replacementScope,
    chainIds: Object.freeze(chainIds.slice()) as unknown as string[],
    failedChainIds: Object.freeze(
      failedChainIds.slice(),
    ) as unknown as string[],
    rows: Object.freeze(rows.slice()) as unknown as TokenCacheRow[],
  });
}

/** Build one validated token snapshot persistence task. */
export function createTokenSnapshotPersistenceTask(
  input: CreateTokenSnapshotPersistenceTaskInput,
) {
  return normalizeAssetSyncPersistenceTask({
    ...input,
    schemaVersion: ASSET_SYNC_PERSISTENCE_QUEUE_SCHEMA_VERSION,
    kind: 'token-snapshot',
    taskId: makeTokenSnapshotPersistenceTaskId(input),
    createdAt: input.createdAt ?? Date.now(),
  });
}

/** Serialize one validated persistence task for MMKV. */
export function serializeAssetSyncPersistenceTask(value: unknown) {
  const task = normalizeAssetSyncPersistenceTask(value);
  const serialized = JSON.stringify(task);
  if (serialized.length > MAX_ASSET_SYNC_PERSISTENCE_TASK_JSON_LENGTH) {
    throw new Error('asset_sync_persistence_task_too_large');
  }
  return serialized;
}

/** Parse and validate one persistence task read from MMKV. */
export function parseAssetSyncPersistenceTask(serialized: string) {
  if (
    !serialized ||
    serialized.length > MAX_ASSET_SYNC_PERSISTENCE_TASK_JSON_LENGTH
  ) {
    throw new Error('asset_sync_persistence_task_size_invalid');
  }
  return normalizeAssetSyncPersistenceTask(JSON.parse(serialized));
}

/** Validate one acknowledgement received from the main Runtime. */
export function normalizeAssetSyncPersistenceAck(
  value: unknown,
): AssetSyncPersistenceAck {
  const record = asRecord(value);
  if (record.schemaVersion !== ASSET_SYNC_PERSISTENCE_QUEUE_SCHEMA_VERSION) {
    throw new Error('asset_sync_persistence_ack_schema_mismatch');
  }
  if (record.status !== 'committed' && record.status !== 'rejected') {
    throw new Error('asset_sync_persistence_ack_status_invalid');
  }
  if (typeof record.applied !== 'boolean') {
    throw new Error('asset_sync_persistence_ack_applied_invalid');
  }
  const committedAt = readInteger(record, 'committedAt');
  if (record.status === 'committed' && committedAt === 0) {
    throw new Error('asset_sync_persistence_ack_commit_missing');
  }
  return Object.freeze({
    schemaVersion: ASSET_SYNC_PERSISTENCE_QUEUE_SCHEMA_VERSION,
    taskId: normalizeTaskId(record.taskId),
    status: record.status,
    rowCount: readInteger(record, 'rowCount'),
    applied: record.applied,
    committedAt,
    errorCode: readString(record, 'errorCode', {
      allowEmpty: true,
      maxLength: 160,
    }),
  });
}
