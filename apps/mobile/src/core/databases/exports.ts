import RNSQLiteStorage from 'react-native-sqlite-storage';
import { opSqliteTypeORMDriver } from './op-sqlite-typeorm';

export { RNSQLiteStorage, opSqliteTypeORMDriver };

export const SQLiteDriverType = 'op-sqlite' as 'RNSQLiteStorage' | 'op-sqlite';
export const SQLite =
  SQLiteDriverType === 'RNSQLiteStorage'
    ? RNSQLiteStorage
    : opSqliteTypeORMDriver;
