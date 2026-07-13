import { isNonProductionDiagnosticsEnabled } from '@/core/utils/diagnosticEnv';

export type StartupRuntimePhase = 'bootstrap' | 'launch' | 'home';

export type StartupRuntimeMilestone =
  | 'module-evaluation'
  | 'phase-advanced'
  | 'mounted'
  | 'ready'
  | 'post-startup-ready'
  | 'idle';

export type StartupModuleGroup = 'launch' | 'setup' | 'service' | 'database';

export type StartupModuleLoadStatus = 'loading' | 'loaded' | 'error';

export type StartupModuleLoadRecord = {
  id: number;
  name: string;
  group: StartupModuleGroup;
  taskStage: string;
  reason: string;
  status: StartupModuleLoadStatus;
  requestedAt: number;
  endedAt: number;
  durationMs: number;
  error: string;
};

export type StartupRuntimeDiagnosticsSnapshot = {
  enabled: boolean;
  startedAt: number;
  updatedAt: number;
  phase: StartupRuntimePhase;
  milestone: StartupRuntimeMilestone;
  phaseReason: string;
  phaseChangedAt: number;
  loadingCount: number;
  loadedCount: number;
  errorCount: number;
  modules: StartupModuleLoadRecord[];
};

type StartupModuleLoadOptions = {
  name: string;
  group: StartupModuleGroup;
  taskStage: string;
  reason?: string;
};

const MAX_MODULE_RECORDS = 48;
const PHASE_ORDER: Record<
  `${StartupRuntimePhase}:${StartupRuntimeMilestone}`,
  number
> = {
  'bootstrap:module-evaluation': 0,
  'bootstrap:phase-advanced': 1,
  'bootstrap:mounted': 2,
  'bootstrap:ready': 3,
  'bootstrap:post-startup-ready': 4,
  'bootstrap:idle': 5,
  'launch:module-evaluation': 10,
  'launch:phase-advanced': 11,
  'launch:mounted': 12,
  'launch:ready': 13,
  'launch:post-startup-ready': 14,
  'launch:idle': 15,
  'home:module-evaluation': 20,
  'home:phase-advanced': 21,
  'home:mounted': 22,
  'home:ready': 23,
  'home:post-startup-ready': 24,
  'home:idle': 25,
};

const enabled = isNonProductionDiagnosticsEnabled;
const startedAt = enabled ? Date.now() : 0;
const moduleRecords = enabled
  ? new Map<string, StartupModuleLoadRecord>()
  : null;
const listeners = enabled ? new Set<() => void>() : null;

let nextRecordId = 0;
let updatedAt = startedAt;
let phase: StartupRuntimePhase = 'bootstrap';
let milestone: StartupRuntimeMilestone = 'module-evaluation';
let phaseReason = 'runtime_diagnostics_loaded';
let phaseChangedAt = startedAt;

function publish() {
  if (!listeners) {
    return;
  }

  updatedAt = Date.now();
  listeners.forEach(listener => {
    try {
      listener();
    } catch {
      // Diagnostics must never affect startup behavior.
    }
  });
}

function pruneModuleRecords() {
  if (!moduleRecords || moduleRecords.size <= MAX_MODULE_RECORDS) {
    return;
  }

  const removable = [...moduleRecords.entries()]
    .filter(([, record]) => record.status !== 'loading')
    .sort((a, b) => a[1].id - b[1].id);

  while (moduleRecords.size > MAX_MODULE_RECORDS && removable.length > 0) {
    const entry = removable.shift();
    if (entry) {
      moduleRecords.delete(entry[0]);
    }
  }
}

function getPhaseOrder(
  nextPhase: StartupRuntimePhase,
  nextMilestone: StartupRuntimeMilestone,
) {
  return PHASE_ORDER[`${nextPhase}:${nextMilestone}`];
}

export function markStartupRuntimePhase(
  nextPhase: StartupRuntimePhase,
  nextMilestone: StartupRuntimeMilestone,
  reason = 'unknown',
) {
  if (!enabled) {
    return;
  }

  if (
    getPhaseOrder(nextPhase, nextMilestone) < getPhaseOrder(phase, milestone)
  ) {
    return;
  }

  if (
    phase === nextPhase &&
    milestone === nextMilestone &&
    phaseReason === reason
  ) {
    return;
  }

  phase = nextPhase;
  milestone = nextMilestone;
  phaseReason = reason;
  phaseChangedAt = Date.now();
  publish();
}

export function markStartupModuleLoaded(options: StartupModuleLoadOptions) {
  if (
    !enabled ||
    !moduleRecords ||
    moduleRecords.get(options.name)?.status === 'loaded'
  ) {
    return;
  }

  const timestamp = Date.now();
  moduleRecords.set(options.name, {
    id: ++nextRecordId,
    name: options.name,
    group: options.group,
    taskStage: options.taskStage,
    reason: options.reason || '',
    status: 'loaded',
    requestedAt: timestamp,
    endedAt: timestamp,
    durationMs: 0,
    error: '',
  });
  pruneModuleRecords();
  publish();
}

export function observeStartupModuleLoad<T>(
  options: StartupModuleLoadOptions,
  loader: () => Promise<T>,
): Promise<T> {
  if (!enabled) {
    return loader();
  }

  if (!moduleRecords) {
    return loader();
  }

  const current = moduleRecords.get(options.name);
  if (current?.status === 'loaded' || current?.status === 'loading') {
    return loader();
  }

  const requestedAt = Date.now();
  const record: StartupModuleLoadRecord = {
    id: ++nextRecordId,
    name: options.name,
    group: options.group,
    taskStage: options.taskStage,
    reason: options.reason || '',
    status: 'loading',
    requestedAt,
    endedAt: 0,
    durationMs: 0,
    error: '',
  };
  moduleRecords.set(options.name, record);
  pruneModuleRecords();
  publish();

  let result: Promise<T>;
  try {
    result = loader();
  } catch (error) {
    record.status = 'error';
    record.endedAt = Date.now();
    record.durationMs = record.endedAt - requestedAt;
    record.error = error instanceof Error ? error.message : String(error);
    publish();
    throw error;
  }

  return result.then(
    value => {
      record.status = 'loaded';
      record.endedAt = Date.now();
      record.durationMs = record.endedAt - requestedAt;
      publish();
      return value;
    },
    error => {
      record.status = 'error';
      record.endedAt = Date.now();
      record.durationMs = record.endedAt - requestedAt;
      record.error = error instanceof Error ? error.message : String(error);
      publish();
      throw error;
    },
  );
}

export function getStartupRuntimeDiagnosticsSnapshot(): StartupRuntimeDiagnosticsSnapshot {
  if (!enabled || !moduleRecords) {
    return {
      enabled: false,
      startedAt: 0,
      updatedAt: 0,
      phase: 'bootstrap',
      milestone: 'module-evaluation',
      phaseReason: '',
      phaseChangedAt: 0,
      loadingCount: 0,
      loadedCount: 0,
      errorCount: 0,
      modules: [],
    };
  }

  const modules = [...moduleRecords.values()].sort((a, b) => b.id - a.id);

  return {
    enabled,
    startedAt,
    updatedAt,
    phase,
    milestone,
    phaseReason,
    phaseChangedAt,
    loadingCount: modules.filter(record => record.status === 'loading').length,
    loadedCount: modules.filter(record => record.status === 'loaded').length,
    errorCount: modules.filter(record => record.status === 'error').length,
    modules,
  };
}

export function subscribeStartupRuntimeDiagnostics(listener: () => void) {
  if (!enabled || !listeners) {
    return () => undefined;
  }

  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
