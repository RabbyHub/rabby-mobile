import { STARTUP_TASKS } from '@/core/utils/startupTaskManifest';
import {
  runStartupTask,
  type StartupTaskHandle,
} from '@/core/utils/startupScheduler';

export function scheduleSingleAddressHistoryBadgeWarmup(
  task: () => void | Promise<void>,
) {
  return runStartupTask(task, STARTUP_TASKS.singleAddressHistoryBadgeWarmup) as
    | StartupTaskHandle
    | undefined;
}
