import { registerAppDataSourceLoader } from './registry';

registerAppDataSourceLoader(
  async reason => {
    const { startAppDataSource } = await import('./orm');
    await startAppDataSource(reason);
  },
  {
    owner: 'databases/orm',
  },
);
