/* eslint-disable jsdoc/require-param */

export const ASSET_SYNC_WORKER_SCHEMA_VERSION = 1 as const;

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

export type TokenAddressSyncReceipt = {
  address: string;
  outcome: 'complete' | 'partial' | 'failed' | 'cancelled';
  chainIds: string[];
  failedChainIds: string[];
  committedRowCount: number;
  committedAt?: number;
  superseded?: boolean;
  errorCode?: string;
};

export type TokenAssetSyncReceipt = {
  schemaVersion: typeof ASSET_SYNC_WORKER_SCHEMA_VERSION;
  requestId: string;
  kind: 'token';
  outcome: 'complete' | 'partial' | 'failed' | 'cancelled';
  startedAt: number;
  finishedAt: number;
  addresses: TokenAddressSyncReceipt[];
};

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
