import { Platform } from 'react-native';
import {
  ANDROID_DATABASE_PATH,
  IOS_LIBRARY_PATH,
  open,
} from '@op-engineering/op-sqlite';
import type { QueryResult, Scalar } from '@op-engineering/op-sqlite';

import { getRabbyAppDbDir, getRabbyAppDbName } from './constant';
import { resolveSQLiteConnectionTempStorePolicy } from '@/core/databases/op-sqlite/policy';

const startupSqliteDbRef = {
  current: null as ReturnType<typeof open> | null,
};

function ensureTrailingSlash(path: string) {
  return path.endsWith('/') ? path : `${path}/`;
}

function getStartupSqliteLocation() {
  return ensureTrailingSlash(
    getRabbyAppDbDir() ||
      (Platform.OS === 'ios' ? IOS_LIBRARY_PATH : ANDROID_DATABASE_PATH),
  );
}

export function getStartupSqliteDb() {
  if (!startupSqliteDbRef.current) {
    const database = open({
      location: getStartupSqliteLocation(),
      name: getRabbyAppDbName(),
      encryptionKey: '',
    });
    const tempStorePolicy = resolveSQLiteConnectionTempStorePolicy();

    if (tempStorePolicy?.shouldApplyMemoryPragma) {
      try {
        database.executeSync('PRAGMA temp_store=MEMORY;', []);
      } catch (error) {
        console.warn(
          `[startupSqlite] Failed to set PRAGMA temp_store=MEMORY: ${String(
            error,
          )}`,
        );
      }
    }

    startupSqliteDbRef.current = database;
  }

  return startupSqliteDbRef.current;
}

export async function executeStartupSqlite(
  sql: string,
  params: Scalar[] = [],
) {
  const database = getStartupSqliteDb();
  const result = __DEV__
    ? await database.execute(sql, params)
    : database.executeSync(sql, params);

  return result as QueryResult;
}

export function getStartupSqliteRowsLength(rows: unknown) {
  if (Array.isArray(rows)) {
    return rows.length;
  }

  return (rows as { length?: number })?.length || 0;
}

export function getStartupSqliteRowItem(
  rows: unknown,
  index: number,
): Record<string, any> | undefined {
  if (Array.isArray(rows)) {
    return rows[index] as Record<string, any> | undefined;
  }

  return (rows as { item?: (idx: number) => Record<string, any> }).item?.(
    index,
  );
}
