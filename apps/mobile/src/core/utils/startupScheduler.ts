import { InteractionManager } from 'react-native';

import { traceAndroidInstant } from './androidTrace';
import { isNonProductionDiagnosticsEnabled } from './diagnosticEnv';
import {
  runAfterHomePostStartupReady,
  traceHomeStartupReady,
} from './homeStartupReady';
import { markStartupRuntimePhase } from '@/startup/runtimeDiagnostics';

export type StartupTaskStage =
  | 'registration'
  | 'immediate'
  | 'preSplash'
  | 'homeCritical'
  | 'homePostStartupReady'
  | 'homePostStartupIdle'
  | 'onDemand';

export type StartupTaskPriority = 'critical' | 'high' | 'normal' | 'low';

export type StartupTaskOptions = {
  label?: string;
  owner?: string;
  reason?: string;
  stage?: StartupTaskStage;
  priority?: StartupTaskPriority;
  delayMs?: number;
  fallbackMs?: number;
  idleTimeoutMs?: number;
  budgetMs?: number;
  tracePrefix?: string;
};

export type StartupTaskHandle = {
  cancel: () => void;
  run?: () => unknown;
};

type StartupDiagnosticsModule = typeof import('./startupDiagnostics');

let startupDiagnosticsModule:
  | Pick<
      StartupDiagnosticsModule,
      'beginStartupTaskDiagnostic' | 'markStartupTaskDiagnostic'
    >
  | null
  | undefined;

function getStartupDiagnosticsModule() {
  if (!isNonProductionDiagnosticsEnabled) {
    return null;
  }

  if (startupDiagnosticsModule !== undefined) {
    return startupDiagnosticsModule;
  }

  try {
    startupDiagnosticsModule = require('./startupDiagnostics');
  } catch {
    startupDiagnosticsModule = null;
  }

  return startupDiagnosticsModule;
}

function beginStartupTaskDiagnostic(options: StartupTaskOptions) {
  return (
    getStartupDiagnosticsModule()?.beginStartupTaskDiagnostic({
      label: options.label,
      owner: options.owner,
      reason: options.reason,
      stage: options.stage ?? 'immediate',
      priority: options.priority,
      budgetMs: options.budgetMs,
      fallbackMs: options.fallbackMs,
    }) ?? null
  );
}

function markStartupTaskDiagnostic(
  diagnosticId: number | null,
  event: 'fire' | 'done' | 'error' | 'cancel' | 'budget_exceeded',
  extra?: Record<string, unknown>,
) {
  getStartupDiagnosticsModule()?.markStartupTaskDiagnostic(
    diagnosticId,
    event,
    extra,
  );
}

function getTracePrefix(options: StartupTaskOptions) {
  return options.tracePrefix || 'startup_task';
}

function traceStartupTask(
  event: string,
  options: StartupTaskOptions,
  extra?: Record<string, unknown>,
) {
  if (!options.label) {
    return;
  }

  const payload = {
    label: options.label,
    owner: options.owner,
    reason: options.reason,
    stage: options.stage ?? 'immediate',
    priority: options.priority,
    budgetMs: options.budgetMs,
    ...extra,
  };
  const tracePrefix = getTracePrefix(options);
  traceAndroidInstant(`${tracePrefix}.${event}`, payload);
  traceHomeStartupReady(`${tracePrefix}_${event}`, payload);
}

function reportTaskDuration(
  options: StartupTaskOptions,
  startedAt: number,
  diagnosticId: number | null,
  extra?: Record<string, unknown>,
) {
  const durationMs = Date.now() - startedAt;
  traceStartupTask('done', options, {
    durationMs,
    ...extra,
  });

  if (options.budgetMs && durationMs > options.budgetMs) {
    traceStartupTask('budget_exceeded', options, {
      durationMs,
    });
    markStartupTaskDiagnostic(diagnosticId, 'budget_exceeded', {
      durationMs,
    });
  }
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return !!value && typeof (value as any).then === 'function';
}

function executeStartupTask<T>(
  task: () => T,
  options: StartupTaskOptions,
  diagnosticId: number | null,
): T | undefined {
  traceStartupTask('fire', options);
  markStartupTaskDiagnostic(diagnosticId, 'fire');
  const startedAt = Date.now();

  try {
    const result = task();
    if (isPromiseLike(result)) {
      result.then(
        () => {
          reportTaskDuration(options, startedAt, diagnosticId);
          markStartupTaskDiagnostic(diagnosticId, 'done', {
            durationMs: Date.now() - startedAt,
          });
        },
        (error: unknown) => {
          const durationMs = Date.now() - startedAt;
          traceStartupTask('error', options, {
            durationMs,
            error: error instanceof Error ? error.message : String(error),
          });
          markStartupTaskDiagnostic(diagnosticId, 'error', {
            durationMs,
            error: error instanceof Error ? error.message : String(error),
          });
          console.error(
            `[StartupScheduler] ${options.label || 'anonymous'}`,
            error,
          );
        },
      );
    } else {
      reportTaskDuration(options, startedAt, diagnosticId);
      markStartupTaskDiagnostic(diagnosticId, 'done', {
        durationMs: Date.now() - startedAt,
      });
    }

    return result;
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    traceStartupTask('error', options, {
      durationMs,
      error: error instanceof Error ? error.message : String(error),
    });
    markStartupTaskDiagnostic(diagnosticId, 'error', {
      durationMs,
      error: error instanceof Error ? error.message : String(error),
    });
    console.error(`[StartupScheduler] ${options.label || 'anonymous'}`, error);
    return undefined;
  }
}

function scheduleHomePostStartupIdle<T>(
  task: () => T,
  options: StartupTaskOptions,
  diagnosticId: number | null,
): StartupTaskHandle {
  let disposed = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let idleId: ReturnType<typeof requestIdleCallback> | null = null;
  let interactionHandle: ReturnType<
    typeof InteractionManager.runAfterInteractions
  > | null = null;

  const executeIdleTask = () => {
    markStartupRuntimePhase('home', 'idle', options.label || 'idle_task');
    executeStartupTask(task, options, diagnosticId);
  };

  const cancelHomePostStartupReady = runAfterHomePostStartupReady(
    () => {
      if (disposed) {
        return;
      }

      const scheduleIdleTask = () => {
        interactionHandle = InteractionManager.runAfterInteractions(() => {
          if (disposed) {
            return;
          }

          if (typeof requestIdleCallback === 'function') {
            idleId = requestIdleCallback(
              () => {
                if (!disposed) {
                  executeIdleTask();
                }
              },
              { timeout: options.idleTimeoutMs ?? 5000 },
            );
            return;
          }

          executeIdleTask();
        });
      };

      if (options.delayMs && options.delayMs > 0) {
        timeoutId = setTimeout(scheduleIdleTask, options.delayMs);
        return;
      }

      scheduleIdleTask();
    },
    {
      label: options.label,
      fallbackMs: options.fallbackMs,
    },
  );

  return {
    cancel: () => {
      disposed = true;
      cancelHomePostStartupReady();
      interactionHandle?.cancel?.();
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (idleId !== null && typeof cancelIdleCallback === 'function') {
        cancelIdleCallback(idleId);
      }
      markStartupTaskDiagnostic(diagnosticId, 'cancel');
    },
  };
}

function scheduleOnDemandStartupTask<T>(
  task: () => T,
  options: StartupTaskOptions,
  diagnosticId: number | null,
): StartupTaskHandle {
  let disposed = false;
  let fired = false;

  return {
    run: () => {
      if (disposed || fired) {
        return undefined;
      }

      fired = true;
      return executeStartupTask(task, options, diagnosticId);
    },
    cancel: () => {
      if (disposed || fired) {
        return;
      }

      disposed = true;
      markStartupTaskDiagnostic(diagnosticId, 'cancel');
    },
  };
}

export function scheduleStartupTask<T>(
  task: () => T,
  options: StartupTaskOptions = {},
): T | StartupTaskHandle | undefined {
  const stage = options.stage ?? 'immediate';
  traceStartupTask('schedule', options);
  const diagnosticId = beginStartupTaskDiagnostic({
    ...options,
    stage,
  });

  if (stage === 'homePostStartupReady') {
    const cancelHomePostStartupReady = runAfterHomePostStartupReady(
      () => {
        executeStartupTask(task, options, diagnosticId);
      },
      {
        label: options.label,
        fallbackMs: options.fallbackMs,
      },
    );

    return {
      cancel: () => {
        cancelHomePostStartupReady();
        markStartupTaskDiagnostic(diagnosticId, 'cancel');
      },
    };
  }

  if (stage === 'homePostStartupIdle') {
    return scheduleHomePostStartupIdle(task, options, diagnosticId);
  }

  if (stage === 'onDemand') {
    return scheduleOnDemandStartupTask(task, options, diagnosticId);
  }

  return executeStartupTask(task, options, diagnosticId);
}

export function runOnDemandStartupTask<T>(
  task: () => T,
  options: StartupTaskOptions = {},
): T | undefined {
  const handle = scheduleStartupTask(task, {
    ...options,
    stage: 'onDemand',
  }) as StartupTaskHandle;

  return handle.run?.() as T | undefined;
}
