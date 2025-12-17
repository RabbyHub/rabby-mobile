import './op-sqlite/setup';
import { opSqliteTypeORMDriver } from './op-sqlite/typeorm';

export const SQLiteDriverType = 'op-sqlite' as 'RNSQLiteStorage' | 'op-sqlite';
export const SQLite = opSqliteTypeORMDriver;
