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
  | 'token-native-sql-projection'
  | 'multi-address-protocol'
  | 'multi-address-nft'
  | 'asset-projection-token-restore'
  | 'asset-projection-token-entity-background-restore'
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

export type AssetDataLoadSettlementState = {
  domain: AssetDataLoadDiagnosticDomain;
  requestIds: number[];
  terminalRequestIds: number[];
  pendingRequestIds: number[];
  failedRequestIds: number[];
  phase: 'completed' | 'failed' | null;
  elapsedMs: number | null;
  paths: string[];
};

// High-cardinality probes intentionally keep several address-scoped asset
// requests in flight. Retain enough non-production history to observe each
// request's terminal state instead of evicting its start marker mid-run.
const MAX_RECORDS = 4096;
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

export function summarizeAssetDataLoadSettlements(
  sourceRecords: readonly AssetDataLoadDiagnosticRecord[],
  cursor: number,
  expectedDomains: readonly AssetDataLoadDiagnosticDomain[],
): AssetDataLoadSettlementState[] {
  const expectedDomainSet = new Set(expectedDomains);
  const observedRequestIds = new Map<
    AssetDataLoadDiagnosticDomain,
    Set<number>
  >();
  const terminalRecords = new Map<number, AssetDataLoadDiagnosticRecord>();

  for (const record of sourceRecords) {
    if (record.phase === 'completed' || record.phase === 'failed') {
      terminalRecords.set(record.requestId, record);
    }
    if (record.id <= cursor || !expectedDomainSet.has(record.domain)) {
      continue;
    }
    const requestIds = observedRequestIds.get(record.domain) || new Set();
    requestIds.add(record.requestId);
    observedRequestIds.set(record.domain, requestIds);
  }

  return expectedDomains.map(domain => {
    const requestIds = Array.from(observedRequestIds.get(domain) || []).sort(
      (left, right) => left - right,
    );
    const terminalRequestIds: number[] = [];
    const pendingRequestIds: number[] = [];
    const failedRequestIds: number[] = [];
    const paths = new Set<string>();
    let elapsedMs: number | null = null;

    for (const requestId of requestIds) {
      const terminal = terminalRecords.get(requestId);
      if (!terminal || terminal.domain !== domain) {
        pendingRequestIds.push(requestId);
        continue;
      }
      terminalRequestIds.push(requestId);
      if (terminal.phase === 'failed') {
        failedRequestIds.push(requestId);
      }
      elapsedMs = Math.max(elapsedMs || 0, terminal.elapsedMs);
      const path = terminal.details?.path;
      if (typeof path === 'string') {
        paths.add(path);
      }
    }

    return {
      domain,
      requestIds,
      terminalRequestIds,
      pendingRequestIds,
      failedRequestIds,
      phase:
        requestIds.length === 0 || pendingRequestIds.length > 0
          ? null
          : failedRequestIds.length > 0
          ? 'failed'
          : 'completed',
      elapsedMs,
      paths: Array.from(paths).sort(),
    };
  });
}
