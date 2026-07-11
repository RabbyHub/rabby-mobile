import { runOnDemandStartupTask } from '@/core/utils/startupScheduler';
import { STARTUP_TASKS } from '@/core/utils/startupTaskManifest';
import { registerAppDataSourceLoader } from './registry';

registerAppDataSourceLoader(
  async reason => {
    await runOnDemandStartupTask(
      async () => {
        const { startAppDataSource } = await import('./orm');
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
