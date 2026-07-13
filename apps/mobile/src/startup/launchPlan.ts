import './launchTasks';

import { registerCoreServiceLoaderCatalog } from '@/core/serviceApi/serviceLoaderCatalog';
import { advanceStartupPhase } from './phaseRegistry';

registerCoreServiceLoaderCatalog();

export function startLaunchPhase(reason = 'app_mounted') {
  advanceStartupPhase('launch', reason);
}
