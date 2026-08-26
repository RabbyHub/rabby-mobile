import { isNonProductionDiagnosticsEnabled } from './diagnosticEnv';

export type AssetDataLoadDiagnosticDomain =
  | 'home-manual-refresh'
  | 'home-balance-refresh'
  | 'single-address-token'
  | 'single-address-nft'
  | 'single-address-warmup'
  | 'multi-address-token'
  | 'multi-address-token-projection'
  | 'token-runtime-sync'
  | 'multi-address-protocol'
  | 'multi-address-nft'
  | 'token-cache-hydrate'
  | 'asset-projection-token-restore'
  | 'asset-projection-token-segment-hydrate'
  | 'asset-projection-protocol-restore'
  | 'asset-projection-nft-restore';

type AssetDataLoadDiagnosticValue = string | number | boolean | null;

export type AssetDataLoadDiagnosticRecord = {
  id: number;
  requestId: number;
  domain: AssetDataLoadDiagnosticDomain;
  address: string;
  phase: string;
  timestamp: number;
  elapsedMs: number;
  deltaMs: number;
  details?: Readonly<Record<string, AssetDataLoadDiagnosticValue>>;
};

export type AssetDataLoadTraceDetails = Readonly<
  Record<string, AssetDataLoadDiagnosticValue | undefined>
>;

export type AssetDataLoadDiagnosticTrace = {
  mark: (phase: string, details?: AssetDataLoadTraceDetails) => void;
  finish: (details?: AssetDataLoadTraceDetails) => void;
  fail: (details?: AssetDataLoadTraceDetails) => void;
};

// High-cardinality refreshes fan out across several resource domains. Keep
// enough non-production history to retain the dispatch phases that precede
// their remote completions.
const MAX_RECORDS = 512;
const records = isNonProductionDiagnosticsEnabled
  ? ([] as AssetDataLoadDiagnosticRecord[])
  : null;
let nextRecordId = 0;
let nextRequestId = 0;

const normalizeDetails = (details?: AssetDataLoadTraceDetails) => {
  if (!details) {
    return undefined;
  }

  const entries = Object.entries(details).filter(
    (entry): entry is [string, AssetDataLoadDiagnosticValue] =>
      entry[1] !== undefined,
  );
  return entries.length ? Object.fromEntries(entries) : undefined;
};

export function beginAssetDataLoadDiagnostic(
  domain: AssetDataLoadDiagnosticDomain,
  address: string,
  details?: AssetDataLoadTraceDetails,
): AssetDataLoadDiagnosticTrace {
  if (!records) {
    return {
      mark: (_phase: string, _details?: AssetDataLoadTraceDetails) => {},
      finish: (_details?: AssetDataLoadTraceDetails) => {},
      fail: (_details?: AssetDataLoadTraceDetails) => {},
    };
  }

  const requestId = ++nextRequestId;
  const startedAt = Date.now();
  let previousAt = startedAt;
  let settled = false;

  const append = (phase: string, phaseDetails?: AssetDataLoadTraceDetails) => {
    const timestamp = Date.now();
    records.push({
      id: ++nextRecordId,
      requestId,
      domain,
      address: address.toLowerCase(),
      phase,
      timestamp,
      elapsedMs: timestamp - startedAt,
      deltaMs: timestamp - previousAt,
      details: normalizeDetails(phaseDetails),
    });
    previousAt = timestamp;
    if (records.length > MAX_RECORDS) {
      records.splice(0, records.length - MAX_RECORDS);
    }
  };

  append('started', details);

  const settle = (
    phase: 'completed' | 'failed',
    phaseDetails?: AssetDataLoadTraceDetails,
  ) => {
    if (settled) {
      return;
    }
    settled = true;
    append(phase, phaseDetails);
  };

  return {
    mark: append,
    finish: (phaseDetails?: AssetDataLoadTraceDetails) =>
      settle('completed', phaseDetails),
    fail: (phaseDetails?: AssetDataLoadTraceDetails) =>
      settle('failed', phaseDetails),
  };
}

export function getAssetDataLoadDiagnosticsSnapshot() {
  return {
    enabled: records !== null,
    records: records ? [...records] : [],
  };
}
