import semver from 'semver';
import * as Sentry from '@sentry/react-native';

import { APP_VERSIONS } from '@/constant';
import { StorageAdapater } from '@rabby-wallet/persist-store';
import { APP_STORE_NAMES } from '@/core/storage/storeConstant';
import { appStorage } from '@/core/storage/mmkv';
import {
  isUsedDateVer,
  sortMigrationByUTC0DateVer,
  UTC0LikeVer,
} from './datever';

const APP_VER = APP_VERSIONS.fromJs;

/* ====================== store migration :start ====================== */

const storeMigrationKey = '@StoreMigrations';
export function setLatestStoreMigration(
  storeName: APP_STORE_NAMES,
  dateVer: string,
) {
  const prev = { ...appStorage.getItem(storeMigrationKey) };
  appStorage.setItem(storeMigrationKey, {
    ...prev,
    [storeName]: dateVer,
  });
}

export function getLatestStoreMigration(storeName: APP_STORE_NAMES) {
  return appStorage.getItem(storeMigrationKey)?.[storeName] || null;
}

type StoreMigrator = (data: IMigrationStorageContext) => any;

type IStoreMigration = {
  shouldMigration?:
    | boolean
    | ((ctx: {
        /* storeName: string,  */ appVersion: string;
        semverModule: typeof semver;
      }) => boolean);
  migrator: StoreMigrator;
};

export type IStoreMigrations = {
  [dateVer in UTC0LikeVer]: StoreMigrator | IStoreMigration;
};

type IMigrationStorageContext = {
  appStorage: StorageAdapater;
  loggerPrefix: string;
  mockData?: any;
};

/**
 * @description make migration for app's storage directly,
 * it's low-level migration, happeneds BEFORE every store-based serivces's initialization
 */
export function makeStoreMigration(
  migration: IStoreMigrations,
): IStoreMigrations {
  return migration;
}

export function processMigration(
  migrationName: APP_STORE_NAMES,
  migration: IStoreMigrations,
  context: IMigrationStorageContext,
) {
  const result = {
    successMigrationCount: 0,
    failedMigrationCount: 0,
  };

  // notice: semver.compare would cause infinite loop issue on hermes of react-native@0.72
  // const migrationByVers = Object.keys(migration).sort(([a], [b]) => semver.compare(a, b));
  const migrationByVers = Object.keys(migration).sort(
    sortMigrationByUTC0DateVer,
  );
  const migratedVer = getLatestStoreMigration(migrationName);

  for (const utc0Ver of migrationByVers) {
    if (migratedVer && isUsedDateVer(utc0Ver, migratedVer)) {
      // console.debug(`${context.loggerPrefix} Skip migration ${utc0Ver} due to already migrated`);
      continue;
    }

    const formattedMigrator: IStoreMigration =
      typeof migration[utc0Ver] === 'function'
        ? {
            migrator: migration[utc0Ver],
          }
        : migration[utc0Ver];

    const { shouldMigration } = formattedMigrator;
    const finalShouldMigration =
      typeof shouldMigration === 'function'
        ? shouldMigration({ appVersion: APP_VER, semverModule: semver })
        : !!shouldMigration;

    if (!finalShouldMigration) {
      console.debug(
        `${context.loggerPrefix} Skip migration ${utc0Ver} due to judgement`,
      );
      continue;
    }

    try {
      formattedMigrator.migrator(context);
      result.successMigrationCount++;
      setLatestStoreMigration(migrationName, utc0Ver);
    } catch (error) {
      console.error(
        `${context.loggerPrefix} Failed migration ${utc0Ver}`,
        error,
      );
      Sentry.captureException(error);
      result.failedMigrationCount++;
    }
  }

  return result;
}
/* ====================== store migration :end ====================== */
