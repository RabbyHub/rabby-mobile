import semver from 'semver';
import * as Sentry from '@sentry/react-native';

import { APP_VERSIONS } from '@/constant';
import {
  GET_SERVICE_BY_NAME,
  MIGRATABLE_STORE_SERVICE,
  STORE_BASED_SERVICE,
  STORE_SERVICE_MAP,
} from '@/core/storage/storeConstant';
import { appStorage } from '@/core/storage/mmkv';
import {
  isUsedDateVer,
  sortMigrationByUTC0DateVer,
  UTC0LikeVer,
} from './datever';

const APP_VER = APP_VERSIONS.fromJs;

/* ====================== service migrate :start ====================== */

const serviceMigrationKey = '@ServiceMigrations';
export function setLatestServiceMigration(
  serviceName: MIGRATABLE_STORE_SERVICE,
  dateVer: string,
) {
  const prev = { ...appStorage.getItem(serviceMigrationKey) };
  appStorage.setItem(serviceMigrationKey, {
    ...prev,
    [serviceName]: dateVer,
  });
}

export function getLatestServiceMigration(
  serviceName: MIGRATABLE_STORE_SERVICE,
) {
  return appStorage.getItem(serviceMigrationKey)?.[serviceName] || null;
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
  shouldMigration?:
    | boolean
    | ((ctx: {
        service: T;
        appVersion: string;
        semverModule: typeof semver;
      }) => boolean);
  migrate: IServiceMigrate<T>;
  afterMigrate?: IServiceAfterMigrate<T>;
  migrateFailed?: IServiceMigrate<T>;
};

export type IServiceMigrationInput<T extends STORE_BASED_SERVICE> =
  | IServiceMigrate<T>
  | IServiceMigration<T>;

export type IServiceMigrationsByVersion<T extends STORE_BASED_SERVICE> = {
  [dateVer in UTC0LikeVer]: IServiceMigrationInput<T>;
};

type IMigrateServiceContext<T extends STORE_BASED_SERVICE> = {
  service: T;
  services: STORE_SERVICE_MAP;
  loggerPrefix: string;
  mockData?: any;
};

/**
 * @description make migration for app's service
 * it happeneds AFTER every store-based serivces's initialization
 */
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
export function processMigrateService<U extends MIGRATABLE_STORE_SERVICE>(
  serviceName: U,
  migration: IServiceMigrationsByVersion<GET_SERVICE_BY_NAME<U>>,
  context: IMigrateServiceContext<GET_SERVICE_BY_NAME<U>>,
) {
  type T = GET_SERVICE_BY_NAME<U>;
  const result = {
    successMigrationCount: 0,
    failedMigrationCount: 0,
  };

  const migrationByVers = Object.keys(migration).sort(
    sortMigrationByUTC0DateVer,
  );
  const migratedVer = getLatestServiceMigration(serviceName);

  for (const utc0Ver of migrationByVers) {
    if (migratedVer && isUsedDateVer(utc0Ver, migratedVer)) {
      // console.debug(`${context.loggerPrefix} Skip migration ${utc0Ver} due to already migrated`);
      continue;
    }
    const formattedMigration: IServiceMigration<T> =
      typeof migration[utc0Ver] === 'function'
        ? {
            migrate: migration[utc0Ver],
          }
        : migration[utc0Ver];

    const { shouldMigration } = formattedMigration;
    const finalShouldMigration =
      typeof shouldMigration === 'function'
        ? shouldMigration({
            service: context.service,
            appVersion: APP_VER,
            semverModule: semver,
          })
        : !!shouldMigration;

    if (!finalShouldMigration) {
      console.debug(
        `${context.loggerPrefix} Skip migration ${utc0Ver} due to judgement`,
      );
      continue;
    }

    const ctx = Object.assign({ _trimLegacyData }, context);

    try {
      formattedMigration.migrate(ctx);
      result.successMigrationCount++;
      setLatestServiceMigration(serviceName, utc0Ver);
      formattedMigration.afterMigrate?.(ctx);
    } catch (error) {
      console.error(
        `${context.loggerPrefix} Failed migration ${utc0Ver}`,
        error,
      );
      Sentry.captureException(error);
      result.failedMigrationCount++;
      formattedMigration.migrateFailed?.(ctx);
    }
  }

  return result;
}

/* ====================== service migrate :end ====================== */
