import { DataSource, DataSourceOptions } from 'typeorm/browser';

type MigrationFailurePolicy = 'continue' | 'throw';

type InitializeConfiguredDataSourceOptions = {
  journalMode?: 'WAL' | 'MEMORY' | false;
  migrationFailurePolicy?: MigrationFailurePolicy;
};

export async function initializeConfiguredDataSource(
  dataSourceOptions: DataSourceOptions,
  options: InitializeConfiguredDataSourceOptions = {},
) {
  const { journalMode = 'WAL', migrationFailurePolicy = 'continue' } = options;
  const dataSource = new DataSource({ ...dataSourceOptions });

  await dataSource.initialize();
  console.debug(
    '[initializeConfiguredDataSource] initialized, will run migrations',
  );

  try {
    const migrations = await dataSource.runMigrations({
      transaction: 'each',
      fake: false,
    });
    console.debug(
      `[initializeConfiguredDataSource] runMigrations finish: ${migrations.length}`,
    );
  } catch (error) {
    console.error(
      '[initializeConfiguredDataSource] runMigrations error',
      error,
    );
    if (migrationFailurePolicy === 'throw') {
      throw error;
    }
  }

  try {
    // Do not drop the database when the schema changes. Migrations and the
    // existing post-migration synchronization own that upgrade path.
    await dataSource.synchronize(false);
  } catch (error) {
    console.error('[initializeConfiguredDataSource] synchronize error', error);
    throw error;
  }

  if (journalMode) {
    await dataSource.query(`PRAGMA journal_mode=${journalMode}`);
  }

  return dataSource;
}
