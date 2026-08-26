import RNHelpers from '@/core/native/RNHelpers';
import { DataSource, DataSourceOptions } from 'typeorm/browser';
import RNFS from '@rabby-wallet/react-native-fs';
import { getRabbyAppDbPath } from './constant';
import {
  ensureAppDataSourceLoaderStarted,
  getAppDataSourceRegistrySnapshot,
  resetAppDataSourceLoaderState,
} from './registry';
import { traceStartupDiagnostic } from '@/core/utils/startupDiagnostics';
import { initializeConfiguredDataSource } from './dataSourceLifecycle';
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
    appDataSourceInitRef.current = initializeConfiguredDataSource(dbOptions);
  } else if (!appDataSourceInitRef.current) {
    const startedAt = Date.now();
    traceStartupDiagnostic('db', 'app_data_source_loader_start', {
      registry: getAppDataSourceRegistrySnapshot(),
    });
    await ensureAppDataSourceLoaderStarted('initialize_without_options');
    traceStartupDiagnostic('db', 'app_data_source_loader_end', {
      durationMs: Date.now() - startedAt,
      registry: getAppDataSourceRegistrySnapshot(),
    });

    if (!appDataSourceInitRef.current) {
      const errMsg =
        'initializeAppDataSource: app data source loader did not start initialization';
      const err = new Error(errMsg);
      throw err;
      // Sentry.captureException(err)
    }
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
  const { clearAssetSyncPersistenceQueue } = await import(
    '@/perfs/assetSyncPersistenceQueue'
  );
  await clearAssetSyncPersistenceQueue();
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

async function removeAppDbFilesBestEffort() {
  const dbPath = getRabbyAppDbPath();
  await Promise.allSettled(
    [dbPath, `${dbPath}-shm`, `${dbPath}-wal`].map(async filePath => {
      if (await RNFS.exists(filePath)) {
        await RNFS.unlink(filePath);
      }
    }),
  );
}

function forceExitAppSoon(delayMs = 100) {
  setTimeout(() => {
    RNHelpers.forceExitApp();
  }, delayMs);
}

export async function dropAppDataSourceAndQuitApp({
  exitDelayMs = 100,
}: {
  exitDelayMs?: number;
} = {}) {
  let appDataSource: DataSource | null = null;

  try {
    const { clearAssetSyncPersistenceQueue } = await import(
      '@/perfs/assetSyncPersistenceQueue'
    );
    await clearAssetSyncPersistenceQueue();
    appDataSource = await prepareAppDataSource();
    await appDataSource.dropDatabase();
    await appDataSource.query('VACUUM');
  } catch (error) {
    console.error('[dropAppDataSourceAndQuitApp] clear database failed', error);
  } finally {
    try {
      if (appDataSource?.isInitialized) {
        await appDataSource.destroy();
      }
    } catch (error) {
      console.error('[dropAppDataSourceAndQuitApp] destroy failed', error);
    }
    appDataSourceInitRef.current = null;
    resetAppDataSourceLoaderState();
    removeAppDbFilesBestEffort().catch(error => {
      console.error(
        '[dropAppDataSourceAndQuitApp] remove db files failed',
        error,
      );
    });
    // it will cause crash on iOS production
    forceExitAppSoon(exitDelayMs);
  }
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
