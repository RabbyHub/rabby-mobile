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
import { whitelistServiceMigration } from './whitelist.migration';
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
  whitelist: whitelistServiceMigration,
};

export function migrateServices(services: STORE_SERVICE_MAP) {
  for (const [serviceName, migration] of Object.entries(serviceMigrations)) {
    const service = services[serviceName as MIGRATABLE_STORE_SERVICE];
    if (!service) {
      continue;
    }
    migrateService(
      serviceName as MIGRATABLE_STORE_SERVICE,
      service as STORE_BASED_SERVICE,
      services,
    );
  }
}

export function migrateService<U extends MIGRATABLE_STORE_SERVICE>(
  serviceName: U,
  service: GET_SERVICE_BY_NAME<U>,
  services: Partial<STORE_SERVICE_MAP> = {},
) {
  const migration = serviceMigrations[serviceName];
  if (!migration) {
    return;
  }

  return processMigrateService(
    serviceName,
    migration as IServiceMigrationsByVersion<GET_SERVICE_BY_NAME<U>>,
    {
      service,
      services: {
        ...services,
        [serviceName]: service,
      } as STORE_SERVICE_MAP,
      loggerPrefix: `[MigrateService::${serviceName}]`,
    },
  );
}
