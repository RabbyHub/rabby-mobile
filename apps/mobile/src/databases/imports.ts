import RNHelpers from '@/core/native/RNHelpers';
import { DataSource, DataSourceOptions } from 'typeorm/browser';
// import * as Sentry from '@sentry/react-native';

const appDataSourceInitRef = {
  current: null as null | Promise<DataSource>,
};

export async function initializeAppDataSource(
  /**
   * @description when no dbOptions are provided, will not initialize the app data source but
   * try to use the pre-existing one
   */
  dbOptions?: DataSourceOptions,
) {
  if (dbOptions) {
    const appDataSource = new DataSource({ ...dbOptions });

    appDataSourceInitRef.current = appDataSource.initialize();
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

        // enable WAL mode
        appDataSource.query('PRAGMA journal_mode=WAL');

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

// export async function reInitAppDataSource(dbOptions?: DataSourceOptions) {
//   if (appDataSourceInitRef.current) {
//     const appDataSource = await appDataSourceInitRef.current;

//     await appDataSource.destroy();
//     appDataSourceInitRef.current = null;

//     // await initializeAppDataSource(dbOptions);
//   }
// }

export async function prepareAppDataSource() {
  const appDataSource = await initializeAppDataSource();

  if (!appDataSource.isInitialized) {
    console.debug('[prepareAppDataSource::] initializing appDataSource');
    await appDataSource.initialize();
    console.debug('[prepareAppDataSource::] initialized appDataSource');
  }

  return appDataSource;
}

export async function clearAppDataSource() {
  const appDataSource = await prepareAppDataSource();

  // await appDataSource.dropDatabase();
  await Promise.allSettled(
    appDataSource.entityMetadatas.map(async entityMetadata => {
      const repo = appDataSource.getRepository(entityMetadata.target);

      return repo.clear();
    }),
  );
  await appDataSource.query('VACUUM');
}

export async function dropAppDataSourceAndQuitApp() {
  const appDataSource = await prepareAppDataSource();

  await appDataSource.dropDatabase();
  await appDataSource.query('VACUUM');
  // it will cause crash on iOS production
  RNHelpers.forceExitApp();
}

export async function exp_dropAndResyncDataSource(
  dbOptions?: DataSourceOptions,
) {
  let appDataSource = await appDataSourceInitRef.current;

  if (!appDataSource || !appDataSource.isInitialized) {
    console.error(
      '[exp_dropAndResyncDataSource] appDataSource not initialized',
    );
    return;
  }

  // @important: set appDataSourceInitRef.current to a new Promise, then all calling to `await initializeAppDataSource()`;
  // will wait for the new Promise to resolve
  appDataSourceInitRef.current = new Promise<DataSource>(
    async (resolve, reject) => {
      try {
        await appDataSource.dropDatabase();
        await appDataSource.query('VACUUM');
        console.debug('[exp_dropAndResyncDataSource] debug:: vacuum finished');
        // await removeDBFiles();

        // disconnet
        await appDataSource.destroy();
      } catch (error) {
        // don't print error, because it's expected to be large
        console.error('[exp_dropAndResyncDataSource] error');
        // maybe there's error occurred, but we ignore it and continue
      }

      // reconnect, `initializeAppDataSource(dbOptions)` will provide a new connection
      await initializeAppDataSource(dbOptions).then(resolve).then(reject);
    },
  );
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
