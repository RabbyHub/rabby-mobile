import {
  APP_STORE_NAMES,
  GET_SERVICE_BY_NAME,
  MIGRATABLE_STORE_SERVICE,
  STORE_BASED_SERVICE,
  STORE_SERVICE_MAP,
} from '@/core/storage/storeConstant';
import {
  preferenceStoreMigration,
  preferenceServiceMigration,
} from './preference.migration';
import { contactBookServiceMigration } from './contactBook.migration';
import { dappServiceMigration } from './dapps.migration';
import { IStoreMigrations, processMigration } from './_fns.store';
import {
  IServiceMigrationsByVersion,
  processMigrateService,
} from './_fns.service';
import { StorageAdapater } from '@rabby-wallet/persist-store';

export const storeMigrations: {
  [P in APP_STORE_NAMES]?: IStoreMigrations;
} = {
  preference: preferenceStoreMigration,
};

export function migrateAppStorage(appStorage: StorageAdapater) {
  for (let [migrationName, migration] of Object.entries(storeMigrations)) {
    console.debug(`[MigrateAppStorage] Migration Start ${migrationName}`);
    processMigration(migrationName as APP_STORE_NAMES, migration, {
      appStorage: appStorage,
      loggerPrefix: `[MigrateAppStorage::${migrationName}]`,
    });
  }
}

export const serviceMigrations: {
  [P in MIGRATABLE_STORE_SERVICE]?: IServiceMigrationsByVersion<
    GET_SERVICE_BY_NAME<P>
  >;
} = {
  preference: preferenceServiceMigration,
  contactBook: contactBookServiceMigration,
  dapps: dappServiceMigration,
};

export function migrateServices(services: STORE_SERVICE_MAP) {
  for (const [serviceName, migration] of Object.entries(serviceMigrations)) {
    processMigrateService(
      serviceName as MIGRATABLE_STORE_SERVICE,
      migration as IServiceMigrationsByVersion<STORE_BASED_SERVICE>,
      {
        service: services[serviceName],
        services,
        loggerPrefix: `[MigrateService::${serviceName}]`,
      },
    );
  }
}
