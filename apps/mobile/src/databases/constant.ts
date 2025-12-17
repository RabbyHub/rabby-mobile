import { Platform } from 'react-native';
import RNFS from 'react-native-fs';

import { APP_VERSIONS, APPLICATION_ID } from '@/constant';

export const APP_DB_PREFIX = 'rabby_';

// @see https://github.com/boltcode-js/react-native-sqlite-storage?tab=readme-ov-file#opening-a-database
// > Where as on Android the location of the database file is fixed,
// > there are three choices of where the database file can be located on iOS.

export function getRabbyAppDbName(purpose?: 'share') {
  // return `rabby-app-${APP_VERSIONS.fromJs}_${APP_VERSIONS.buildNumber}.db`;
  switch (purpose) {
    default: {
      return 'rabby-app.db';
    }
    case 'share': {
      return `rabby-app.share.db`;
    }
  }
}

export function getRabbyAppDbDir() {
  try {
    return Platform.OS === 'android'
      ? // ? [`/data/data/${APPLICATION_ID}/databases`].join('/')
        [
          RNFS.DocumentDirectoryPath.replace(/\/files\/?/, ''),
          'databases',
        ].join('/')
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
