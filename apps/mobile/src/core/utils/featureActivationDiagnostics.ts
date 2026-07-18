import { traceAndroidInstant } from './androidTrace';
import { isNonProductionDiagnosticsEnabled } from './diagnosticEnv';

export type FeatureActivationName =
  | 'swap'
  | 'bridge'
  | 'single-address'
  | 'gas-account';

export type FeatureActivationEventName =
  | 'requested'
  | 'context-ready'
  | 'state-prepared'
  | 'navigation-dispatched'
  | 'mounted'
  | 'visible'
  | 'interactive'
  | 'data-ready'
  | 'exited';

export type FeatureActivationEventRecord = {
  id: number;
  cycleId: number;
  visitNumber: number;
  feature: FeatureActivationName;
  event: FeatureActivationEventName;
  reason: string;
  detail: string;
  occurredAt: number;
  elapsedMs: number;
  stepMs: number;
};

export type FeatureActivationDiagnosticsSnapshot = {
  enabled: boolean;
  activeCount: number;
  events: FeatureActivationEventRecord[];
};

type MarkFeatureActivationOptions = {
  cycleId?: number;
  reason?: string;
  detail?: string;
};

type FeatureActivationCycle = {
  cycleId: number;
  visitNumber: number;
  feature: FeatureActivationName;
  startedAt: number;
  lastEventAt: number;
  events: Set<FeatureActivationEventName>;
  exited: boolean;
};

const MAX_EVENT_RECORDS = 64;
const MAX_CYCLE_RECORDS = 16;
const enabled = isNonProductionDiagnosticsEnabled;
const cycles = enabled ? new Map<number, FeatureActivationCycle>() : null;
const activeCycles = enabled ? new Map<FeatureActivationName, number>() : null;
const visitCounts = enabled ? new Map<FeatureActivationName, number>() : null;
const eventRecords = enabled ? ([] as FeatureActivationEventRecord[]) : null;
const listeners = enabled ? new Set<() => void>() : null;

let nextCycleId = 0;
let nextEventId = 0;

export const isFeatureActivationDiagnosticsEnabled = enabled;

function publish() {
  listeners?.forEach(listener => {
    try {
      listener();
    } catch {
      // Diagnostics must never affect feature behavior.
    }
  });
}

function pruneRecords() {
  if (eventRecords && eventRecords.length > MAX_EVENT_RECORDS) {
    eventRecords.splice(0, eventRecords.length - MAX_EVENT_RECORDS);
  }

  if (!cycles || cycles.size <= MAX_CYCLE_RECORDS) {
    return;
  }

  const removable = [...cycles.values()]
    .filter(cycle => cycle.exited)
    .sort((a, b) => a.cycleId - b.cycleId);

  while (cycles.size > MAX_CYCLE_RECORDS && removable.length > 0) {
    const cycle = removable.shift();
    if (cycle) {
      cycles.delete(cycle.cycleId);
    }
  }
}

function appendFeatureActivationEvent(
  cycle: FeatureActivationCycle,
  event: FeatureActivationEventName,
  options: MarkFeatureActivationOptions = {},
) {
  if (!eventRecords || cycle.exited || cycle.events.has(event)) {
    return cycle.cycleId;
  }

  const occurredAt = Date.now();
  const record: FeatureActivationEventRecord = {
    id: ++nextEventId,
    cycleId: cycle.cycleId,
    visitNumber: cycle.visitNumber,
    feature: cycle.feature,
    event,
    reason: options.reason || '',
    detail: options.detail || '',
    occurredAt,
    elapsedMs: occurredAt - cycle.startedAt,
    stepMs: occurredAt - cycle.lastEventAt,
  };

  cycle.events.add(event);
  cycle.lastEventAt = occurredAt;
  eventRecords.push(record);

  if (event === 'exited') {
    cycle.exited = true;
    if (activeCycles?.get(cycle.feature) === cycle.cycleId) {
      activeCycles.delete(cycle.feature);
    }
  }

  traceAndroidInstant(`feature_activation.${event}`, {
    feature: cycle.feature,
    cycleId: cycle.cycleId,
    visitNumber: cycle.visitNumber,
    elapsedMs: record.elapsedMs,
    stepMs: record.stepMs,
    reason: record.reason,
  });
  console.info(`[FeatureActivation] ${cycle.feature}: ${event}`, {
    cycleId: cycle.cycleId,
    visitNumber: cycle.visitNumber,
    elapsedMs: record.elapsedMs,
    stepMs: record.stepMs,
    reason: record.reason,
    detail: record.detail,
  });

  pruneRecords();
  publish();
  return cycle.cycleId;
}

export function beginFeatureActivation(
  feature: FeatureActivationName,
  reason = 'unknown',
) {
  if (!enabled || !cycles || !activeCycles || !visitCounts) {
    return 0;
  }

  const activeCycleId = activeCycles.get(feature);
  const activeCycle = activeCycleId ? cycles.get(activeCycleId) : undefined;
  if (activeCycle && !activeCycle.exited) {
    appendFeatureActivationEvent(activeCycle, 'exited', {
      reason: 'superseded_by_new_cycle',
    });
  }

  const visitNumber = (visitCounts.get(feature) || 0) + 1;
  const startedAt = Date.now();
  const cycle: FeatureActivationCycle = {
    cycleId: ++nextCycleId,
    visitNumber,
    feature,
    startedAt,
    lastEventAt: startedAt,
    events: new Set(),
    exited: false,
  };

  visitCounts.set(feature, visitNumber);
  cycles.set(cycle.cycleId, cycle);
  activeCycles.set(feature, cycle.cycleId);
  appendFeatureActivationEvent(cycle, 'requested', { reason });
  return cycle.cycleId;
}

export function ensureFeatureActivation(
  feature: FeatureActivationName,
  reason = 'implicit_feature_entry',
) {
  if (!enabled || !cycles || !activeCycles) {
    return 0;
  }

  const cycleId = activeCycles.get(feature);
  const cycle = cycleId ? cycles.get(cycleId) : undefined;
  if (cycle && !cycle.exited) {
    return cycle.cycleId;
  }

  return beginFeatureActivation(feature, reason);
}

export function markFeatureActivation(
  feature: FeatureActivationName,
  event: FeatureActivationEventName,
  options: MarkFeatureActivationOptions = {},
) {
  if (!enabled || !cycles || !activeCycles) {
    return 0;
  }

  const cycleId = options.cycleId || activeCycles.get(feature);
  const cycle = cycleId ? cycles.get(cycleId) : undefined;
  if (!cycle || cycle.feature !== feature) {
    return 0;
  }

  return appendFeatureActivationEvent(cycle, event, options);
}

export function getFeatureActivationDiagnosticsSnapshot(): FeatureActivationDiagnosticsSnapshot {
  if (!enabled || !eventRecords || !activeCycles) {
    return {
      enabled: false,
      activeCount: 0,
      events: [],
    };
  }

  return {
    enabled: true,
    activeCount: activeCycles.size,
    events: [...eventRecords].sort((a, b) => b.id - a.id),
  };
}

export function subscribeFeatureActivationDiagnostics(listener: () => void) {
  if (!enabled || !listeners) {
    return () => undefined;
  }

  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
