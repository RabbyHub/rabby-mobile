import './op-sqlite/setup';
import { opSqliteTypeORMDriver } from './op-sqlite/typeorm';
export { SQLiteDriverType } from './driverKind';

export const SQLite = opSqliteTypeORMDriver;
