import { startSubscribeLangChange } from '@/hooks/lang';
import { runStartupTask } from '@/core/utils/store';
import { STARTUP_TASKS } from '@/core/utils/startupTaskManifest';

import { registerStartupPhaseTask } from './phaseRegistry';

registerStartupPhaseTask('launch', {
  id: STARTUP_TASKS.bootstrapI18nReady.label,
  run: () => {
    runStartupTask(
      () => startSubscribeLangChange(),
      STARTUP_TASKS.bootstrapI18nReady,
    );
  },
});
