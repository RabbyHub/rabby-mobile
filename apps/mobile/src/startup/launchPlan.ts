import './launchTasks';

import { registerCoreServiceLoaderCatalog } from '@/core/serviceApi/serviceLoaderCatalog';
import { advanceStartupPhase } from './phaseRegistry';
import { markStartupModuleLoaded } from './runtimeDiagnostics';

registerCoreServiceLoaderCatalog();
markStartupModuleLoaded({
  name: 'startup/launchPlan',
  group: 'launch',
  taskStage: 'registration',
  reason: 'static launch orchestration module',
});

export function startLaunchPhase(reason = 'app_mounted') {
  advanceStartupPhase('launch', reason);
}
