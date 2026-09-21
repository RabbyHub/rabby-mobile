import 'reflect-metadata';

import type { DataSourceOptions } from 'typeorm/browser';

import { APP_DB_PREFIX } from '../../src/databases/constant';
import { initializeConfiguredDataSource } from '../../src/databases/dataSourceLifecycle';
import { ALL_ORM_ENTITIES } from '../../src/databases/entities';
import { getMigrations } from '../../src/databases/migrations';
import { nodeMemorySqliteTypeormDriver } from './nodeSqliteTypeormDriver';

const memoryDataSourceOptions: DataSourceOptions = {
  type: 'react-native',
  database: ':memory:',
  location: ':memory:',
  logging: false,
  synchronize: false,
  driver: nodeMemorySqliteTypeormDriver,
  entityPrefix: APP_DB_PREFIX,
  entities: Object.values(ALL_ORM_ENTITIES),
  migrations: getMigrations(),
};

export function createMemoryAppDataSource() {
  return initializeConfiguredDataSource(memoryDataSourceOptions, {
    journalMode: 'MEMORY',
    migrationFailurePolicy: 'throw',
  });
}
