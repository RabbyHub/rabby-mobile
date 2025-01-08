import { StorageAdapater } from '@rabby-wallet/persist-store';

import { storeMigrations, serviceMigrations } from './migrations';
import {
  IServiceMigrationsByVersion,
  processMigrateService,
  processMigration,
} from './_fns';
import {
  STORE_BASED_SERVICE,
  STORE_SERVICE_MAP,
} from '@/core/storage/storeConstant';

export default function migrateApp(appStorage: StorageAdapater) {
  for (const [migrationName, migration] of Object.entries(storeMigrations)) {
    console.debug(`[Migration] Start ${migrationName}`);
    processMigration(migration, {
      appStorage: appStorage,
      loggerPrefix: `[Migration::${migrationName}]`,
    });
  }
}

export function migrateServices(services: STORE_SERVICE_MAP) {
  for (const [serviceName, migration] of Object.entries(serviceMigrations)) {
    processMigrateService(
      migration as IServiceMigrationsByVersion<STORE_BASED_SERVICE>,
      {
        service: services[serviceName],
        services,
        loggerPrefix: `[MigrateService::${serviceName}]`,
      },
    );
  }
}
