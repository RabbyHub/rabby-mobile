import './launchTasks';

import { registerCoreServiceLoaderCatalog } from '@/core/serviceApi/serviceLoaderCatalog';
import { advanceStartupPhase } from './phaseRegistry';
import { markStartupModuleLoaded } from './runtimeDiagnostics';
import { startStartupPerformanceRecording } from './performance/recorder';

startStartupPerformanceRecording('launch_plan_module_evaluation');
registerCoreServiceLoaderCatalog();
markStartupModuleLoaded({
  name: 'startup/launchPlan',
  group: 'launch',
  taskStage: 'registration',
  reason: 'static launch orchestration module',
});

export function startLaunchPhase(reason = 'app_mounted') {
  startStartupPerformanceRecording(reason);
  advanceStartupPhase('launch', reason);
}
