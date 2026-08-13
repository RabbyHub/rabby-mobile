import { runStartupTask } from '@/core/utils/startupScheduler';
import { STARTUP_TASKS } from '@/core/utils/startupTaskManifest';
import {
  createLaunchTaskDefinitions,
  registerLaunchTaskDefinitions,
} from './launchTaskDefinitions';
import { registerStartupPhaseTask } from './phaseRegistry';
import { markStartupModuleLoaded } from './runtimeDiagnostics';

markStartupModuleLoaded({
  name: 'startup/launchTasks',
  group: 'launch',
  taskStage: 'registration',
  reason: 'static launch task registry',
});

registerLaunchTaskDefinitions(createLaunchTaskDefinitions(), {
  registerPhaseTask: registerStartupPhaseTask,
  scheduleTask: (run, taskKey) => {
    runStartupTask(run, STARTUP_TASKS[taskKey]);
  },
});
