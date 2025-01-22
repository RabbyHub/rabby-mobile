import { APP_VERSIONS } from '@/constant';

export const APP_DB_PREFIX = 'rabby_';

// @see https://github.com/boltcode-js/react-native-sqlite-storage?tab=readme-ov-file#opening-a-database
// > Where as on Android the location of the database file is fixed,
// > there are three choices of where the database file can be located on iOS.

export function getRabbyAppDbName() {
  return `rabby-app-${APP_VERSIONS.fromJs}_${APP_VERSIONS.buildNumber}.db`;
}
