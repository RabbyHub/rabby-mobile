import './launchTasks';

import { registerCoreServiceLoaderCatalog } from '@/core/serviceApi/serviceLoaderCatalog';
import { advanceStartupPhase } from './phaseRegistry';
import { createLaunchPhaseController } from './launchPhaseController';
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

const launchPhaseController = createLaunchPhaseController({
  advanceStartupPhase,
  startPerformanceRecording: startStartupPerformanceRecording,
});

export const startLaunchPhase = launchPhaseController.startLaunchPhase;
