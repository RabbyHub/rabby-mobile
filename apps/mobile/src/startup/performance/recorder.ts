import { isNonProductionDiagnosticsEnabled } from '@/core/utils/diagnosticEnv';

export const STARTUP_PERFORMANCE_SCHEMA_VERSION = 1;
export const STARTUP_PERFORMANCE_HEARTBEAT_MS = 50;
export const STARTUP_PERFORMANCE_STALL_WARN_MS = 120;

const MAX_PENDING_EVENTS = 2048;
const MAX_ACTIVE_TASK_LABELS_PER_STALL = 8;

type PerformanceLike = {
  now?: () => number;
};

export type StartupPerformanceEventData = Record<string, unknown>;

export type StartupPerformanceEvent = {
  schemaVersion: number;
  sequence: number;
  wallTimeMs: number;
  elapsedMs: number;
  scope: string;
  event: string;
  data: StartupPerformanceEventData;
};

export type StartupPerformanceEventBatch = {
  schemaVersion: number;
  sessionId: string;
  sessionStartedAt: number;
  chunkSequence: number;
  droppedEventCount: number;
  events: StartupPerformanceEvent[];
};

export type StartupPerformanceStallEvent = {
  gapMs: number;
  stallMs: number;
  elapsedMs: number;
  activeTaskLabels: string[];
};

export type StartupPerformanceRecorderSnapshot = {
  enabled: boolean;
  started: boolean;
  stopped: boolean;
  sessionId: string;
  pendingEventCount: number;
  droppedEventCount: number;
  activeTaskLabels: string[];
};

const enabled = isNonProductionDiagnosticsEnabled;
const sessionStartedAt = Date.now();
const sessionId = `${sessionStartedAt.toString(36)}-${Math.random()
  .toString(36)
  .slice(2, 10)}`;
const pendingEvents: StartupPerformanceEvent[] = [];
const activeTasks = new Map<string, string>();
const stallListeners = new Set<(event: StartupPerformanceStallEvent) => void>();

let sequence = 0;
let chunkSequence = 0;
let droppedEventCount = 0;
let started = false;
let stopped = false;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let lastHeartbeatAt = 0;

function rawNow() {
  const performanceApi = (globalThis as { performance?: PerformanceLike })
    .performance;

  return typeof performanceApi?.now === 'function'
    ? performanceApi.now()
    : Date.now();
}

const sessionMonotonicStartedAt = rawNow();

function now() {
  return rawNow() - sessionMonotonicStartedAt;
}

function getTaskKey(data: StartupPerformanceEventData) {
  const id = data.id;

  return typeof id === 'number' || typeof id === 'string' ? String(id) : '';
}

function updateActiveTasks(
  scope: string,
  event: string,
  data: StartupPerformanceEventData,
) {
  if (scope !== 'startup-task') {
    return;
  }

  const taskKey = getTaskKey(data);
  if (!taskKey) {
    return;
  }

  if (event === 'task_fire') {
    activeTasks.set(
      taskKey,
      typeof data.label === 'string' ? data.label : `task#${taskKey}`,
    );
    return;
  }

  if (
    event === 'task_done' ||
    event === 'task_error' ||
    event === 'task_cancel'
  ) {
    activeTasks.delete(taskKey);
  }
}

export function recordStartupPerformanceEvent(
  scope: string,
  event: string,
  data: StartupPerformanceEventData = {},
) {
  if (!enabled || stopped) {
    return;
  }

  updateActiveTasks(scope, event, data);

  if (pendingEvents.length >= MAX_PENDING_EVENTS) {
    droppedEventCount += 1;
    return;
  }

  pendingEvents.push({
    schemaVersion: STARTUP_PERFORMANCE_SCHEMA_VERSION,
    sequence: ++sequence,
    wallTimeMs: Date.now(),
    elapsedMs: now(),
    scope,
    event,
    data: { ...data },
  });
}

function notifyStallListeners(event: StartupPerformanceStallEvent) {
  stallListeners.forEach(listener => {
    try {
      listener(event);
    } catch {
      // Performance diagnostics must never affect startup behavior.
    }
  });
}

function heartbeat() {
  const current = now();
  const gapMs = current - lastHeartbeatAt;
  lastHeartbeatAt = current;

  if (gapMs < STARTUP_PERFORMANCE_STALL_WARN_MS) {
    return;
  }

  const stallEvent: StartupPerformanceStallEvent = {
    gapMs,
    stallMs: Math.max(0, gapMs - STARTUP_PERFORMANCE_HEARTBEAT_MS),
    elapsedMs: current,
    activeTaskLabels: [...activeTasks.values()].slice(
      0,
      MAX_ACTIVE_TASK_LABELS_PER_STALL,
    ),
  };

  recordStartupPerformanceEvent('js', 'event_loop_stall', {
    ...stallEvent,
  });
  notifyStallListeners(stallEvent);
}

export function startStartupPerformanceRecording(reason = 'unknown') {
  if (!enabled || started || stopped) {
    return;
  }

  started = true;
  lastHeartbeatAt = now();
  recordStartupPerformanceEvent('session', 'start', {
    reason,
    sessionId,
    sessionStartedAt,
    heartbeatMs: STARTUP_PERFORMANCE_HEARTBEAT_MS,
    stallWarnMs: STARTUP_PERFORMANCE_STALL_WARN_MS,
  });
  heartbeatTimer = setInterval(heartbeat, STARTUP_PERFORMANCE_HEARTBEAT_MS);
}

export function stopStartupPerformanceRecording(reason = 'unknown') {
  if (!enabled || stopped) {
    return;
  }

  recordStartupPerformanceEvent('session', 'stop', {
    reason,
    pendingEventCount: pendingEvents.length,
    droppedEventCount,
  });
  stopped = true;
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

export function subscribeStartupPerformanceStalls(
  listener: (event: StartupPerformanceStallEvent) => void,
) {
  if (!enabled) {
    return () => undefined;
  }

  stallListeners.add(listener);
  return () => {
    stallListeners.delete(listener);
  };
}

export function takeStartupPerformanceEventBatch(): StartupPerformanceEventBatch | null {
  if (!enabled || pendingEvents.length === 0) {
    return null;
  }

  const events = pendingEvents.splice(0);
  const batchDroppedEventCount = droppedEventCount;
  droppedEventCount = 0;

  return {
    schemaVersion: STARTUP_PERFORMANCE_SCHEMA_VERSION,
    sessionId,
    sessionStartedAt,
    chunkSequence: chunkSequence++,
    droppedEventCount: batchDroppedEventCount,
    events,
  };
}

export function restoreStartupPerformanceEventBatch(
  batch: StartupPerformanceEventBatch,
) {
  if (!enabled || batch.events.length === 0) {
    return;
  }

  const availableSlots = Math.max(0, MAX_PENDING_EVENTS - pendingEvents.length);
  const restoredEvents = batch.events.slice(-availableSlots);
  const droppedRestoredEvents = batch.events.length - restoredEvents.length;

  pendingEvents.unshift(...restoredEvents);
  droppedEventCount += batch.droppedEventCount + droppedRestoredEvents;
}

export function getStartupPerformanceRecorderSnapshot(): StartupPerformanceRecorderSnapshot {
  return {
    enabled,
    started,
    stopped,
    sessionId,
    pendingEventCount: pendingEvents.length,
    droppedEventCount,
    activeTaskLabels: [...activeTasks.values()],
  };
}

export function isStartupPerformanceRecordingEnabled() {
  return enabled;
}
