import semver from 'semver';
import * as Sentry from '@sentry/react-native';

import { APP_VERSIONS } from '@/constant';
import { StorageAdapater } from '@rabby-wallet/persist-store';
import { bizNumberUtils } from '@rabby-wallet/biz-utils';
import {
  GET_SERVICE_BY_NAME,
  MIGRATABLE_STORE_SERVICE,
  STORE_BASED_SERVICE,
  STORE_SERVICE_MAP,
} from '@/core/storage/storeConstant';

const APP_VER = APP_VERSIONS.fromJs;

type DateLikeVer =
  `${number}${number}${number}${number}${number}${number}${number}${number}-${number}${number}${number}${number}${number}${number}`;

type StoreMigrator = (data: IMigrationStorageContext) => any;

type IStoreMigration<T = any> = {
  minAppVer?: string;
  migrator: StoreMigrator;
};

type IStoreMigrations = {
  [dateVer in DateLikeVer]:
    | StoreMigrator
    | {
        minAppVer?: string;
        migrator: StoreMigrator;
      };
};

type IMigrationStorageContext = {
  appStorage: StorageAdapater;
  loggerPrefix: string;
  mockData?: any;
};

export function makeMigration(migration: IStoreMigrations): IStoreMigrations {
  return migration;
}

export function processMigration(
  migration: IStoreMigrations,
  context: IMigrationStorageContext,
) {
  const result = {
    successMigrationCount: 0,
    failedMigrationCount: 0,
  };

  const migrationByVers = Object.keys(migration).sort((a, b) =>
    bizNumberUtils.coerceInteger(a) < bizNumberUtils.coerceInteger(b) ? -1 : 1,
  );

  // notice: semver.compare would cause infinite loop issue on hermes of react-native@0.72
  // const migrationByVers = Object.keys(migration).sort(([a], [b]) => semver.compare(a, b));

  for (const verDesc of migrationByVers) {
    const formattedMigrator: IStoreMigration =
      typeof migration[verDesc] === 'function'
        ? {
            migrator: migration[verDesc],
          }
        : migration[verDesc];

    if (
      formattedMigrator.minAppVer &&
      !semver.satisfies(APP_VER, formattedMigrator.minAppVer)
    ) {
      console.debug(`[Migration] Skip migration ${verDesc}`);
      continue;
    }

    try {
      formattedMigrator.migrator(context);
      result.successMigrationCount++;
    } catch (error) {
      console.error(`[Migration] Failed migration ${verDesc}`, error);
      Sentry.captureException(error);
      result.failedMigrationCount++;
    }
  }

  return result;
}

type IServiceMigrate<T extends STORE_BASED_SERVICE> = (
  data: IMigrateServiceContext<T> & {
    _trimLegacyData(fn: Function): void;
  },
) => void;
type IServiceAfterMigrate<T extends STORE_BASED_SERVICE> = (
  data: IMigrateServiceContext<T> & {
    _trimLegacyData(fn: Function): void;
  },
) => void;

type IServiceMigration<T extends STORE_BASED_SERVICE> = {
  minAppVer?: string;
  migrate: IServiceMigrate<T>;
  afterMigrate?: IServiceAfterMigrate<T>;
  migrateFailed?: IServiceMigrate<T>;
};

export type IServiceMigrationInput<T extends STORE_BASED_SERVICE> =
  | IServiceMigrate<T>
  | IServiceMigration<T>;

export type IServiceMigrationsByVersion<T extends STORE_BASED_SERVICE> = {
  [dateVer in DateLikeVer]: IServiceMigrationInput<T>;
};

type IMigrateServiceContext<T extends STORE_BASED_SERVICE> = {
  service: T;
  services: STORE_SERVICE_MAP;
  loggerPrefix: string;
  mockData?: any;
};

export function makeServiceMigration<T extends MIGRATABLE_STORE_SERVICE>(
  migration: IServiceMigrationsByVersion<GET_SERVICE_BY_NAME<T>>,
): IServiceMigrationsByVersion<GET_SERVICE_BY_NAME<T>> {
  return migration;
}

const SWITCHES = {
  KEEP_DATA_ON_DEV: false,
};
function _trimLegacyData<T extends (...args: any) => any>(
  fn: Function,
): undefined | ReturnType<T> {
  if (__DEV__ && SWITCHES.KEEP_DATA_ON_DEV) return;

  return fn();
}
export function processMigrateService<T extends STORE_BASED_SERVICE>(
  migration: IServiceMigrationsByVersion<T>,
  context: IMigrateServiceContext<T>,
) {
  const result = {
    successMigrationCount: 0,
    failedMigrationCount: 0,
  };

  const migrationByVers = Object.keys(migration).sort((a, b) =>
    bizNumberUtils.coerceInteger(a) < bizNumberUtils.coerceInteger(b) ? -1 : 1,
  );

  for (const verDesc of migrationByVers) {
    const formattedMigration: IServiceMigration<T> =
      typeof migration[verDesc] === 'function'
        ? {
            migrate: migration[verDesc],
          }
        : migration[verDesc];

    if (
      formattedMigration.minAppVer &&
      !semver.satisfies(APP_VER, formattedMigration.minAppVer)
    ) {
      console.debug(`[Migration] Skip migration ${verDesc}`);
      continue;
    }

    const ctx = Object.assign({ _trimLegacyData }, context);

    try {
      formattedMigration.migrate(ctx);
      result.successMigrationCount++;
      formattedMigration.afterMigrate?.(ctx);
    } catch (error) {
      console.error(`[Migration] Failed migration ${verDesc}`, error);
      Sentry.captureException(error);
      result.failedMigrationCount++;
      formattedMigration.migrateFailed?.(ctx);
    }
  }

  return result;
}
