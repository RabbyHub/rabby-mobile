import { Platform } from 'react-native';
import RNFS from 'react-native-fs';

import { APP_VERSIONS, APPLICATION_ID } from '@/constant';

export const APP_DB_PREFIX = 'rabby_';
export const INMEMORY_PREFIX = 'in_memory';
export const FULL_INMEMORY_PREFIX = `${APP_DB_PREFIX}in_memory`;

export const CACHE_TABLES = {
  tokenitem: 'cache_tokenitem',
};

export const TEMP_TABLES = {
  tokenitem_tag: 'temp_tokenitem_tag',
};

export function getFullTableName(tableName: keyof typeof CACHE_TABLES) {
  return `${APP_DB_PREFIX}${CACHE_TABLES[tableName]}`;
}

// @see https://github.com/boltcode-js/react-native-sqlite-storage?tab=readme-ov-file#opening-a-database
// > Where as on Android the location of the database file is fixed,
// > there are three choices of where the database file can be located on iOS.

export function getRabbyAppDbName() {
  // return `rabby-app-${APP_VERSIONS.fromJs}_${APP_VERSIONS.buildNumber}.db`;
  return 'rabby-app.db';
}

export function getRabbyAppDbDir() {
  try {
    return Platform.OS === 'android'
      ? [`/data/data/${APPLICATION_ID}/databases`].join('/')
      : [RNFS.LibraryDirectoryPath, 'LocalDatabase'].join('/');
  } catch (error) {
    console.error(error);

    return null;
  }
}

export function getRabbyAppDbPath() {
  return [getRabbyAppDbDir(), getRabbyAppDbName()].join('/');
}

// if (__DEV__) {
//   console.debug('getRabbyAppDbPath()', getRabbyAppDbPath());
// }
