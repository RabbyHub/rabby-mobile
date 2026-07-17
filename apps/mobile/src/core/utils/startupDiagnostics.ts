import {
  beginAndroidAsyncTrace,
  endAndroidAsyncTrace,
  nextAndroidTraceCookie,
  traceAndroidCounter,
  traceAndroidInstant,
} from './androidTrace';
import { isNonProductionDiagnosticsEnabled } from './diagnosticEnv';
import {
  recordStartupPerformanceEvent,
  STARTUP_PERFORMANCE_STALL_WARN_MS,
  subscribeStartupPerformanceStalls,
} from '@/startup/performance/recorder';
import { shouldSuppressPerfCaptureConsoleNoise } from './perfCaptureConsole';

type DiagnosticData = Record<string, unknown>;

type OpSqliteDiagnosticPayload = {
  op?: string;
  opId?: string;
  phase?: string;
  durationMs?: number;
  argsConvertMs?: number;
  nativeExecuteMs?: number;
  commandCount?: number;
  [key: string]: unknown;
};

type OpSqliteDiagnosticContext = {
  dbSyncTaskId: number | null;
  schedulerTaskId?: number;
  taskFor: string;
  entityName: string;
  round: number;
  count: number;
  totalRound: number;
  method: string;
};

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
  executionActive: boolean;
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

export type StartupGovernanceTaskStatus =
  | 'scheduled'
  | 'running'
  | 'success'
  | 'error'
  | 'canceled';

export type StartupGovernanceTaskRecord = {
  id: number;
  label: string;
  owner: string;
  reason: string;
  stage: string;
  priority: string;
  status: StartupGovernanceTaskStatus;
  budgetMs: number;
  fallbackMs: number;
  scheduledAt: number;
  firedAt: number;
  endedAt: number;
  durationMs: number;
  invokeSyncMs: number;
  awaitWallMs: number;
  isAsync: boolean;
  waitMs: number;
  budgetExceeded: boolean;
  error: string;
};

type UnlockCriticalWindow = {
  id: number;
  traceCookie: number;
  startedAt: number;
  reason: string;
  maxGapMs: number;
  stallCount: number;
  loggedStallCount: number;
};

type DbActiveWindow = {
  id: number;
  traceCookie: number;
  startedAt: number;
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

export type StartupTaskSummarySnapshot = {
  enabled: boolean;
  updatedAt: number;
  activeCount: number;
  scheduledCount: number;
  runningCount: number;
  budgetExceededCount: number;
  errorCount: number;
  activeTasks: StartupGovernanceTaskRecord[];
  recentTasks: StartupGovernanceTaskRecord[];
};

const enabled = isNonProductionDiagnosticsEnabled;
const STALL_LOG_MS = 250;
const MAX_STALL_LOGS_PER_WINDOW = 8;
const MAX_SNAPSHOT_TASKS = 5;
const MAX_KEYRING_CONVERGENCE_RECORDS = 5;
const MAX_STARTUP_TASK_SUMMARY_RECORDS = 12;

let dbTaskSeq = 0;
let warmupTaskSeq = 0;
let startupGovernanceTaskSeq = 0;
let unlockWindowSeq = 0;
let dbActiveWindowSeq = 0;
let keyringRuntimeConvergenceRecordSeq = 0;

const activeDbSyncTasks = new Map<number, ActiveDbSyncTask>();
const activeWarmupTasks = new Map<number, ActiveWarmupTask>();
const startupGovernanceTasks = new Map<number, StartupGovernanceTaskRecord>();
let recentStartupGovernanceTasks: StartupGovernanceTaskRecord[] = [];
const dbSyncTaskSummaries = new Map<number, ActiveDbSyncTask>();
const dbSummaryListeners = new Set<() => void>();
const keyringRuntimeConvergenceListeners = new Set<() => void>();
const startupTaskSummaryListeners = new Set<() => void>();

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

const opSqliteDiagnosticContextRef: {
  current: OpSqliteDiagnosticContext | null;
} = {
  current: null,
};

let didInstallOpSqliteDiagnosticHook = false;

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
let lastStartupTaskSummarySnapshot: StartupTaskSummarySnapshot = {
  enabled,
  updatedAt: now(),
  activeCount: 0,
  scheduledCount: 0,
  runningCount: 0,
  budgetExceededCount: 0,
  errorCount: 0,
  activeTasks: [],
  recentTasks: [],
};
let dbSummaryPublishTimer: ReturnType<typeof setTimeout> | null = null;
let lastDbSummaryPublishAt = 0;
let startupTaskSummaryPublishTimer: ReturnType<typeof setTimeout> | null = null;
let lastStartupTaskSummaryPublishAt = 0;

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

function isDbSyncExecutionStage(stage: string) {
  return (
    stage === 'running' ||
    stage === 'upsert_method' ||
    stage === 'params_build' ||
    stage === 'params_built' ||
    stage === 'execute_batch' ||
    stage === 'typeorm_upsert' ||
    stage === 'after_batches_start'
  );
}

function getDbSyncExecutionTaskCount() {
  let count = 0;
  activeDbSyncTasks.forEach(task => {
    if (task.executionActive) {
      count += 1;
    }
  });
  return count;
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

function cloneStartupTaskRecord(
  task: StartupGovernanceTaskRecord,
): StartupGovernanceTaskRecord {
  return { ...task };
}

function buildStartupTaskSummarySnapshot(): StartupTaskSummarySnapshot {
  const activeTasks = Array.from(startupGovernanceTasks.values())
    .slice(-MAX_STARTUP_TASK_SUMMARY_RECORDS)
    .map(cloneStartupTaskRecord);
  const recentTasks = recentStartupGovernanceTasks
    .slice(0, MAX_STARTUP_TASK_SUMMARY_RECORDS)
    .map(cloneStartupTaskRecord);
  const allVisibleTasks = [...activeTasks, ...recentTasks];

  return {
    enabled,
    updatedAt: now(),
    activeCount: startupGovernanceTasks.size,
    scheduledCount: activeTasks.filter(task => task.status === 'scheduled')
      .length,
    runningCount: activeTasks.filter(task => task.status === 'running').length,
    budgetExceededCount: allVisibleTasks.filter(task => task.budgetExceeded)
      .length,
    errorCount: allVisibleTasks.filter(task => task.status === 'error').length,
    activeTasks,
    recentTasks,
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

function publishStartupTaskSummarySnapshot(immediate = false) {
  if (!enabled) {
    return;
  }

  const current = now();
  if (
    !immediate &&
    current - lastStartupTaskSummaryPublishAt < 250 &&
    startupTaskSummaryPublishTimer
  ) {
    return;
  }

  const publish = () => {
    startupTaskSummaryPublishTimer = null;
    lastStartupTaskSummaryPublishAt = now();
    lastStartupTaskSummarySnapshot = buildStartupTaskSummarySnapshot();
    startupTaskSummaryListeners.forEach(listener => listener());
  };

  if (immediate || current - lastStartupTaskSummaryPublishAt >= 250) {
    if (startupTaskSummaryPublishTimer) {
      clearTimeout(startupTaskSummaryPublishTimer);
      startupTaskSummaryPublishTimer = null;
    }
    publish();
    return;
  }

  startupTaskSummaryPublishTimer = setTimeout(
    publish,
    Math.max(0, 250 - (current - lastStartupTaskSummaryPublishAt)),
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

export function getStartupTaskSummarySnapshot() {
  return lastStartupTaskSummarySnapshot;
}

export function subscribeStartupTaskSummarySnapshot(listener: () => void) {
  startupTaskSummaryListeners.add(listener);

  return () => {
    startupTaskSummaryListeners.delete(listener);
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

function trace(scope: string, event: string, data: DiagnosticData = {}) {
  if (!enabled) {
    return;
  }

  recordStartupPerformanceEvent(scope, event, data);
  if (shouldSuppressPerfCaptureConsoleNoise()) {
    return;
  }

  try {
    console.info(
      `[RabbyStartupDiag:${scope}] ${event} ${JSON.stringify(data)}`,
    );
  } catch {
    console.info(`[RabbyStartupDiag:${scope}] ${event}`);
  }
}

function getGlobalForOpSqliteDiagnostics() {
  return globalThis as typeof globalThis & {
    __RABBY_OP_SQLITE_DIAGNOSTIC__?: (
      payload: OpSqliteDiagnosticPayload,
    ) => void;
  };
}

function installOpSqliteDiagnosticHook() {
  if (!enabled || didInstallOpSqliteDiagnosticHook) {
    return;
  }

  didInstallOpSqliteDiagnosticHook = true;
  getGlobalForOpSqliteDiagnostics().__RABBY_OP_SQLITE_DIAGNOSTIC__ =
    payload => {
      const context = opSqliteDiagnosticContextRef.current;

      trace('db', 'op_sqlite_execute_batch_phase', {
        ...(context || {}),
        ...payload,
      });
    };
}

export async function withOpSqliteDiagnosticContext<T>(
  context: OpSqliteDiagnosticContext,
  task: () => Promise<T>,
): Promise<T> {
  if (!enabled) {
    return task();
  }

  installOpSqliteDiagnosticHook();
  const previousContext = opSqliteDiagnosticContextRef.current;
  opSqliteDiagnosticContextRef.current = context;

  try {
    return await task();
  } finally {
    opSqliteDiagnosticContextRef.current = previousContext;
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
    executionActive: task.executionActive,
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
    activeDbExecutionTaskCount: getDbSyncExecutionTaskCount(),
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

subscribeStartupPerformanceStalls(({ gapMs }) => {
  if (!enabled || gapMs < STARTUP_PERFORMANCE_STALL_WARN_MS) {
    return;
  }

  const unlockWindow = activeUnlockWindowRef.current;
  if (unlockWindow) {
    markUnlockWindowStall(unlockWindow, gapMs);
  }

  const dbWindow = activeDbWindowRef.current;
  if (dbWindow) {
    dbWindow.peakActiveTaskCount = Math.max(
      dbWindow.peakActiveTaskCount,
      getDbSyncExecutionTaskCount(),
    );
    markDbActiveWindowStall(dbWindow, gapMs);
    publishDbSummarySnapshot();
  }
});

function ensureDbActiveWindow() {
  if (!enabled || activeDbWindowRef.current) {
    return;
  }

  const startedAt = now();
  const activeDbExecutionTaskCount = getDbSyncExecutionTaskCount();
  const window: DbActiveWindow = {
    id: ++dbActiveWindowSeq,
    traceCookie: nextAndroidTraceCookie(),
    startedAt,
    maxGapMs: 0,
    stallCount: 0,
    loggedStallCount: 0,
    peakActiveTaskCount: activeDbExecutionTaskCount,
    taskIds: [],
  };

  activeDbWindowRef.current = window;
  trace('db', 'active_window_start', {
    id: window.id,
    ...getActiveTaskSnapshot(),
  });
  beginAndroidAsyncTrace('db.active_window', window.traceCookie, {
    id: window.id,
    activeDbTaskCount: activeDbSyncTasks.size,
    activeDbExecutionTaskCount,
  });
  traceAndroidCounter('db.active_task_count', activeDbExecutionTaskCount);
  publishDbSummarySnapshot(true);
}

function endDbActiveWindowIfIdle() {
  if (!enabled || getDbSyncExecutionTaskCount() > 0) {
    return;
  }

  const window = activeDbWindowRef.current;
  if (!window) {
    return;
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
}

function attachDbTaskToActiveWindow(task: ActiveDbSyncTask) {
  const activeDbWindow = activeDbWindowRef.current;
  if (!activeDbWindow) {
    return;
  }

  dbSyncTaskSummaries.set(task.id, task);
  if (!activeDbWindow.taskIds.includes(task.id)) {
    activeDbWindow.taskIds.push(task.id);
  }
  activeDbWindow.peakActiveTaskCount = Math.max(
    activeDbWindow.peakActiveTaskCount,
    getDbSyncExecutionTaskCount(),
  );
}

function setDbSyncTaskExecutionActive(
  task: ActiveDbSyncTask,
  executionActive: boolean,
) {
  if (task.executionActive === executionActive) {
    if (executionActive) {
      attachDbTaskToActiveWindow(task);
    }
    return;
  }

  task.executionActive = executionActive;
  if (executionActive) {
    ensureDbActiveWindow();
    attachDbTaskToActiveWindow(task);
  } else {
    endDbActiveWindowIfIdle();
  }
  traceAndroidCounter('db.active_task_count', getDbSyncExecutionTaskCount());
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

export function beginStartupTaskDiagnostic(meta: {
  label?: string;
  owner?: string;
  reason?: string;
  stage?: string;
  priority?: string;
  budgetMs?: number;
  fallbackMs?: number;
}) {
  if (!enabled) {
    return null;
  }

  const timestamp = now();
  const id = ++startupGovernanceTaskSeq;
  const task: StartupGovernanceTaskRecord = {
    id,
    label: meta.label || 'anonymous',
    owner: meta.owner || '',
    reason: meta.reason || '',
    stage: meta.stage || 'immediate',
    priority: meta.priority || '',
    status: 'scheduled',
    budgetMs: meta.budgetMs || 0,
    fallbackMs: meta.fallbackMs || 0,
    scheduledAt: timestamp,
    firedAt: 0,
    endedAt: 0,
    durationMs: 0,
    invokeSyncMs: 0,
    awaitWallMs: 0,
    isAsync: false,
    waitMs: 0,
    budgetExceeded: false,
    error: '',
  };

  startupGovernanceTasks.set(id, task);
  trace('startup-task', 'task_schedule', {
    id,
    label: task.label,
    owner: task.owner,
    reason: task.reason,
    stage: task.stage,
    priority: task.priority,
    budgetMs: task.budgetMs,
    fallbackMs: task.fallbackMs,
  });
  publishStartupTaskSummarySnapshot(true);

  return id;
}

export function markStartupTaskDiagnostic(
  id: number | null,
  event:
    | 'fire'
    | 'invoke_return'
    | 'done'
    | 'error'
    | 'cancel'
    | 'budget_exceeded',
  data: DiagnosticData = {},
) {
  if (!enabled || id === null) {
    return;
  }

  const task = startupGovernanceTasks.get(id);
  if (!task) {
    return;
  }

  const timestamp = now();
  if (event === 'fire') {
    task.status = 'running';
    task.firedAt = timestamp;
    task.waitMs = timestamp - task.scheduledAt;
  } else if (event === 'invoke_return') {
    task.invokeSyncMs =
      typeof data.invokeSyncMs === 'number' ? data.invokeSyncMs : 0;
    task.isAsync = data.isAsync === true;
  } else if (event === 'budget_exceeded') {
    task.budgetExceeded = true;
  } else {
    startupGovernanceTasks.delete(id);
    task.endedAt = timestamp;
    task.durationMs =
      typeof data.durationMs === 'number'
        ? data.durationMs
        : task.firedAt
        ? timestamp - task.firedAt
        : timestamp - task.scheduledAt;
    task.invokeSyncMs =
      typeof data.invokeSyncMs === 'number'
        ? data.invokeSyncMs
        : task.invokeSyncMs;
    task.awaitWallMs =
      typeof data.awaitWallMs === 'number' ? data.awaitWallMs : 0;
    task.isAsync =
      typeof data.isAsync === 'boolean' ? data.isAsync : task.isAsync;
    task.status =
      event === 'done' ? 'success' : event === 'cancel' ? 'canceled' : 'error';
    task.error =
      typeof data.error === 'string'
        ? data.error
        : event === 'error'
        ? 'error'
        : '';
    recentStartupGovernanceTasks = [
      cloneStartupTaskRecord(task),
      ...recentStartupGovernanceTasks,
    ].slice(0, MAX_STARTUP_TASK_SUMMARY_RECORDS);
  }

  trace('startup-task', `task_${event}`, {
    id,
    label: task.label,
    owner: task.owner,
    stage: task.stage,
    priority: task.priority,
    status: task.status,
    waitMs: task.waitMs,
    durationMs: task.durationMs,
    invokeSyncMs: task.invokeSyncMs,
    awaitWallMs: task.awaitWallMs,
    isAsync: task.isAsync,
    budgetMs: task.budgetMs,
    budgetExceeded: task.budgetExceeded,
    ...data,
  });
  publishStartupTaskSummarySnapshot(
    event !== 'fire' && event !== 'invoke_return',
  );
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
    maxGapMs: 0,
    stallCount: 0,
    loggedStallCount: 0,
  };

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
    executionActive: false,
    status: 'running',
    ...meta,
  };
  activeDbSyncTasks.set(id, task);
  dbSyncTaskSummaries.set(id, task);

  trace('db', 'sync_task_start', {
    ...serializeDbTask(task),
    requestedConcurrency: meta.requestedConcurrency,
    effectiveConcurrency: meta.effectiveConcurrency,
    waitTaskDoneReturn: meta.waitTaskDoneReturn,
    delayBetweenTasks: meta.delayBetweenTasks,
    activeDbTaskCount: activeDbSyncTasks.size,
    activeDbExecutionTaskCount: getDbSyncExecutionTaskCount(),
  });
  beginAndroidAsyncTrace(`db.sync_task.${meta.entityName}`, task.traceCookie, {
    id: task.id,
    taskFor: meta.taskFor,
    rows: meta.totalRows,
    batches: meta.totalBatches,
  });
  traceAndroidCounter('db.active_task_count', getDbSyncExecutionTaskCount());
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
  setDbSyncTaskExecutionActive(task, isDbSyncExecutionStage(stage));
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
  setDbSyncTaskExecutionActive(task, false);
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

  task.status = status;
  task.endedAt = now();
  task.executionActive = false;
  activeDbSyncTasks.delete(id);
  trace('db', 'sync_task_end', {
    ...serializeDbTask(task),
    status,
    durationMs: task.endedAt - task.startedAt,
    activeDbTaskCount: activeDbSyncTasks.size,
    activeDbExecutionTaskCount: getDbSyncExecutionTaskCount(),
    ...data,
  });
  endAndroidAsyncTrace(`db.sync_task.${task.entityName}`, task.traceCookie, {
    id: task.id,
    status,
    durationMs: task.endedAt - task.startedAt,
  });
  traceAndroidCounter('db.active_task_count', getDbSyncExecutionTaskCount());
  publishDbSummarySnapshot(true);
  endDbActiveWindowIfIdle();
}
