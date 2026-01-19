import { Platform } from 'react-native';
import {
  ANDROID_DATABASE_PATH,
  ANDROID_FILES_PATH,
  IOS_LIBRARY_PATH,
  QueryResult,
  Transaction,
  open,
} from '@op-engineering/op-sqlite';

import { getRabbyAppDbDir } from '@/databases/constant';
import { stringUtils } from '@rabby-wallet/base-utils';
import { OPSQLiteEvents } from './events';
import {
  BaseEntity,
  DataSource,
  EntityTarget,
  ObjectLiteral,
  Repository,
} from 'typeorm/browser';
import { ReactNativeDriver } from '@/core/utils/reexports';

const enhanceQueryResult = (result: QueryResult): void => {
  // @ts-expect-error
  result.rows.item = (idx: number) => result.rows[idx];
};

const isIOS = Platform.OS === 'ios';

const opSqliteDBRef = { current: null as null | ReturnType<typeof open> };
export function getLatestOpSqliteDBInstance() {
  return opSqliteDBRef.current;
}

export const opSqliteTypeORMDriver = {
  openDatabase: async (
    options: {
      name: string;
      location?: string;
      encryptionKey?: string;
    },
    okOpen?: (db: any) => void,
    failOpen?: (msg: string) => void,
  ) => {
    try {
      // if (!options.encryptionKey || options.encryptionKey.length === 0) {
      //   throw new Error('[op-sqlite]: Encryption key is required');
      // }

      // console.debug([opSqliteTypeORMDriver] 'options', options);
      // const name = options.name;
      if (isIOS) {
        console.debug(
          '[opSqliteTypeORMDriver] IOS_LIBRARY_PATH, ANDROID_DATABASE_PATH',
          IOS_LIBRARY_PATH,
          ANDROID_DATABASE_PATH,
        );
      } else {
        console.debug(
          '[opSqliteTypeORMDriver] ANDROID_FILES_PATH, ANDROID_DATABASE_PATH',
          ANDROID_FILES_PATH,
          ANDROID_DATABASE_PATH,
        );
        console.debug(
          '[opSqliteTypeORMDriver] getRabbyAppDbDir()',
          getRabbyAppDbDir(),
        );
      }
      const location =
        options.location === ':memory:'
          ? options.location
          : stringUtils.ensureSuffix(
              getRabbyAppDbDir() ||
                (isIOS ? IOS_LIBRARY_PATH : ANDROID_DATABASE_PATH),
              '/',
            );
      console.debug('[opSqliteTypeORMDriver] location', location);

      const database = open({
        location: location,
        name: options.name,
        encryptionKey: options.encryptionKey || '',
      });

      if (opSqliteDBRef.current) {
        console.warn(
          '[opSqliteTypeORMDriver] Warning: database instance already exists, notice developer',
        );
      }
      opSqliteDBRef.current = database;
      OPSQLiteEvents.emit('__OP_SQLITE_LOADED__', { database });

      const connection = {
        getDb() {
          return database;
        },
        executeSql: async <T extends any>(
          sql: string,
          params: any[] | undefined,
          ok?: (res: QueryResult) => void,
          fail?: (msg: string) => void,
        ): Promise<T> => {
          try {
            // const response = await database.executeWithHostObjects(sql, params);
            const response = __DEV__
              ? await database.execute(sql, params)
              : database.executeSync(sql, params);
            enhanceQueryResult(response);
            ok?.(response);
            return response as T;
          } catch (e) {
            fail?.(`[op-sqlite]: Error executing SQL: ${e as string}`);
            throw e;
          }
        },
        transaction: (
          fn: (tx: Transaction) => Promise<void>,
        ): Promise<void> => {
          return database.transaction(fn);
        },
        close: (ok: any, fail: any) => {
          try {
            database.close();
            opSqliteDBRef.current = null;
            ok();
          } catch (e) {
            fail(`[op-sqlite]: Error closing db: ${e as string}`);
          }
        },
        attach: (
          dbNameToAttach: string,
          alias: string,
          location: string | undefined,
          callback: () => void,
        ) => {
          // @ts-expect-error In fact, we don't need attach method
          database.attach(options.name, dbNameToAttach, alias, location);

          callback();
        },
        detach: (alias: string, callback: () => void) => {
          // @ts-expect-error In fact, we don't need detach method
          database.detach(options.name, alias);

          callback();
        },
      };

      okOpen?.(connection);

      return connection;
    } catch (e) {
      failOpen?.(`[op-sqlite]: Error opening database: ${e as string}`);
      throw e;
    }
  },
};

export type OPSQliteConnectionType = Awaited<
  ReturnType<typeof opSqliteTypeORMDriver.openDatabase>
>;

export function resolveDriverAndConnectionFromEntity<
  Entity extends ObjectLiteral,
>(ds: DataSource, entityCls: EntityTarget<Entity>) {
  const repo = ds.getRepository(entityCls);
  const driver = repo.manager.connection.driver as ReactNativeDriver;

  return {
    driver,
    connection: driver.databaseConnection as OPSQliteConnectionType,
  };
}

export function resolveDriverAndConnectionFromRepo<T extends BaseEntity>(
  repo: Repository<T>,
) {
  const driver = repo.manager.connection.driver as ReactNativeDriver;

  return {
    driver,
    connection: driver.databaseConnection as OPSQliteConnectionType,
  };
}
