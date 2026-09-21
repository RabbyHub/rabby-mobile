import { isNonProductionDiagnosticsEnabled } from '@/core/utils/diagnosticEnv';
import { recordStartupPerformanceEvent } from '@/startup/performance/recorder';
import type { CoreServiceName } from '@/core/services/serviceRegistry';
import {
  getCoreServiceMethodSemantic,
  type ServiceMethodSemantic,
} from './serviceContractSemantics';

export const SERVICE_CALL_PENDING_WARN_MS = 800;

export type ServiceLifecycleStatus =
  | 'loader-registered'
  | 'requested'
  | 'loading'
  | 'registered'
  | 'ready'
  | 'rejected';

export type ServiceLifecycleEventRecord = {
  id: number;
  serviceName: string;
  status: ServiceLifecycleStatus;
  reason: string;
  route: string;
  occurredAt: number;
  durationMs: number;
  error: string;
};

export type ServiceCallStatus = 'pending' | 'resolved' | 'rejected';

export type ServiceCallRecord = {
  id: number;
  serviceName: string;
  method: string;
  semantic: ServiceMethodSemantic;
  status: ServiceCallStatus;
  route: string;
  requestedAt: number;
  endedAt: number;
  durationMs: number;
  slow: boolean;
  error: string;
};

export type ServiceRuntimeDiagnosticsSnapshot = {
  enabled: boolean;
  updatedAt: number;
  loadingServiceCount: number;
  pendingCallCount: number;
  slowPendingCallCount: number;
  rejectedCallCount: number;
  errorCount: number;
  serviceEvents: ServiceLifecycleEventRecord[];
  calls: ServiceCallRecord[];
};

type ServiceRuntimeContext = {
  route?: string;
};

const MAX_SERVICE_EVENTS = 64;
const MAX_CALL_RECORDS = 64;
const enabled = isNonProductionDiagnosticsEnabled;
const serviceEvents = enabled ? ([] as ServiceLifecycleEventRecord[]) : null;
const callRecords = enabled ? new Map<number, ServiceCallRecord>() : null;
const callWarningTimers = enabled
  ? new Map<number, ReturnType<typeof setTimeout>>()
  : null;
const activeServiceLoads = enabled ? new Set<string>() : null;
const listeners = enabled ? new Set<() => void>() : null;

let contextProvider: (() => ServiceRuntimeContext | undefined) | null = null;
let nextEventId = 0;
let nextCallId = 0;
let updatedAt = enabled ? Date.now() : 0;

function normalizeError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function readContext() {
  if (!contextProvider) {
    return {};
  }

  try {
    return contextProvider() || {};
  } catch {
    return {};
  }
}

function publish() {
  if (!listeners) {
    return;
  }

  updatedAt = Date.now();
  listeners.forEach(listener => {
    try {
      listener();
    } catch {
      // Diagnostics must never change service behavior.
    }
  });
}

function pruneServiceEvents() {
  if (serviceEvents && serviceEvents.length > MAX_SERVICE_EVENTS) {
    serviceEvents.splice(0, serviceEvents.length - MAX_SERVICE_EVENTS);
  }
}

function pruneCallRecords() {
  if (!callRecords || callRecords.size <= MAX_CALL_RECORDS) {
    return;
  }

  const removable = [...callRecords.values()]
    .filter(record => record.status !== 'pending')
    .sort((a, b) => a.id - b.id);

  while (callRecords.size > MAX_CALL_RECORDS && removable.length > 0) {
    const record = removable.shift();
    if (record) {
      callRecords.delete(record.id);
    }
  }
}

export function setServiceRuntimeDiagnosticsContextProvider(
  provider: (() => ServiceRuntimeContext | undefined) | null,
) {
  if (!enabled) {
    return () => undefined;
  }

  contextProvider = provider;
  return () => {
    if (contextProvider === provider) {
      contextProvider = null;
    }
  };
}

export function recordServiceLifecycleEvent(
  serviceName: string,
  status: ServiceLifecycleStatus,
  options: {
    reason?: string;
    durationMs?: number;
    error?: unknown;
  } = {},
) {
  if (!enabled || !serviceEvents || !activeServiceLoads) {
    return;
  }

  if (status === 'loading') {
    activeServiceLoads.add(serviceName);
  } else if (status === 'ready' || status === 'rejected') {
    activeServiceLoads.delete(serviceName);
  }

  const context = readContext();
  const record: ServiceLifecycleEventRecord = {
    id: ++nextEventId,
    serviceName,
    status,
    reason: options.reason || '',
    route: context.route || '',
    occurredAt: Date.now(),
    durationMs: options.durationMs || 0,
    error: options.error == null ? '' : normalizeError(options.error),
  };

  serviceEvents.push(record);
  recordStartupPerformanceEvent('service', status, {
    serviceName,
    reason: record.reason,
    route: record.route,
    durationMs: record.durationMs,
    error: record.error,
  });
  pruneServiceEvents();
  publish();
}

export function beginServiceContractCall(
  serviceName: CoreServiceName,
  method: string,
) {
  if (!enabled || !callRecords || !callWarningTimers) {
    return 0;
  }

  const context = readContext();
  const record: ServiceCallRecord = {
    id: ++nextCallId,
    serviceName,
    method,
    semantic: getCoreServiceMethodSemantic(serviceName, method),
    status: 'pending',
    route: context.route || '',
    requestedAt: Date.now(),
    endedAt: 0,
    durationMs: 0,
    slow: false,
    error: '',
  };

  callRecords.set(record.id, record);
  callWarningTimers.set(
    record.id,
    setTimeout(() => {
      callWarningTimers.delete(record.id);
      const current = callRecords.get(record.id);
      if (!current || current.status !== 'pending') {
        return;
      }

      current.slow = true;
      current.durationMs = Date.now() - current.requestedAt;
      recordStartupPerformanceEvent('service-call', 'pending', {
        serviceName: current.serviceName,
        method: current.method,
        semantic: current.semantic,
        route: current.route,
        durationMs: current.durationMs,
      });
      publish();
    }, SERVICE_CALL_PENDING_WARN_MS),
  );
  pruneCallRecords();
  publish();
  return record.id;
}

export function finishServiceContractCall(
  callId: number,
  status: Exclude<ServiceCallStatus, 'pending'>,
  error?: unknown,
) {
  if (!callId || !enabled || !callRecords || !callWarningTimers) {
    return;
  }

  const warningTimer = callWarningTimers.get(callId);
  if (warningTimer) {
    clearTimeout(warningTimer);
    callWarningTimers.delete(callId);
  }

  const record = callRecords.get(callId);
  if (!record || record.status !== 'pending') {
    return;
  }

  record.status = status;
  record.endedAt = Date.now();
  record.durationMs = record.endedAt - record.requestedAt;
  record.error = error == null ? '' : normalizeError(error);

  if (record.slow || status === 'rejected') {
    recordStartupPerformanceEvent('service-call', status, {
      serviceName: record.serviceName,
      method: record.method,
      semantic: record.semantic,
      route: record.route,
      durationMs: record.durationMs,
      error: record.error,
    });
  }

  pruneCallRecords();
  publish();
}

export function getServiceRuntimeDiagnosticsSnapshot(): ServiceRuntimeDiagnosticsSnapshot {
  if (!enabled || !serviceEvents || !callRecords || !activeServiceLoads) {
    return {
      enabled: false,
      updatedAt: 0,
      loadingServiceCount: 0,
      pendingCallCount: 0,
      slowPendingCallCount: 0,
      rejectedCallCount: 0,
      errorCount: 0,
      serviceEvents: [],
      calls: [],
    };
  }

  const calls = [...callRecords.values()].sort((a, b) => b.id - a.id);
  const recentEvents = [...serviceEvents].sort((a, b) => b.id - a.id);

  return {
    enabled: true,
    updatedAt,
    loadingServiceCount: activeServiceLoads.size,
    pendingCallCount: calls.filter(record => record.status === 'pending')
      .length,
    slowPendingCallCount: calls.filter(
      record => record.status === 'pending' && record.slow,
    ).length,
    rejectedCallCount: calls.filter(record => record.status === 'rejected')
      .length,
    errorCount: recentEvents.filter(record => record.status === 'rejected')
      .length,
    serviceEvents: recentEvents,
    calls,
  };
}

export function subscribeServiceRuntimeDiagnostics(listener: () => void) {
  if (!enabled || !listeners) {
    return () => undefined;
  }

  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
