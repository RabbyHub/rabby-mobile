/* eslint-disable jsdoc/require-param */

export const ASSET_SYNC_WORKER_SCHEMA_VERSION = 2 as const;

export const ASSET_SYNC_KINDS = ['token', 'protocol', 'nft'] as const;

export type AssetSyncKind = (typeof ASSET_SYNC_KINDS)[number];
export type AssetSyncReplacementScope = 'address' | 'chains';
export type AssetSyncOutcome = 'complete' | 'partial' | 'failed' | 'cancelled';

export type AssetSyncWorkerBootstrap = {
  host: string;
  apiKey: string | null;
  apiTime: number | null;
  clientVersion: string;
};

export type TokenAssetSyncRequest = {
  schemaVersion: typeof ASSET_SYNC_WORKER_SCHEMA_VERSION;
  requestId: string;
  kind: 'token';
  addresses: string[];
  force: boolean;
  issuedAt: number;
  bootstrap: AssetSyncWorkerBootstrap;
};

export type AssetSyncCompletion = {
  schemaVersion: typeof ASSET_SYNC_WORKER_SCHEMA_VERSION;
  requestId: string;
  kind: AssetSyncKind;
  success: boolean;
  address: string;
  outcome: AssetSyncOutcome;
  generation: number;
  committedAt: number;
  replacementScope: AssetSyncReplacementScope;
  chainIds: string[];
  failedChainIds: string[];
  committedRowCount: number;
  superseded: boolean;
  stage: string;
  errorCode: string;
};

export type TokenAddressSyncReceipt = AssetSyncCompletion & {
  kind: 'token';
};

export type TokenAssetSyncReceipt = {
  schemaVersion: typeof ASSET_SYNC_WORKER_SCHEMA_VERSION;
  requestId: string;
  kind: 'token';
  outcome: AssetSyncOutcome;
  startedAt: number;
  finishedAt: number;
  addresses: TokenAddressSyncReceipt[];
};

const asRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('asset_sync_completion_invalid');
  }
  return value as Record<string, unknown>;
};

const readString = (
  record: Record<string, unknown>,
  key: string,
  allowEmpty = false,
) => {
  const value = record[key];
  if (typeof value !== 'string' || (!allowEmpty && !value)) {
    throw new Error(`asset_sync_completion_${key}_invalid`);
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
    throw new Error(`asset_sync_completion_${key}_invalid`);
  }
  return value;
};

const readStringArray = (record: Record<string, unknown>, key: string) => {
  const value = record[key];
  if (
    !Array.isArray(value) ||
    value.some(item => typeof item !== 'string' || !item)
  ) {
    throw new Error(`asset_sync_completion_${key}_invalid`);
  }
  return Array.from(new Set(value));
};

/** Validate and freeze one untrusted asset-sync completion message. */
export function normalizeAssetSyncCompletion(
  value: unknown,
): AssetSyncCompletion {
  const record = asRecord(value);
  if (record.schemaVersion !== ASSET_SYNC_WORKER_SCHEMA_VERSION) {
    throw new Error('asset_sync_completion_schema_mismatch');
  }
  if (!ASSET_SYNC_KINDS.includes(record.kind as AssetSyncKind)) {
    throw new Error('asset_sync_completion_kind_invalid');
  }
  if (
    record.outcome !== 'complete' &&
    record.outcome !== 'partial' &&
    record.outcome !== 'failed' &&
    record.outcome !== 'cancelled'
  ) {
    throw new Error('asset_sync_completion_outcome_invalid');
  }
  if (typeof record.success !== 'boolean') {
    throw new Error('asset_sync_completion_success_invalid');
  }
  const shouldSucceed =
    record.outcome === 'complete' || record.outcome === 'partial';
  if (record.success !== shouldSucceed) {
    throw new Error('asset_sync_completion_success_inconsistent');
  }
  if (
    record.replacementScope !== 'address' &&
    record.replacementScope !== 'chains'
  ) {
    throw new Error('asset_sync_completion_scope_invalid');
  }

  const chainIds = readStringArray(record, 'chainIds');
  const failedChainIds = readStringArray(record, 'failedChainIds');
  if (chainIds.some(chainId => failedChainIds.includes(chainId))) {
    throw new Error('asset_sync_completion_chain_overlap');
  }
  if (
    record.outcome === 'partial' &&
    (record.kind !== 'token' ||
      record.replacementScope !== 'chains' ||
      chainIds.length === 0 ||
      failedChainIds.length === 0)
  ) {
    throw new Error('asset_sync_completion_partial_invalid');
  }
  if (record.outcome === 'complete' && record.replacementScope !== 'address') {
    throw new Error('asset_sync_completion_complete_scope_invalid');
  }
  if (
    record.kind !== 'token' &&
    (record.replacementScope !== 'address' ||
      chainIds.length > 0 ||
      failedChainIds.length > 0 ||
      record.outcome === 'partial')
  ) {
    throw new Error('asset_sync_completion_non_token_scope_invalid');
  }

  const committedAt = readInteger(record, 'committedAt');
  if (record.success && committedAt === 0) {
    throw new Error('asset_sync_completion_commit_missing');
  }
  if (typeof record.superseded !== 'boolean') {
    throw new Error('asset_sync_completion_superseded_invalid');
  }

  return Object.freeze({
    schemaVersion: ASSET_SYNC_WORKER_SCHEMA_VERSION,
    requestId: readString(record, 'requestId'),
    kind: record.kind as AssetSyncKind,
    success: record.success,
    address: readString(record, 'address').toLowerCase(),
    outcome: record.outcome,
    generation: readInteger(record, 'generation', 1),
    committedAt,
    replacementScope: record.replacementScope,
    chainIds,
    failedChainIds,
    committedRowCount: readInteger(record, 'committedRowCount'),
    superseded: record.superseded,
    stage: readString(record, 'stage'),
    errorCode: readString(record, 'errorCode', true),
  });
}

/** Validate the versioned token-sync request at the worker boundary. */
export function assertTokenAssetSyncRequest(
  value: TokenAssetSyncRequest,
): void {
  if (value.schemaVersion !== ASSET_SYNC_WORKER_SCHEMA_VERSION) {
    throw new Error('asset_sync_schema_mismatch');
  }
  if (!value.requestId || value.kind !== 'token') {
    throw new Error('asset_sync_request_invalid');
  }
  if (!Array.isArray(value.addresses) || value.addresses.length === 0) {
    throw new Error('asset_sync_addresses_empty');
  }
  if (!value.bootstrap?.host || !value.bootstrap.clientVersion) {
    throw new Error('asset_sync_bootstrap_invalid');
  }
  if (!Number.isFinite(value.issuedAt) || value.issuedAt <= 0) {
    throw new Error('asset_sync_generation_invalid');
  }
}
