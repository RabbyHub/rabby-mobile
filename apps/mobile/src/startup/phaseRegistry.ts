import { traceAndroidInstant } from '@/core/utils/androidTrace';
import { markStartupRuntimePhase } from './runtimeDiagnostics';

export type StartupPhase = 'launch';

type StartupPhaseTask = {
  id: string;
  run: (reason: string) => void;
};

const phaseTasks: Record<StartupPhase, StartupPhaseTask[]> = {
  launch: [],
};

const registeredTaskIdsByPhase: Record<StartupPhase, Set<string>> = {
  launch: new Set(),
};

const advancedPhases: Record<StartupPhase, string | null> = {
  launch: null,
};

function runPhaseTask(
  phase: StartupPhase,
  task: StartupPhaseTask,
  reason: string,
) {
  traceAndroidInstant('startup.phase_task.run', {
    phase,
    id: task.id,
    reason,
  });
  task.run(reason);
}

export function registerStartupPhaseTask(
  phase: StartupPhase,
  task: StartupPhaseTask,
) {
  const registeredIds = registeredTaskIdsByPhase[phase];
  if (registeredIds.has(task.id)) {
    traceAndroidInstant('startup.phase_task.register_skipped', {
      phase,
      id: task.id,
    });
    return;
  }

  registeredIds.add(task.id);
  phaseTasks[phase].push(task);
  traceAndroidInstant('startup.phase_task.register', {
    phase,
    id: task.id,
  });

  const advancedReason = advancedPhases[phase];
  if (advancedReason) {
    runPhaseTask(phase, task, advancedReason);
  }
}

export function advanceStartupPhase(phase: StartupPhase, reason = 'unknown') {
  if (advancedPhases[phase]) {
    traceAndroidInstant('startup.phase.advance_skipped', {
      phase,
      reason,
      advancedReason: advancedPhases[phase],
    });
    return;
  }

  advancedPhases[phase] = reason;
  markStartupRuntimePhase('launch', 'phase-advanced', reason);
  traceAndroidInstant('startup.phase.advance', {
    phase,
    reason,
    taskCount: phaseTasks[phase].length,
  });

  phaseTasks[phase].forEach(task => {
    runPhaseTask(phase, task, reason);
  });
}
