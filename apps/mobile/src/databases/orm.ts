import { DataSource, DataSourceOptions } from 'typeorm/browser';

import { TokenItemEntity } from '@/databases/entities/tokenitem';
import { NFTItemEntity } from '@/databases/entities/nftItem';
import { SQLite } from '@/core/databases/exports';
import { HistoryItemEntity } from './entities/historyItem';

const dbOptions: DataSourceOptions = {
  type: 'react-native',
  database: 'rabby-app.db',
  location: 'default',
  // logging: ['error', 'query', 'schema'],
  logging: [],
  synchronize: true,
  driver: SQLite,
  entityPrefix: 'rabby_',
  entities: [TokenItemEntity, NFTItemEntity, HistoryItemEntity],
  maxQueryExecutionTime: 10000,
};
const appDataSource = new DataSource({ ...dbOptions });

SQLite.DEBUG(false);

const appDataSourceInitRef = {
  current: null as null | Promise<DataSource>,
};

export async function initializeAppDataSource() {
  if (!appDataSourceInitRef.current) {
    appDataSourceInitRef.current = appDataSource.initialize();
    await appDataSourceInitRef.current;
    if (__DEV__) {
      await appDataSource.dropDatabase();
      await Promise.allSettled([TokenItemEntity.clear()]);
    }

    await appDataSource.synchronize();
  }

  return appDataSourceInitRef.current;
}

initializeAppDataSource().catch(err => {
  console.log('🔍 CUSTOM_LOGGER:=>: initializeAppDataSource error', err);
});

// const hasFirstInitializedRef = { current: false };
export async function prepareAppDataSource() {
  await initializeAppDataSource();

  if (!appDataSource.isInitialized) {
    console.debug('[prepareAppDataSource::] initializing appDataSource');
    await appDataSource.initialize();
    console.debug('[prepareAppDataSource::] initialized appDataSource');
  }

  return appDataSource;
}

// export const appDBRef = {
//   current: null as null | MakeSurePromise<ReturnType<typeof createConnection>>
// }

// async function onAppDbReady() {
//   if (!appDBRef.current) {
//     appDBRef.current = createConnection({ ...dbOptions });

//     // always reset once in dev mode
//     if (__DEV__) {
//       appDBRef.current.then(appDb => {
//         appDb.dropDatabase();
//         appDb.initialize();
//       });
//     }

//     console.warn('[onAppDbReady] initialized');
//   }

//   if (__DEV__) {
//     return appDBRef.current.catch(err => {
//       console.error(err);
//       throw err;
//     })
//   }

//   return appDBRef.current;
// }
