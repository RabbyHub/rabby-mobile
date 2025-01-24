import { DataSourceOptions } from 'typeorm/browser';

import { TokenItemEntity } from '@/databases/entities/tokenitem';
import { NFTItemEntity } from '@/databases/entities/nftItem';
import { HistoryItemEntity } from './entities/historyItem';
import { PortocolItemEntity } from './entities/portocolItem';
import { SQLite } from '@/core/databases/exports';
import { getMigrations } from './migrations';
import { APP_DB_PREFIX, getRabbyAppDbName } from './constant';
import {
  exp_dropAndResyncDataSource,
  initializeAppDataSource,
} from './imports';
import { SwapItemEntity } from './entities/swapitem';
import { BalanceEntity } from './entities/balance';
import { abortAllSyncTasks } from './sync/_task';

const dbOptions: DataSourceOptions = {
  type: 'react-native',
  database: getRabbyAppDbName(),
  /**
   * @notice set to 'default' to use the default database path on iOS
   * @see https://github.com/boltcode-js/react-native-sqlite-storage?tab=readme-ov-file#opening-a-database
   */
  location: 'default',
  // "query" | "schema" | "error" | "warn" | "info" | "log" | "migration"
  logging: __DEV__
    ? ['error', /* 'query', 'schema',*/ 'migration']
    : ['error', 'migration'],
  // logger: isNonPublicProductionEnv ? 'file' : 'advanced-console',
  logger: __DEV__ ? 'advanced-console' : 'simple-console',
  // don't synchronize on initial load, we will handle it manually
  synchronize: false,
  driver: SQLite,
  entityPrefix: APP_DB_PREFIX,
  entities: [
    TokenItemEntity,
    NFTItemEntity,
    HistoryItemEntity,
    SwapItemEntity,
    BalanceEntity,
    PortocolItemEntity,
  ],
  maxQueryExecutionTime: 10000,
  // only enable file logger in non-public production env, avoid leaking user's sensitive info
  // migrationsRun: true,
  migrations: getMigrations(),
};

initializeAppDataSource(dbOptions).catch(err => {
  console.log('initializeAppDataSource error', err);
});

export async function exp_reConnectAppDataSource() {
  abortAllSyncTasks();

  return exp_dropAndResyncDataSource(dbOptions);
}
