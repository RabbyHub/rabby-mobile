import { startSubscribeLangChange } from '@/hooks/lang';
import { runStartupTask } from '@/core/utils/store';
import { STARTUP_TASKS } from '@/core/utils/startupTaskManifest';

export function startLaunchPhase() {
  runStartupTask(
    () => startSubscribeLangChange(),
    STARTUP_TASKS.bootstrapI18nReady,
  );
}

