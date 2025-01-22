import { DataSource, DataSourceOptions } from 'typeorm/browser';
import { TokenItemEntity } from './entities/tokenitem';
import { BalanceEntity } from './entities/balance';
import { NFTItemEntity } from './entities/nftItem';
import { PortocolItemEntity } from './entities/portocolItem';
// import * as Sentry from '@sentry/react-native';

const appDataSourceInitRef = {
  current: null as null | Promise<DataSource>,
};

export async function initializeAppDataSource(dbOptions?: DataSourceOptions) {
  if (dbOptions) {
    const appDataSource = new DataSource({ ...dbOptions });

    appDataSourceInitRef.current = appDataSource.initialize();
    // if (__DEV__) {
    //   await appDataSource.dropDatabase();
    //   await Promise.allSettled([
    //     TokenItemEntity.clear(),
    //     BalanceEntity.clear(),
    //     NFTItemEntity.clear(),
    //     PortocolItemEntity.clear(),
    //   ]);
    // }

    appDataSourceInitRef.current = appDataSourceInitRef.current.then(
      async as => {
        console.debug(
          `[initializeAppDataSource] initialized, will runMigrations`,
        );
        await as
          .runMigrations({
            transaction: 'each',
            fake: false,
          })
          .then(migrations => {
            console.debug(
              `[initializeAppDataSource] runMigrations finish: ${migrations.length}`,
            );
          })
          .catch(error => {
            console.error(
              '[initializeAppDataSource] runMigrations error',
              error,
            );
          });

        try {
          // don't drop database, if schema was changed, we need migrate rather than drop
          await as.synchronize(false);
        } catch (error) {
          console.error('[initializeAppDataSource] error', error);
          throw error;
        }

        return as;
      },
    );
  } else if (!appDataSourceInitRef.current) {
    const errMsg =
      'initializeAppDataSource: app data source has not start initialization';
    const err = new Error(errMsg);
    throw err;
    // Sentry.captureException(err)
  }

  await appDataSourceInitRef.current;

  return appDataSourceInitRef.current;
}

export async function prepareAppDataSource() {
  const appDataSource = await initializeAppDataSource();

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
