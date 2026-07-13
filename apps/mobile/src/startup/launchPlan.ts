import './launchTasks';

import { advanceStartupPhase } from './phaseRegistry';

export function startLaunchPhase(reason = 'app_mounted') {
  advanceStartupPhase('launch', reason);
}
