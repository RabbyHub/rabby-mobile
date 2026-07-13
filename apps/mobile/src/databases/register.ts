import { runOnDemandStartupTask } from '@/core/utils/startupScheduler';
import { STARTUP_TASKS } from '@/core/utils/startupTaskManifest';
import { observeStartupModuleLoad } from '@/startup/runtimeDiagnostics';
import { registerAppDataSourceLoader } from './registry';

registerAppDataSourceLoader(
  async reason => {
    await runOnDemandStartupTask(
      async () => {
        const { startAppDataSource } = await observeStartupModuleLoad(
          {
            name: 'databases/orm',
            group: 'database',
            taskStage: 'onDemand',
            reason,
          },
          () => import('./orm'),
        );
        await startAppDataSource(reason);
      },
      {
        ...STARTUP_TASKS.databaseAppDataSourceLoader,
        reason: `${STARTUP_TASKS.databaseAppDataSourceLoader.reason}; trigger=${reason}`,
      },
    );
  },
  {
    owner: 'databases/orm',
  },
);
