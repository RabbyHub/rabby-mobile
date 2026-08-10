import { preloadTransactionHotNavigator } from '@/perfs/preloads';
import { runStartupTask } from '@/core/utils/startupScheduler';
import { STARTUP_TASKS } from '@/core/utils/startupTaskManifest';

export function scheduleSingleAddressTransactionNavigatorWarmup() {
  return runStartupTask(
    preloadTransactionHotNavigator,
    STARTUP_TASKS.singleAddressTransactionNavigatorWarmup,
  );
}
