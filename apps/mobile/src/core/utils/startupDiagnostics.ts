import { Platform } from 'react-native';
import RNFS from '@rabby-wallet/react-native-fs';

import { isNonPublicProductionEnv } from '@/constant';
import { logger } from '@/utils/logger';
import {
  beginAndroidAsyncTrace,
  endAndroidAsyncTrace,
  nextAndroidTraceCookie,
  traceAndroidCounter,
  traceAndroidInstant,
} from './androidTrace';

type DiagnosticData = Record<string, unknown>;

type ActiveDbSyncTask = {
  id: number;
  traceCookie: number;
  startedAt: number;
  taskFor: string;
  entityName: string;
  totalRows: number;
  batchSize: number;
  totalBatches: number;
  requestedConcurrency: number;
  effectiveConcurrency: number;
  waitTaskDoneReturn: boolean;
  delayBetweenTasks: number;
  stage: string;
  stageDetail: string;
  completedBatches: number;
  paramsBuildMs: number;
  executeMs: number;
  batchDurationMs: number;
  status: 'running' | 'success' | 'error' | 'aborted';
  endedAt?: number;
};

type ActiveWarmupTask = {
  id: number;
  traceCookie: number;
  startedAt: number;
  name: string;
  detail?: DiagnosticData;
};

type UnlockCriticalWindow = {
  id: number;
  traceCookie: number;
  startedAt: number;
  reason: string;
  intervalId: ReturnType<typeof setInterval> | null;
  lastTickAt: number;
  maxGapMs: number;
  stallCount: number;
  loggedStallCount: number;
};

type DbActiveWindow = {
  id: number;
  traceCookie: number;
  startedAt: number;
  intervalId: ReturnType<typeof setInterval> | null;
  lastTickAt: number;
  maxGapMs: number;
  stallCount: number;
  loggedStallCount: number;
  peakActiveTaskCount: number;
  taskIds: number[];
};

export type DbSyncSummaryTask = Pick<
  ActiveDbSyncTask,
  | 'id'
  | 'taskFor'
  | 'entityName'
  | 'totalRows'
  | 'batchSize'
  | 'totalBatches'
  | 'completedBatches'
  | 'stage'
  | 'stageDetail'
  | 'paramsBuildMs'
  | 'executeMs'
  | 'batchDurationMs'
  | 'status'
  | 'startedAt'
  | 'endedAt'
>;

export type DbSyncWindowSummary = {
  id: number;
  startedAt: number;
  endedAt?: number;
  durationMs: number;
  taskCount: number;
  totalRows: number;
  totalBatches: number;
  completedBatches: number;
  paramsBuildMs: number;
  executeMs: number;
  batchDurationMs: number;
  maxGapMs: number;
  stallCount: number;
  peakActiveTaskCount: number;
  tasks: DbSyncSummaryTask[];
};

export type DbSyncSummarySnapshot = {
  enabled: boolean;
  updatedAt: number;
  activeWindow: DbSyncWindowSummary | null;
  lastWindow: DbSyncWindowSummary | null;
};

export type KeyringRuntimeConvergenceStatus =
  | 'idle'
  | 'waiting'
  | 'running'
  | 'success'
  | 'error'
  | 'canceled'
  | 'skipped';

export type KeyringRuntimeConvergenceRecord = {
  id: number;
  event: string;
  status: KeyringRuntimeConvergenceStatus;
  timestamp: number;
  generation?: number;
  reason?: string;
  elapsedMs?: number;
  error?: string;
};

export type KeyringRuntimeConvergenceSnapshot = {
  enabled: boolean;
  updatedAt: number;
  status: KeyringRuntimeConvergenceStatus;
  event: string;
  generation: number;
  reason: string;
  fallbackMs: number;
  scheduledAt: number;
  startedAt: number;
  endedAt: number;
  waitMs: number;
  elapsedMs: number;
  runtimeReady: boolean | null;
  runtimeRestoring: boolean | null;
  runtimeError: string | null;
  keyringCount: number | null;
  error: string;
  lastPerfEvent: string;
  lastPerfElapsedMs: number;
  records: KeyringRuntimeConvergenceRecord[];
};

const isAndroid = Platform.OS === 'android';
const enabled = isAndroid && isNonPublicProductionEnv;
const STALL_INTERVAL_MS = 50;
const STALL_WARN_MS = 120;
const STALL_LOG_MS = 250;
const MAX_STALL_LOGS_PER_WINDOW = 8;
const MAX_SNAPSHOT_TASKS = 5;
const MAX_KEYRING_CONVERGENCE_RECORDS = 5;

let dbTaskSeq = 0;
let warmupTaskSeq = 0;
let unlockWindowSeq = 0;
let dbActiveWindowSeq = 0;
let keyringRuntimeConvergenceRecordSeq = 0;

const activeDbSyncTasks = new Map<number, ActiveDbSyncTask>();
const activeWarmupTasks = new Map<number, ActiveWarmupTask>();
const dbSyncTaskSummaries = new Map<number, ActiveDbSyncTask>();
const dbSummaryListeners = new Set<() => void>();
const keyringRuntimeConvergenceListeners = new Set<() => void>();

const activeUnlockWindowRef: {
  current: UnlockCriticalWindow | null;
} = {
  current: null,
};

const activeDbWindowRef: {
  current: DbActiveWindow | null;
} = {
  current: null,
};

const diagnosticFilePath =
  isAndroid && RNFS.ExternalDirectoryPath
    ? `${
        RNFS.ExternalDirectoryPath
      }/rabby-startup-diagnostics-${Date.now()}.ndjson`
    : '';

const pendingDiagnosticLines: string[] = [];
let diagnosticFlushTimer: ReturnType<typeof setTimeout> | null = null;
let isFlushingDiagnosticLines = false;
let lastDbSummarySnapshot: DbSyncSummarySnapshot = {
  enabled,
  updatedAt: now(),
  activeWindow: null,
  lastWindow: null,
};
let lastKeyringRuntimeConvergenceSnapshot: KeyringRuntimeConvergenceSnapshot = {
  enabled,
  updatedAt: now(),
  status: 'idle',
  event: '',
  generation: 0,
  reason: '',
  fallbackMs: 0,
  scheduledAt: 0,
  startedAt: 0,
  endedAt: 0,
  waitMs: 0,
  elapsedMs: 0,
  runtimeReady: null,
  runtimeRestoring: null,
  runtimeError: null,
  keyringCount: null,
  error: '',
  lastPerfEvent: '',
  lastPerfElapsedMs: 0,
  records: [],
};
let dbSummaryPublishTimer: ReturnType<typeof setTimeout> | null = null;
let lastDbSummaryPublishAt = 0;

function now() {
  return Date.now();
}

function toDbSyncSummaryTask(task: ActiveDbSyncTask): DbSyncSummaryTask {
  const {
    id,
    taskFor,
    entityName,
    totalRows,
    batchSize,
    totalBatches,
    completedBatches,
    stage,
    stageDetail,
    paramsBuildMs,
    executeMs,
    batchDurationMs,
    status,
    startedAt,
    endedAt,
  } = task;

  return {
    id,
    taskFor,
    entityName,
    totalRows,
    batchSize,
    totalBatches,
    completedBatches,
    stage,
    stageDetail,
    paramsBuildMs,
    executeMs,
    batchDurationMs,
    status,
    startedAt,
    endedAt,
  };
}

function buildDbWindowSummary(
  window: DbActiveWindow,
  endedAt?: number,
): DbSyncWindowSummary {
  const currentTime = endedAt ?? now();
  const tasks = window.taskIds
    .map(id => dbSyncTaskSummaries.get(id))
    .filter((task): task is ActiveDbSyncTask => !!task)
    .map(toDbSyncSummaryTask);

  return {
    id: window.id,
    startedAt: window.startedAt,
    endedAt,
    durationMs: currentTime - window.startedAt,
    taskCount: tasks.length,
    totalRows: tasks.reduce((sum, task) => sum + task.totalRows, 0),
    totalBatches: tasks.reduce((sum, task) => sum + task.totalBatches, 0),
    completedBatches: tasks.reduce(
      (sum, task) => sum + task.completedBatches,
      0,
    ),
    paramsBuildMs: tasks.reduce((sum, task) => sum + task.paramsBuildMs, 0),
    executeMs: tasks.reduce((sum, task) => sum + task.executeMs, 0),
    batchDurationMs: tasks.reduce((sum, task) => sum + task.batchDurationMs, 0),
    maxGapMs: window.maxGapMs,
    stallCount: window.stallCount,
    peakActiveTaskCount: window.peakActiveTaskCount,
    tasks,
  };
}

function buildDbSummarySnapshot(): DbSyncSummarySnapshot {
  const activeWindow = activeDbWindowRef.current;

  return {
    enabled,
    updatedAt: now(),
    activeWindow: activeWindow ? buildDbWindowSummary(activeWindow) : null,
    lastWindow: lastDbSummarySnapshot.lastWindow,
  };
}

function formatDbTaskStageDetail(data: DiagnosticData) {
  const parts: string[] = [];
  const round = typeof data.round === 'number' ? data.round : null;
  const totalRound =
    typeof data.totalRound === 'number' ? data.totalRound : null;
  const count = typeof data.count === 'number' ? data.count : null;

  if (round !== null && totalRound !== null) {
    parts.push(`r${round + 1}/${totalRound}`);
  } else if (round !== null) {
    parts.push(`r${round + 1}`);
  }

  if (count !== null) {
    parts.push(`${count} rows`);
  }

  if (typeof data.priority === 'string') {
    parts.push(data.priority);
  }

  return parts.join(' ');
}

function publishDbSummarySnapshot(immediate = false) {
  if (!enabled) {
    return;
  }

  const current = now();
  if (
    !immediate &&
    current - lastDbSummaryPublishAt < 500 &&
    dbSummaryPublishTimer
  ) {
    return;
  }

  const publish = () => {
    dbSummaryPublishTimer = null;
    lastDbSummaryPublishAt = now();
    lastDbSummarySnapshot = buildDbSummarySnapshot();
    dbSummaryListeners.forEach(listener => listener());
  };

  if (immediate || current - lastDbSummaryPublishAt >= 500) {
    if (dbSummaryPublishTimer) {
      clearTimeout(dbSummaryPublishTimer);
      dbSummaryPublishTimer = null;
    }
    publish();
    return;
  }

  dbSummaryPublishTimer = setTimeout(
    publish,
    Math.max(0, 500 - (current - lastDbSummaryPublishAt)),
  );
}

export function getDbSyncSummarySnapshot() {
  return lastDbSummarySnapshot;
}

export function subscribeDbSyncSummarySnapshot(listener: () => void) {
  dbSummaryListeners.add(listener);

  return () => {
    dbSummaryListeners.delete(listener);
  };
}

function getKeyringRuntimeConvergenceStatus(
  event: string,
): KeyringRuntimeConvergenceStatus {
  if (event.endsWith('_scheduled')) {
    return 'waiting';
  }

  if (event.endsWith('_start')) {
    return 'running';
  }

  if (event.endsWith('_end')) {
    return 'success';
  }

  if (event.endsWith('_error')) {
    return 'error';
  }

  if (event.includes('_cancel')) {
    return 'canceled';
  }

  if (event.includes('_skip')) {
    return 'skipped';
  }

  return lastKeyringRuntimeConvergenceSnapshot.status;
}

function publishKeyringRuntimeConvergenceSnapshot(
  snapshot: KeyringRuntimeConvergenceSnapshot,
) {
  lastKeyringRuntimeConvergenceSnapshot = snapshot;
  keyringRuntimeConvergenceListeners.forEach(listener => listener());
}

export function getKeyringRuntimeConvergenceSnapshot() {
  return lastKeyringRuntimeConvergenceSnapshot;
}

export function subscribeKeyringRuntimeConvergenceSnapshot(
  listener: () => void,
) {
  keyringRuntimeConvergenceListeners.add(listener);

  return () => {
    keyringRuntimeConvergenceListeners.delete(listener);
  };
}

export function recordKeyringRuntimeConvergenceDiagnostic(
  event: string,
  data: DiagnosticData = {},
) {
  if (!enabled) {
    return;
  }

  const timestamp = now();
  const previous = lastKeyringRuntimeConvergenceSnapshot;
  const status = getKeyringRuntimeConvergenceStatus(event);
  const generation =
    typeof data.generation === 'number' ? data.generation : previous.generation;
  const isNewGeneration = generation !== previous.generation;
  const scheduledAt =
    event.endsWith('_scheduled') || isNewGeneration
      ? timestamp
      : previous.scheduledAt;
  const startedAt = event.endsWith('_start') ? timestamp : previous.startedAt;
  const endedAt =
    status === 'success' || status === 'error' || status === 'canceled'
      ? timestamp
      : previous.endedAt;
  const waitMs =
    event.endsWith('_start') && scheduledAt
      ? timestamp - scheduledAt
      : previous.waitMs;
  const elapsedMs =
    typeof data.elapsedMs === 'number'
      ? data.elapsedMs
      : endedAt && startedAt
      ? endedAt - startedAt
      : previous.elapsedMs;
  const reason =
    typeof data.reason === 'string' ? data.reason : previous.reason;
  const error =
    typeof data.error === 'string'
      ? data.error
      : status === 'error'
      ? previous.error
      : '';

  const record: KeyringRuntimeConvergenceRecord = {
    id: ++keyringRuntimeConvergenceRecordSeq,
    event,
    status,
    timestamp,
    generation,
    reason,
    elapsedMs,
    error,
  };

  publishKeyringRuntimeConvergenceSnapshot({
    ...previous,
    enabled,
    updatedAt: timestamp,
    status,
    event,
    generation,
    reason,
    fallbackMs:
      typeof data.fallbackMs === 'number'
        ? data.fallbackMs
        : previous.fallbackMs,
    scheduledAt,
    startedAt,
    endedAt,
    waitMs,
    elapsedMs,
    runtimeReady:
      typeof data.runtimeReady === 'boolean'
        ? data.runtimeReady
        : previous.runtimeReady,
    runtimeRestoring:
      typeof data.runtimeRestoring === 'boolean'
        ? data.runtimeRestoring
        : previous.runtimeRestoring,
    runtimeError:
      typeof data.runtimeError === 'string'
        ? data.runtimeError
        : data.runtimeError === null
        ? null
        : previous.runtimeError,
    keyringCount:
      typeof data.keyringCount === 'number'
        ? data.keyringCount
        : previous.keyringCount,
    error,
    records: [record, ...previous.records].slice(
      0,
      MAX_KEYRING_CONVERGENCE_RECORDS,
    ),
  });
}

export function recordKeyringRuntimePerfDiagnostic(
  event: string,
  data: DiagnosticData = {},
) {
  if (
    !enabled ||
    (!event.startsWith('keyring_runtime_') &&
      !event.startsWith('refresh_memstore_keyrings') &&
      !event.startsWith('update_memstore_keyrings') &&
      event !== 'unlock_keyrings.defer_runtime_restore_scheduled')
  ) {
    return;
  }

  const timestamp = now();
  const previous = lastKeyringRuntimeConvergenceSnapshot;
  const isError = event.endsWith('_error') || event.endsWith('.error');
  const isStart = event.endsWith('_start') || event.endsWith('.start');
  const isEnd = event.endsWith('_end') || event.endsWith('.end');
  const status: KeyringRuntimeConvergenceStatus = isError
    ? 'error'
    : isStart
    ? 'running'
    : isEnd
    ? 'success'
    : previous.status;
  const elapsedMs =
    typeof data.elapsedMs === 'number' ? data.elapsedMs : previous.elapsedMs;

  publishKeyringRuntimeConvergenceSnapshot({
    ...previous,
    enabled,
    updatedAt: timestamp,
    status,
    event: previous.event || event,
    elapsedMs,
    error:
      typeof data.error === 'string'
        ? data.error
        : isError
        ? previous.error
        : previous.error,
    lastPerfEvent: event,
    lastPerfElapsedMs: elapsedMs,
  });
}

function queueDiagnosticLine(
  scope: string,
  event: string,
  data: DiagnosticData = {},
) {
  if (!diagnosticFilePath) {
    return;
  }

  try {
    pendingDiagnosticLines.push(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        scope,
        event,
        data,
      }),
    );
  } catch {
    pendingDiagnosticLines.push(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        scope,
        event,
        data: {
          serializationError: true,
        },
      }),
    );
  }

  if (activeDbSyncTasks.size > 0 || diagnosticFlushTimer) {
    return;
  }

  diagnosticFlushTimer = setTimeout(() => {
    diagnosticFlushTimer = null;
    flushDiagnosticLines();
  }, 15000);
}

function flushDiagnosticLines() {
  if (
    !diagnosticFilePath ||
    isFlushingDiagnosticLines ||
    pendingDiagnosticLines.length === 0
  ) {
    return;
  }

  isFlushingDiagnosticLines = true;
  const content = `${pendingDiagnosticLines.splice(0).join('\n')}\n`;
  RNFS.appendFile(diagnosticFilePath, content, 'utf8')
    .catch(error => {
      logger.warn('[RabbyStartupDiag:file] flush_failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    })
    .finally(() => {
      isFlushingDiagnosticLines = false;
      if (pendingDiagnosticLines.length > 0 && activeDbSyncTasks.size === 0) {
        flushDiagnosticLines();
      }
    });
}

function trace(scope: string, event: string, data: DiagnosticData = {}) {
  if (!enabled) {
    return;
  }

  queueDiagnosticLine(scope, event, data);
  logger.info(`[RabbyStartupDiag:${scope}] ${event}`, data);
  try {
    console.info(
      `[RabbyStartupDiag:${scope}] ${event} ${JSON.stringify(data)}`,
    );
  } catch {
    console.info(`[RabbyStartupDiag:${scope}] ${event}`);
  }
}

function serializeDbTask(task: ActiveDbSyncTask) {
  return {
    id: task.id,
    taskFor: task.taskFor,
    entityName: task.entityName,
    totalRows: task.totalRows,
    batchSize: task.batchSize,
    totalBatches: task.totalBatches,
    completedBatches: task.completedBatches,
    stage: task.stage,
    ageMs: now() - task.startedAt,
  };
}

function serializeWarmupTask(task: ActiveWarmupTask) {
  return {
    id: task.id,
    name: task.name,
    ageMs: now() - task.startedAt,
    detail: task.detail,
  };
}

function getActiveTaskSnapshot() {
  const dbTasks = Array.from(activeDbSyncTasks.values())
    .slice(0, MAX_SNAPSHOT_TASKS)
    .map(serializeDbTask);
  const warmupTasks = Array.from(activeWarmupTasks.values())
    .slice(0, MAX_SNAPSHOT_TASKS)
    .map(serializeWarmupTask);

  return {
    activeDbTaskCount: activeDbSyncTasks.size,
    activeWarmupTaskCount: activeWarmupTasks.size,
    dbTasks,
    warmupTasks,
  };
}

function markUnlockWindowStall(window: UnlockCriticalWindow, gapMs: number) {
  window.stallCount += 1;
  window.maxGapMs = Math.max(window.maxGapMs, gapMs);

  if (
    gapMs < STALL_LOG_MS ||
    window.loggedStallCount >= MAX_STALL_LOGS_PER_WINDOW
  ) {
    return;
  }

  window.loggedStallCount += 1;
  trace('js', 'unlock_window_js_stall', {
    id: window.id,
    reason: window.reason,
    gapMs,
    elapsedMs: now() - window.startedAt,
    ...getActiveTaskSnapshot(),
  });
  traceAndroidInstant('unlock.window_js_stall', {
    id: window.id,
    reason: window.reason,
    gapMs,
  });
}

function markDbActiveWindowStall(window: DbActiveWindow, gapMs: number) {
  window.stallCount += 1;
  window.maxGapMs = Math.max(window.maxGapMs, gapMs);

  if (
    gapMs < STALL_LOG_MS ||
    window.loggedStallCount >= MAX_STALL_LOGS_PER_WINDOW
  ) {
    return;
  }

  window.loggedStallCount += 1;
  trace('js', 'db_active_js_stall', {
    id: window.id,
    gapMs,
    elapsedMs: now() - window.startedAt,
    peakActiveTaskCount: window.peakActiveTaskCount,
    ...getActiveTaskSnapshot(),
  });
  traceAndroidInstant('db.active_window_js_stall', {
    id: window.id,
    gapMs,
    activeDbTaskCount: activeDbSyncTasks.size,
  });
}

function ensureDbActiveWindow() {
  if (!enabled || activeDbWindowRef.current) {
    return;
  }

  const startedAt = now();
  const window: DbActiveWindow = {
    id: ++dbActiveWindowSeq,
    traceCookie: nextAndroidTraceCookie(),
    startedAt,
    intervalId: null,
    lastTickAt: startedAt,
    maxGapMs: 0,
    stallCount: 0,
    loggedStallCount: 0,
    peakActiveTaskCount: activeDbSyncTasks.size,
    taskIds: [],
  };

  window.intervalId = setInterval(() => {
    const current = now();
    const gapMs = current - window.lastTickAt;
    window.lastTickAt = current;
    window.peakActiveTaskCount = Math.max(
      window.peakActiveTaskCount,
      activeDbSyncTasks.size,
    );

    if (gapMs >= STALL_WARN_MS) {
      markDbActiveWindowStall(window, gapMs);
    }

    publishDbSummarySnapshot();
  }, STALL_INTERVAL_MS);

  activeDbWindowRef.current = window;
  if (diagnosticFlushTimer) {
    clearTimeout(diagnosticFlushTimer);
    diagnosticFlushTimer = null;
  }
  trace('db', 'active_window_start', {
    id: window.id,
    ...getActiveTaskSnapshot(),
  });
  beginAndroidAsyncTrace('db.active_window', window.traceCookie, {
    id: window.id,
    activeDbTaskCount: activeDbSyncTasks.size,
  });
  traceAndroidCounter('db.active_task_count', activeDbSyncTasks.size);
  publishDbSummarySnapshot(true);
}

function endDbActiveWindowIfIdle() {
  if (!enabled || activeDbSyncTasks.size > 0) {
    return;
  }

  const window = activeDbWindowRef.current;
  if (!window) {
    return;
  }

  if (window.intervalId) {
    clearInterval(window.intervalId);
  }

  const endedAt = now();
  const summary = buildDbWindowSummary(window, endedAt);
  activeDbWindowRef.current = null;
  lastDbSummarySnapshot = {
    enabled,
    updatedAt: endedAt,
    activeWindow: null,
    lastWindow: summary,
  };
  dbSyncTaskSummaries.clear();
  dbSummaryListeners.forEach(listener => listener());
  trace('db', 'active_window_end', {
    id: window.id,
    durationMs: summary.durationMs,
    maxGapMs: window.maxGapMs,
    stallCount: window.stallCount,
    peakActiveTaskCount: window.peakActiveTaskCount,
    ...getActiveTaskSnapshot(),
  });
  endAndroidAsyncTrace('db.active_window', window.traceCookie, {
    id: window.id,
    durationMs: summary.durationMs,
    maxGapMs: window.maxGapMs,
    stallCount: window.stallCount,
  });
  traceAndroidCounter('db.active_task_count', activeDbSyncTasks.size);
  flushDiagnosticLines();
}

export function isStartupDiagnosticsEnabled() {
  return enabled;
}

export function traceStartupDiagnostic(
  scope: string,
  event: string,
  data: DiagnosticData = {},
) {
  trace(scope, event, data);
}

export function beginUnlockCriticalWindow(reason: string) {
  if (!enabled) {
    return null;
  }

  if (activeUnlockWindowRef.current) {
    endUnlockCriticalWindow(activeUnlockWindowRef.current.id, {
      reason: 'superseded',
    });
  }

  const startedAt = now();
  const window: UnlockCriticalWindow = {
    id: ++unlockWindowSeq,
    traceCookie: nextAndroidTraceCookie(),
    startedAt,
    reason,
    intervalId: null,
    lastTickAt: startedAt,
    maxGapMs: 0,
    stallCount: 0,
    loggedStallCount: 0,
  };

  window.intervalId = setInterval(() => {
    const current = now();
    const gapMs = current - window.lastTickAt;
    window.lastTickAt = current;

    if (gapMs >= STALL_WARN_MS) {
      markUnlockWindowStall(window, gapMs);
    }
  }, STALL_INTERVAL_MS);

  activeUnlockWindowRef.current = window;
  trace('unlock', 'critical_window_start', {
    id: window.id,
    reason,
    ...getActiveTaskSnapshot(),
  });
  beginAndroidAsyncTrace('unlock.critical_window', window.traceCookie, {
    id: window.id,
    reason,
  });

  return window.id;
}

export function endUnlockCriticalWindow(
  id: number | null,
  data: DiagnosticData = {},
) {
  if (!enabled || id === null) {
    return;
  }

  const window = activeUnlockWindowRef.current;
  if (!window || window.id !== id) {
    return;
  }

  if (window.intervalId) {
    clearInterval(window.intervalId);
  }

  activeUnlockWindowRef.current = null;
  const durationMs = now() - window.startedAt;
  trace('unlock', 'critical_window_end', {
    id,
    reason: window.reason,
    durationMs,
    maxGapMs: window.maxGapMs,
    stallCount: window.stallCount,
    ...getActiveTaskSnapshot(),
    ...data,
  });
  endAndroidAsyncTrace('unlock.critical_window', window.traceCookie, {
    id,
    reason: window.reason,
    durationMs,
    maxGapMs: window.maxGapMs,
    stallCount: window.stallCount,
  });
}

export async function runStartupDiagnosticTask<T>(
  name: string,
  detail: DiagnosticData,
  task: () => Promise<T> | T,
): Promise<T> {
  if (!enabled) {
    return task();
  }

  const id = ++warmupTaskSeq;
  const traceCookie = nextAndroidTraceCookie();
  const startedAt = now();
  activeWarmupTasks.set(id, {
    id,
    traceCookie,
    startedAt,
    name,
    detail,
  });

  trace('warmup', 'task_start', {
    id,
    name,
    detail,
    ...getActiveTaskSnapshot(),
  });
  beginAndroidAsyncTrace(`warmup.${name}`, traceCookie, {
    id,
    name,
  });

  try {
    const result = await task();
    const durationMs = now() - startedAt;
    trace('warmup', 'task_end', {
      id,
      name,
      status: 'success',
      durationMs,
      ...getActiveTaskSnapshot(),
    });
    endAndroidAsyncTrace(`warmup.${name}`, traceCookie, {
      id,
      status: 'success',
      durationMs,
    });
    return result;
  } catch (error) {
    const durationMs = now() - startedAt;
    trace('warmup', 'task_end', {
      id,
      name,
      status: 'error',
      durationMs,
      error: error instanceof Error ? error.message : String(error),
      ...getActiveTaskSnapshot(),
    });
    endAndroidAsyncTrace(`warmup.${name}`, traceCookie, {
      id,
      status: 'error',
      durationMs,
    });
    throw error;
  } finally {
    activeWarmupTasks.delete(id);
  }
}

export function beginDbSyncTask(meta: {
  taskFor: string;
  entityName: string;
  totalRows: number;
  batchSize: number;
  totalBatches: number;
  requestedConcurrency: number;
  effectiveConcurrency: number;
  waitTaskDoneReturn: boolean;
  delayBetweenTasks: number;
}) {
  if (!enabled) {
    return null;
  }

  const id = ++dbTaskSeq;
  const task: ActiveDbSyncTask = {
    id,
    traceCookie: nextAndroidTraceCookie(),
    startedAt: now(),
    stage: 'created',
    stageDetail: '',
    completedBatches: 0,
    paramsBuildMs: 0,
    executeMs: 0,
    batchDurationMs: 0,
    status: 'running',
    ...meta,
  };
  activeDbSyncTasks.set(id, task);
  dbSyncTaskSummaries.set(id, task);
  ensureDbActiveWindow();
  activeDbWindowRef.current?.taskIds.push(id);
  const activeDbWindow = activeDbWindowRef.current;
  if (activeDbWindow) {
    activeDbWindow.peakActiveTaskCount = Math.max(
      activeDbWindow.peakActiveTaskCount,
      activeDbSyncTasks.size,
    );
  }

  trace('db', 'sync_task_start', {
    ...serializeDbTask(task),
    requestedConcurrency: meta.requestedConcurrency,
    effectiveConcurrency: meta.effectiveConcurrency,
    waitTaskDoneReturn: meta.waitTaskDoneReturn,
    delayBetweenTasks: meta.delayBetweenTasks,
    activeDbTaskCount: activeDbSyncTasks.size,
  });
  beginAndroidAsyncTrace(`db.sync_task.${meta.entityName}`, task.traceCookie, {
    id: task.id,
    taskFor: meta.taskFor,
    rows: meta.totalRows,
    batches: meta.totalBatches,
  });
  traceAndroidCounter('db.active_task_count', activeDbSyncTasks.size);
  publishDbSummarySnapshot(true);

  return id;
}

export function markDbSyncTaskStage(
  id: number | null,
  stage: string,
  data: DiagnosticData = {},
  immediate = false,
) {
  if (!enabled || id === null) {
    return;
  }

  const task = activeDbSyncTasks.get(id);
  if (!task) {
    return;
  }

  task.stage = stage;
  task.stageDetail = formatDbTaskStageDetail(data);
  publishDbSummarySnapshot(immediate);
  trace('db', 'sync_task_stage', {
    ...serializeDbTask(task),
    ...data,
  });
}

export function markDbSyncTaskBatch(
  id: number | null,
  data: {
    round: number;
    totalRound: number;
    count: number;
    durationMs: number;
    paramsBuildMs?: number;
    executeMs?: number;
    method?: string;
  },
) {
  if (!enabled || id === null) {
    return;
  }

  const task = activeDbSyncTasks.get(id);
  if (!task) {
    return;
  }

  task.stage = 'batch_upsert';
  task.completedBatches = Math.max(task.completedBatches, data.round + 1);
  task.paramsBuildMs += data.paramsBuildMs || 0;
  task.executeMs += data.executeMs || 0;
  task.batchDurationMs += data.durationMs;
  publishDbSummarySnapshot();

  const shouldLog =
    data.durationMs >= 120 ||
    data.round === 0 ||
    data.round + 1 === data.totalRound;
  if (!shouldLog) {
    return;
  }

  trace('db', 'sync_task_batch', {
    ...serializeDbTask(task),
    round: data.round,
    totalRound: data.totalRound,
    count: data.count,
    durationMs: data.durationMs,
    paramsBuildMs: data.paramsBuildMs,
    executeMs: data.executeMs,
    method: data.method,
  });
  traceAndroidInstant('db.sync_task.batch', {
    id: task.id,
    entityName: task.entityName,
    round: data.round + 1,
    totalRound: data.totalRound,
    count: data.count,
    durationMs: data.durationMs,
    method: data.method,
  });
}

export function endDbSyncTask(
  id: number | null,
  status: 'success' | 'error' | 'aborted',
  data: DiagnosticData = {},
) {
  if (!enabled || id === null) {
    return;
  }

  const task = activeDbSyncTasks.get(id);
  if (!task) {
    return;
  }

  activeDbSyncTasks.delete(id);
  task.status = status;
  task.endedAt = now();
  trace('db', 'sync_task_end', {
    ...serializeDbTask(task),
    status,
    durationMs: task.endedAt - task.startedAt,
    activeDbTaskCount: activeDbSyncTasks.size,
    ...data,
  });
  endAndroidAsyncTrace(`db.sync_task.${task.entityName}`, task.traceCookie, {
    id: task.id,
    status,
    durationMs: task.endedAt - task.startedAt,
  });
  traceAndroidCounter('db.active_task_count', activeDbSyncTasks.size);
  publishDbSummarySnapshot(true);
  endDbActiveWindowIfIdle();
}
