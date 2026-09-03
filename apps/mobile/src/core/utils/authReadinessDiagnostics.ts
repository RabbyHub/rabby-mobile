import type { UIAuthType } from '@/core/apis/lock';

import { isNonProductionDiagnosticsEnabled } from './diagnosticEnv';

export type AuthReadinessDiagnosticEventName =
  | 'wallet-setup-started'
  | 'wallet-password-reset-started'
  | 'wallet-password-reset-finished'
  | 'wallet-biometrics-toggle-started'
  | 'wallet-biometrics-toggle-finished'
  | 'wallet-keyring-imported'
  | 'wallet-lock-refresh-started'
  | 'wallet-lock-refresh-finished'
  | 'wallet-home-navigation-dispatched'
  | 'wallet-password-preference-persisted'
  | 'biometrics-fetch-skipped-inflight'
  | 'biometrics-fetch-started'
  | 'biometrics-reconciled'
  | 'biometrics-system-auth-resolved'
  | 'biometrics-fetch-finished'
  | 'biometrics-fetch-failed'
  | 'biometrics-setup-confirmed-from-cache'
  | 'biometrics-setup-refresh-started'
  | 'biometrics-setup-refresh-finished'
  | 'biometrics-setup-refresh-failed'
  | 'biometrics-unlock-readiness-started'
  | 'biometrics-unlock-readiness-finished'
  | 'biometrics-toggle-started'
  | 'biometrics-keychain-updated'
  | 'biometrics-keychain-verified'
  | 'biometrics-toggle-finished'
  | 'biometrics-toggle-failed'
  | 'lock-fetch-started'
  | 'lock-native-state-resolved'
  | 'lock-account-flags-resolved'
  | 'lock-store-committed'
  | 'lock-fetch-failed'
  | 'auth-modal-show-requested'
  | 'auth-modal-native-state-resolved'
  | 'auth-modal-lock-store-synchronized'
  | 'auth-modal-mounted'
  | 'auth-modal-state-changed'
  | 'auth-modal-confirmed';

export type AuthReadinessAnomaly =
  | 'password-state-not-ready'
  | 'sensitive-auth-resolved-to-none'
  | 'current-auth-type-not-available';

export type AuthReadinessDiagnosticData = Readonly<
  Record<string, boolean | number | string | null | readonly string[]>
>;

export type AuthReadinessDiagnosticEvent = {
  id: number;
  event: AuthReadinessDiagnosticEventName;
  occurredAt: number;
  elapsedMs: number;
  data: AuthReadinessDiagnosticData;
};

export type AuthReadinessDiagnosticsSnapshot = {
  enabled: boolean;
  startedAt: number;
  updatedAt: number;
  anomalyCount: number;
  events: readonly AuthReadinessDiagnosticEvent[];
};

const MAX_EVENT_RECORDS = 160;
const enabled = isNonProductionDiagnosticsEnabled;
const startedAt = enabled ? Date.now() : 0;
const events = enabled ? ([] as AuthReadinessDiagnosticEvent[]) : null;

let nextEventId = 0;
let updatedAt = startedAt;

function cloneData(data: AuthReadinessDiagnosticData) {
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [
      key,
      Array.isArray(value) ? [...value] : value,
    ]),
  ) as AuthReadinessDiagnosticData;
}

export function classifyAuthReadinessState(input: {
  requestedAuthTypes: readonly UIAuthType[];
  availableAuthTypes: readonly UIAuthType[];
  currentAuthType: UIAuthType;
  pwdStatus: 'unknown' | 'built-in' | 'custom';
}) {
  const anomalies: AuthReadinessAnomaly[] = [];
  const requestsSensitiveAuth = input.requestedAuthTypes.some(type =>
    ['password', 'biometrics'].includes(type),
  );

  if (input.pwdStatus === 'unknown') {
    anomalies.push('password-state-not-ready');
  }
  if (requestsSensitiveAuth && input.currentAuthType === 'none') {
    anomalies.push('sensitive-auth-resolved-to-none');
  }
  if (!input.availableAuthTypes.includes(input.currentAuthType)) {
    anomalies.push('current-auth-type-not-available');
  }

  return anomalies;
}

export function recordAuthReadinessDiagnostic(
  event: AuthReadinessDiagnosticEventName,
  data: AuthReadinessDiagnosticData = {},
) {
  if (!events) {
    return 0;
  }

  const occurredAt = Date.now();
  const record: AuthReadinessDiagnosticEvent = {
    id: ++nextEventId,
    event,
    occurredAt,
    elapsedMs: occurredAt - startedAt,
    data: cloneData(data),
  };
  events.push(record);
  if (events.length > MAX_EVENT_RECORDS) {
    events.splice(0, events.length - MAX_EVENT_RECORDS);
  }
  updatedAt = occurredAt;
  return record.id;
}

export function getAuthReadinessDiagnosticsSnapshot(options?: {
  eventLimit?: number;
}): AuthReadinessDiagnosticsSnapshot {
  if (!events) {
    return {
      enabled: false,
      startedAt: 0,
      updatedAt: 0,
      anomalyCount: 0,
      events: [],
    };
  }

  const eventLimit = Math.min(
    Math.max(Math.round(options?.eventLimit || MAX_EVENT_RECORDS), 1),
    MAX_EVENT_RECORDS,
  );
  const selectedEvents = events.slice(-eventLimit);

  return {
    enabled: true,
    startedAt,
    updatedAt,
    anomalyCount: selectedEvents.filter(record => {
      const anomalies = record.data.anomalies;
      return Array.isArray(anomalies) && anomalies.length > 0;
    }).length,
    events: selectedEvents.map(record => ({
      ...record,
      data: cloneData(record.data),
    })),
  };
}

export function clearAuthReadinessDiagnostics() {
  if (!events) {
    return;
  }
  events.splice(0);
  updatedAt = Date.now();
}
