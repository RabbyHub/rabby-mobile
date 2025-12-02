import { Platform } from 'react-native';
import RNFS from 'react-native-fs';
import {
  ANDROID_DATABASE_PATH,
  IOS_LIBRARY_PATH,
  QueryResult,
  Transaction,
  open,
} from '@op-engineering/op-sqlite';

import { getRabbyAppDbDir } from '@/databases/constant';
import { stringUtils } from '@rabby-wallet/base-utils';

const enhanceQueryResult = (result: QueryResult): void => {
  // @ts-expect-error
  result.rows.item = (idx: number) => result.rows[idx];
};

const isIOS = Platform.OS === 'ios';

export const opSqliteTypeORMDriver = {
  openDatabase: async (
    options: {
      name: string;
      location?: string;
      encryptionKey?: string;
    },
    ok?: (db: any) => void,
    fail?: (msg: string) => void,
  ) => {
    try {
      // if (!options.encryptionKey || options.encryptionKey.length === 0) {
      //   throw new Error('[op-sqlite]: Encryption key is required');
      // }

      // console.debug([opSqliteTypeORMDriver] 'options', options);
      // const name = options.name;
      // console.debug([opSqliteTypeORMDriver] 'IOS_LIBRARY_PATH, ANDROID_DATABASE_PATH', IOS_LIBRARY_PATH, ANDROID_DATABASE_PATH);
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

      const connection = {
        executeSql: async <T extends any>(
          sql: string,
          params: any[] | undefined,
          ok?: (res: QueryResult) => void,
          fail?: (msg: string) => void,
        ): Promise<T> => {
          try {
            const response = await database.executeWithHostObjects(sql, params);
            // const response = await database.execute(sql, params);
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

      ok?.(connection);

      return connection;
    } catch (e) {
      fail?.(`[op-sqlite]: Error opening database: ${e as string}`);
      throw e;
    }
  },
};
