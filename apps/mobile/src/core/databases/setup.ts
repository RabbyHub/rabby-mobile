import SQLite from '@boltcode/react-native-sqlite-storage';

if (__DEV__) {
  SQLite.DEBUG(__DEV__);
}

SQLite.enablePromise(true);
