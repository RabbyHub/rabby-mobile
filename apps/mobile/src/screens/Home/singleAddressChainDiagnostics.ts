import { isNonProductionDiagnosticsEnabled } from '@/core/utils/diagnosticEnv';

export type SingleAddressChainProjectionSource =
  | 'sync-address'
  | 'token-store'
  | 'protocol-store'
  | 'nft-store'
  | 'home-chain-stats';

export type SingleAddressChainProjectionRecord = {
  id: number;
  source: SingleAddressChainProjectionSource;
  addressCount: number;
  inputCount: number;
  changed: boolean;
  projectionMs: number;
  publishMs: number;
  totalMs: number;
};

const MAX_RECORDS = 32;
const records = isNonProductionDiagnosticsEnabled
  ? ([] as SingleAddressChainProjectionRecord[])
  : null;
let nextRecordId = 0;

export const nowForSingleAddressChainProjection = () =>
  globalThis.performance?.now?.() ?? Date.now();

export function recordSingleAddressChainProjection(
  record: Omit<SingleAddressChainProjectionRecord, 'id'>,
) {
  if (!records) {
    return;
  }

  records.push({
    id: ++nextRecordId,
    ...record,
  });
  if (records.length > MAX_RECORDS) {
    records.splice(0, records.length - MAX_RECORDS);
  }
}

export function getSingleAddressChainProjectionDiagnosticsSnapshot() {
  return {
    enabled: records !== null,
    records: records ? [...records] : [],
  };
}
