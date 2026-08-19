import { Platform } from 'react-native';
import RNFS from '@rabby-wallet/react-native-fs';

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
  cache_appchain: 'cache_appchain',
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

/**
 * Keyring state intentionally does not share rabby-app.db: that database is a
 * clearable resource cache, while keyring persistence needs an independent
 * encrypted durability boundary.
 */
export function getRabbyKeyringDbName() {
  return 'rabby-keyring.db';
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

export function getRabbyKeyringDbDir() {
  return getRabbyAppDbDir();
}

export function getRabbyKeyringDbPath() {
  return [getRabbyKeyringDbDir(), getRabbyKeyringDbName()].join('/');
}

// if (__DEV__) {
//   console.debug('getRabbyAppDbPath()', getRabbyAppDbPath());
// }
