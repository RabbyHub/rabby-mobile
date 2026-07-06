import { zCreate } from '@/core/utils/reexports';
import { traceStartupDiagnostic } from '@/core/utils/startupDiagnostics';
import type { SyncTaskOptions } from './_event';

export type SyncTaskPriority = 'high' | 'normal' | 'low';

export type SyncTaskStatus =
  | 'queued'
  | 'running'
  | 'paused'
  | 'success'
  | 'error'
  | 'aborted'
  | 'merged';

export type SyncTaskSnapshot = {
  id: number;
  key: string;
  taskFor: SyncTaskOptions['taskFor'] | '@unknown';
  owner: string;
  entityName: string;
  rowCount: number;
  batchSize: number;
  totalBatches: number;
  completedBatches: number;
  priority: SyncTaskPriority;
  priorityValue: number;
  status: SyncTaskStatus;
  stage: string;
  method?: string;
  mergedCount: number;
  createdAt: number;
  startedAt?: number;
  endedAt?: number;
  durationMs?: number;
  lastBatch?: {
    round: number;
    count: number;
    durationMs: number;
  };
  lastError?: string;
};

export type SyncSchedulerSnapshot = {
  activeCount: number;
  queuedCount: number;
  recentCount: number;
  pauseReasons: string[];
  criticalReasons: string[];
  tasks: SyncTaskSnapshot[];
  recentTasks: SyncTaskSnapshot[];
  updatedAt: number;
};

export type SyncTaskRuntimeContext = {
  taskId: number;
  signal?: AbortSignal;
  setStage: (stage: string, detail?: Record<string, unknown>) => void;
  setMethod: (method: string) => void;
  markBatch: (payload: {
    round: number;
    count: number;
    durationMs: number;
  }) => void;
  waitIfPaused: () => Promise<void>;
};

type RuntimeSyncTask<T = any> = SyncTaskSnapshot & {
  runner: (ctx: SyncTaskRuntimeContext) => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
  signal?: AbortSignal;
  abortListener?: () => void;
};

export class SyncTaskAbortError extends Error {
  constructor(message = 'Sync task aborted') {
    super(message);
    this.name = 'SyncTaskAbortError';
  }
}

const PRIORITY_VALUES: Record<SyncTaskPriority, number> = {
  high: 100,
  normal: 50,
  low: 10,
};

const MAX_CONCURRENT_SYNC_TASKS = 1;
const MAX_RECENT_TASKS = 80;
const STORE_PUBLISH_THROTTLE_MS = 250;

const queuedTasks: RuntimeSyncTask[] = [];
const activeTasks = new Map<number, RuntimeSyncTask>();
const taskById = new Map<number, RuntimeSyncTask>();
const recentTasks: SyncTaskSnapshot[] = [];
const pauseReasons = new Set<string>();
const criticalReasons = new Set<string>();
const pauseWaiters = new Set<() => void>();

let taskSeq = 0;
let publishTimer: ReturnType<typeof setTimeout> | null = null;

const initialSnapshot: SyncSchedulerSnapshot = {
  activeCount: 0,
  queuedCount: 0,
  recentCount: 0,
  pauseReasons: [],
  criticalReasons: [],
  tasks: [],
  recentTasks: [],
  updatedAt: Date.now(),
};

const syncSchedulerStore = zCreate<SyncSchedulerSnapshot>(
  () => initialSnapshot,
);

function now() {
  return Date.now();
}

function toSnapshot(task: RuntimeSyncTask): SyncTaskSnapshot {
  const {
    id,
    key,
    taskFor,
    owner,
    entityName,
    rowCount,
    batchSize,
    totalBatches,
    completedBatches,
    priority,
    priorityValue,
    status,
    stage,
    method,
    mergedCount,
    createdAt,
    startedAt,
    endedAt,
    durationMs,
    lastBatch,
    lastError,
  } = task;

  return {
    id,
    key,
    taskFor,
    owner,
    entityName,
    rowCount,
    batchSize,
    totalBatches,
    completedBatches,
    priority,
    priorityValue,
    status,
    stage,
    method,
    mergedCount,
    createdAt,
    startedAt,
    endedAt,
    durationMs,
    lastBatch,
    lastError,
  };
}

function buildSnapshot(): SyncSchedulerSnapshot {
  const liveTasks = [...Array.from(activeTasks.values()), ...queuedTasks].map(
    toSnapshot,
  );

  liveTasks.sort((a, b) => {
    if (a.status === b.status) {
      if (b.priorityValue !== a.priorityValue) {
        return b.priorityValue - a.priorityValue;
      }
      return a.createdAt - b.createdAt;
    }

    if (a.status === 'running') {
      return -1;
    }
    if (b.status === 'running') {
      return 1;
    }
    return a.createdAt - b.createdAt;
  });

  return {
    activeCount: activeTasks.size,
    queuedCount: queuedTasks.length,
    recentCount: recentTasks.length,
    pauseReasons: Array.from(pauseReasons),
    criticalReasons: Array.from(criticalReasons),
    tasks: liveTasks,
    recentTasks: recentTasks.slice(0, MAX_RECENT_TASKS),
    updatedAt: now(),
  };
}

function publishSnapshot(immediate = false) {
  if (immediate) {
    if (publishTimer) {
      clearTimeout(publishTimer);
      publishTimer = null;
    }
    syncSchedulerStore.setState(buildSnapshot());
    return;
  }

  if (publishTimer) {
    return;
  }

  publishTimer = setTimeout(() => {
    publishTimer = null;
    syncSchedulerStore.setState(buildSnapshot());
  }, STORE_PUBLISH_THROTTLE_MS);
}

function notifyPauseWaiters() {
  const waiters = Array.from(pauseWaiters);
  pauseWaiters.clear();
  waiters.forEach(resolve => resolve());
}

function traceScheduler(event: string, data: Record<string, unknown> = {}) {
  traceStartupDiagnostic('db_scheduler', event, {
    ...data,
    activeCount: activeTasks.size,
    queuedCount: queuedTasks.length,
    pauseReasons: Array.from(pauseReasons),
    criticalReasons: Array.from(criticalReasons),
  });
}

function shouldHoldQueuedTask(task: RuntimeSyncTask) {
  if (pauseReasons.size > 0) {
    return `pause:${Array.from(pauseReasons).join(',')}`;
  }

  if (criticalReasons.size > 0 && task.priority !== 'high') {
    return `critical:${Array.from(criticalReasons).join(',')}`;
  }

  return '';
}

function markQueuedHoldStates() {
  queuedTasks.forEach(task => {
    const holdReason = shouldHoldQueuedTask(task);
    const nextStatus: SyncTaskStatus = holdReason ? 'paused' : 'queued';
    if (
      task.status !== nextStatus ||
      (holdReason && task.stage !== holdReason)
    ) {
      task.status = nextStatus;
      task.stage = holdReason || 'queued';
    }
  });
}

function compareQueuedTask(a: RuntimeSyncTask, b: RuntimeSyncTask) {
  if (b.priorityValue !== a.priorityValue) {
    return b.priorityValue - a.priorityValue;
  }
  return a.createdAt - b.createdAt;
}

function findRunnableTaskIndex() {
  queuedTasks.sort(compareQueuedTask);
  markQueuedHoldStates();

  for (let i = 0; i < queuedTasks.length; i += 1) {
    if (!shouldHoldQueuedTask(queuedTasks[i])) {
      return i;
    }
  }

  return -1;
}

function removeQueuedTask(taskId: number) {
  const index = queuedTasks.findIndex(task => task.id === taskId);
  if (index < 0) {
    return null;
  }

  const [task] = queuedTasks.splice(index, 1);
  return task;
}

function removeAbortListener(task: RuntimeSyncTask) {
  if (task.signal && task.abortListener) {
    task.signal.removeEventListener('abort', task.abortListener);
    task.abortListener = undefined;
  }
}

function completeTask(
  task: RuntimeSyncTask,
  status: Extract<SyncTaskStatus, 'success' | 'error' | 'aborted' | 'merged'>,
  detail: Record<string, unknown> = {},
) {
  task.status = status;
  task.stage = status;
  task.endedAt = now();
  task.durationMs = task.startedAt
    ? task.endedAt - task.startedAt
    : task.endedAt - task.createdAt;
  if (typeof detail.error === 'string') {
    task.lastError = detail.error;
  }

  removeAbortListener(task);
  activeTasks.delete(task.id);
  taskById.delete(task.id);
  recentTasks.unshift(toSnapshot(task));
  recentTasks.splice(MAX_RECENT_TASKS);

  traceScheduler('task_complete', {
    id: task.id,
    key: task.key,
    taskFor: task.taskFor,
    status,
    durationMs: task.durationMs,
    completedBatches: task.completedBatches,
    totalBatches: task.totalBatches,
    ...detail,
  });

  publishSnapshot(true);
}

function cancelQueuedTask(task: RuntimeSyncTask, status: 'aborted' | 'merged') {
  removeQueuedTask(task.id);
  completeTask(task, status, {
    error: status === 'merged' ? 'superseded by newer task' : 'aborted',
  });
  task.reject(new SyncTaskAbortError(task.lastError));
}

function cancelQueuedDuplicates(taskKey: string) {
  queuedTasks
    .filter(task => task.key === taskKey)
    .forEach(task => {
      task.mergedCount += 1;
      cancelQueuedTask(task, 'merged');
    });
}

function waitForPauseResume(signal?: AbortSignal) {
  if (signal?.aborted) {
    return Promise.reject(new SyncTaskAbortError());
  }

  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const done = () => {
      if (settled) {
        return;
      }
      settled = true;
      signal?.removeEventListener('abort', onAbort);
      pauseWaiters.delete(done);
      resolve();
    };
    const onAbort = () => {
      if (settled) {
        return;
      }
      settled = true;
      pauseWaiters.delete(done);
      reject(new SyncTaskAbortError());
    };

    pauseWaiters.add(done);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function createTaskContext(task: RuntimeSyncTask): SyncTaskRuntimeContext {
  return {
    taskId: task.id,
    signal: task.signal,
    setStage: (stage, detail = {}) => {
      task.stage = stage;
      if (typeof detail.method === 'string') {
        task.method = detail.method;
      }
      traceScheduler('task_stage', {
        id: task.id,
        key: task.key,
        taskFor: task.taskFor,
        stage,
        ...detail,
      });
      publishSnapshot();
    },
    setMethod: method => {
      task.method = method;
      publishSnapshot();
    },
    markBatch: payload => {
      task.completedBatches = Math.max(
        task.completedBatches,
        payload.round + 1,
      );
      task.lastBatch = payload;
      task.stage = 'batch_done';
      publishSnapshot();
    },
    waitIfPaused: async () => {
      while (pauseReasons.size > 0) {
        if (task.signal?.aborted) {
          throw new SyncTaskAbortError();
        }

        task.status = 'paused';
        task.stage = `pause:${Array.from(pauseReasons).join(',')}`;
        publishSnapshot(true);
        await waitForPauseResume(task.signal);
      }

      if (task.status === 'paused') {
        task.status = 'running';
        task.stage = 'running';
        publishSnapshot(true);
      }
    },
  };
}

function pumpSyncScheduler() {
  markQueuedHoldStates();

  while (activeTasks.size < MAX_CONCURRENT_SYNC_TASKS) {
    const nextIndex = findRunnableTaskIndex();
    if (nextIndex < 0) {
      break;
    }

    const [task] = queuedTasks.splice(nextIndex, 1);
    activeTasks.set(task.id, task);
    task.status = 'running';
    task.stage = 'running';
    task.startedAt = now();

    traceScheduler('task_start', {
      id: task.id,
      key: task.key,
      taskFor: task.taskFor,
      owner: task.owner,
      entityName: task.entityName,
      rowCount: task.rowCount,
      totalBatches: task.totalBatches,
      priority: task.priority,
    });

    publishSnapshot(true);

    Promise.resolve()
      .then(() => task.runner(createTaskContext(task)))
      .then(result => {
        completeTask(task, 'success');
        task.resolve(result);
      })
      .catch(error => {
        const wasAborted =
          task.signal?.aborted || error instanceof SyncTaskAbortError;
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        completeTask(task, wasAborted ? 'aborted' : 'error', {
          error: errorMessage,
        });

        if (wasAborted) {
          task.reject(new SyncTaskAbortError(errorMessage));
        } else {
          task.reject(error);
        }
      })
      .finally(() => {
        notifyPauseWaiters();
        pumpSyncScheduler();
      });
  }

  publishSnapshot();
}

export function makeSyncTaskKey(
  taskFor: SyncTaskOptions['taskFor'],
  owner: string,
): `${SyncTaskOptions['taskFor']}-${string}` {
  return `${taskFor}-${owner}`;
}

export function inferSyncTaskPriority(
  taskFor: SyncTaskOptions['taskFor'],
): SyncTaskPriority {
  if (taskFor === 'balance') {
    return 'high';
  }

  if (taskFor === 'token' || taskFor === 'cex') {
    return 'normal';
  }

  return 'low';
}

export function isSyncTaskAbortError(error: unknown) {
  return error instanceof SyncTaskAbortError;
}

export function submitSyncTask<T>(input: {
  key: string;
  taskFor: SyncTaskOptions['taskFor'] | '@unknown';
  owner: string;
  entityName: string;
  rowCount: number;
  batchSize: number;
  totalBatches: number;
  priority?: SyncTaskPriority;
  signal?: AbortSignal;
  replaceQueuedDuplicates?: boolean;
  runner: (ctx: SyncTaskRuntimeContext) => Promise<T>;
}) {
  const priority = input.priority || 'normal';
  const id = ++taskSeq;

  if (input.replaceQueuedDuplicates !== false) {
    cancelQueuedDuplicates(input.key);
  }

  let task!: RuntimeSyncTask<T>;
  const promise = new Promise<T>((resolve, reject) => {
    task = {
      id,
      key: input.key,
      taskFor: input.taskFor,
      owner: input.owner,
      entityName: input.entityName,
      rowCount: input.rowCount,
      batchSize: input.batchSize,
      totalBatches: input.totalBatches,
      completedBatches: 0,
      priority,
      priorityValue: PRIORITY_VALUES[priority],
      status: 'queued',
      stage: 'queued',
      method: undefined,
      mergedCount: 0,
      createdAt: now(),
      runner: input.runner,
      resolve,
      reject,
      signal: input.signal,
    };
  });

  task.abortListener = () => {
    if (task.status === 'queued' || task.status === 'paused') {
      cancelQueuedTask(task, 'aborted');
      pumpSyncScheduler();
      return;
    }

    task.stage = 'abort_requested';
    publishSnapshot(true);
  };

  if (input.signal?.aborted) {
    task.status = 'aborted';
    task.reject(new SyncTaskAbortError());
    return { taskId: id, promise };
  }

  input.signal?.addEventListener('abort', task.abortListener, { once: true });
  queuedTasks.push(task);
  taskById.set(id, task);

  traceScheduler('task_queued', {
    id,
    key: task.key,
    taskFor: task.taskFor,
    owner: task.owner,
    entityName: task.entityName,
    rowCount: task.rowCount,
    totalBatches: task.totalBatches,
    priority: task.priority,
  });

  pumpSyncScheduler();

  return {
    taskId: id,
    promise,
  };
}

export function pauseSyncScheduler(reason = 'manual') {
  pauseReasons.add(reason);
  traceScheduler('pause', { reason });
  publishSnapshot(true);
}

export function resumeSyncScheduler(reason = 'manual') {
  pauseReasons.delete(reason);
  traceScheduler('resume', { reason });
  notifyPauseWaiters();
  pumpSyncScheduler();
}

export function setSyncSchedulerCriticalMode(active: boolean, reason: string) {
  if (active) {
    criticalReasons.add(reason);
    traceScheduler('critical_start', { reason });
  } else {
    criticalReasons.delete(reason);
    traceScheduler('critical_end', { reason });
  }

  notifyPauseWaiters();
  pumpSyncScheduler();
  publishSnapshot(true);
}

export function clearSyncSchedulerRecentTasks() {
  recentTasks.splice(0);
  publishSnapshot(true);
}

export function getSyncSchedulerSnapshot() {
  return buildSnapshot();
}

export const useSyncSchedulerSnapshot = () =>
  syncSchedulerStore(state => state);
