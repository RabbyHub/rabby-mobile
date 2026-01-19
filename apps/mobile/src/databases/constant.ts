import { Platform } from 'react-native';
import RNFS from 'react-native-fs';

export const APP_DB_PREFIX = 'rabby_';

export const ORM_TABLE_NAMES = {
  account_info: 'account_info',

  cache_buy_order: 'cache_buy_order',
  cache_balance: 'cache_balance',
  cache_cex: 'cache_cex',

  cache_tokenitem: 'cache_tokenitem',
  cache_nftitem: 'cache_nftitem',
  cache_historyitem: 'cache_historyitem',
  cache_local_historyitem: 'cache_local_historyitem',

  cache_portocolitem: 'cache_portocolitem',
} as const;

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
