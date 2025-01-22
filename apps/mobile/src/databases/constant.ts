import { Platform } from 'react-native';
import RNFS from 'react-native-fs';

import { APP_VERSIONS, APPLICATION_ID } from '@/constant';

export const APP_DB_PREFIX = 'rabby_';

// @see https://github.com/boltcode-js/react-native-sqlite-storage?tab=readme-ov-file#opening-a-database
// > Where as on Android the location of the database file is fixed,
// > there are three choices of where the database file can be located on iOS.

export function getRabbyAppDbName() {
  // return `rabby-app-${APP_VERSIONS.fromJs}_${APP_VERSIONS.buildNumber}.db`;
  return 'rabby-app.db';
}

export function getRabbyAppDbPath() {
  try {
    return Platform.OS === 'android'
      ? [`/data/data/${APPLICATION_ID}/databases`, getRabbyAppDbName()].join(
          '/',
        )
      : [RNFS.LibraryDirectoryPath, 'LocalDatabase', getRabbyAppDbName()].join(
          '/',
        );
  } catch (error) {
    console.error(error);

    return null;
  }
}

console.debug('getRabbyAppDbPath()', getRabbyAppDbPath());
