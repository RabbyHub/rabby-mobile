import './setup';

import { MakeSurePromise } from '@rabby-wallet/base-utils';
import { getRabbyAppDbDir } from '@/databases/constant';
import { Platform } from 'react-native';
import RNFS from 'react-native-fs';
import { SQLite, SQLiteDriverType } from './exports';
import {
  formatSQLiteTempStoreValue,
  resolveSQLiteConnectionTempStorePolicy,
} from './op-sqlite/policy';
import type { OPSQliteConnectionType } from './op-sqlite/typeorm';

const rabbyTestDBRef = {
  // TODO: maybe we can try to run it in non-UI Thread provided by react-native-reanimated
  current: null as MakeSurePromise<
    ReturnType<typeof SQLite.openDatabase>
  > | null,
};

type SQLiteRowResult = {
  rows: {
    item: (idx: number) => Record<string, any>;
  };
};

const getFirstResultRow = (results: any) => {
  return (
    SQLiteDriverType === 'RNSQLiteStorage'
      ? (results[0] as SQLiteRowResult).rows.item(0)
      : (results as SQLiteRowResult).rows.item(0)
  ) as Record<string, any>;
};

const safeGet = <T>(getValue: () => T, fallback: T): T => {
  try {
    return getValue();
  } catch {
    return fallback;
  }
};

const stringifyError = (error: unknown) => {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }

  return String(error);
};

async function getSingleRow(
  db: OPSQliteConnectionType,
  sql: string,
): Promise<Record<string, any>> {
  return db.executeSql<any>(sql, []).then(getFirstResultRow);
}

async function probeDirectoryWrite(
  label: string,
  dirPath: string | null,
): Promise<{
  label: string;
  path: string | null;
  exists: boolean;
  canWrite: boolean;
  bytesWritten: number | null;
  error: string | null;
}> {
  if (!dirPath) {
    return {
      label,
      path: null,
      exists: false,
      canWrite: false,
      bytesWritten: null,
      error: 'No directory path available.',
    };
  }

  const exists = await RNFS.exists(dirPath);
  if (!exists) {
    return {
      label,
      path: dirPath,
      exists: false,
      canWrite: false,
      bytesWritten: null,
      error: 'Directory does not exist.',
    };
  }

  const probeFilePath = `${dirPath.replace(
    /\/$/,
    '',
  )}/.rabby-sqlite-probe-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}.tmp`;

  try {
    await RNFS.writeFile(probeFilePath, `sqlite-probe:${Date.now()}`, 'utf8');
    const stat = await RNFS.stat(probeFilePath);
    await RNFS.unlink(probeFilePath).catch(() => undefined);

    return {
      label,
      path: dirPath,
      exists: true,
      canWrite: true,
      bytesWritten: Number(stat.size) || 0,
      error: null,
    };
  } catch (error) {
    await RNFS.unlink(probeFilePath).catch(() => undefined);

    return {
      label,
      path: dirPath,
      exists: true,
      canWrite: false,
      bytesWritten: null,
      error: stringifyError(error),
    };
  }
}

async function getAndroidSQLiteDiskProbe() {
  if (Platform.OS !== 'android') {
    return null;
  }

  const appDbDirectory = getRabbyAppDbDir();
  const temporaryDirectory =
    RNFS.TemporaryDirectoryPath || RNFS.CachesDirectoryPath || null;
  const candidates = [
    ['appDbDirectory', appDbDirectory],
    ['temporaryDirectory', temporaryDirectory],
    ['cachesDirectory', RNFS.CachesDirectoryPath || null],
    ['documentDirectory', RNFS.DocumentDirectoryPath || null],
  ] as const;

  const probes: Array<Awaited<ReturnType<typeof probeDirectoryWrite>>> = [];
  const seenPaths = new Set<string>();
  for (const [label, path] of candidates) {
    const normalizedPath = path || `${label}:null`;
    if (seenPaths.has(normalizedPath)) {
      continue;
    }
    seenPaths.add(normalizedPath);
    probes.push(await probeDirectoryWrite(label, path));
  }

  const fsInfo = await RNFS.getFSInfo().catch(() => null);

  return {
    probes,
    fsInfo: fsInfo
      ? {
          totalSpace: fsInfo.totalSpace,
          freeSpace: fsInfo.freeSpace,
        }
      : null,
  };
}

export function onTestDbReady() {
  if (!rabbyTestDBRef.current) {
    rabbyTestDBRef.current = SQLite.openDatabase({
      name: 'test.db',
      location: 'default',
      // createFromLocation: 1,
    });
  }

  return rabbyTestDBRef.current;
}

export async function getSQLiteInfo() {
  const rabbtTestDB = await onTestDbReady();
  const tempStorePolicy = resolveSQLiteConnectionTempStorePolicy();
  const dbPath = safeGet(
    () => rabbtTestDB.getDb().getDbPath(),
    getRabbyAppDbDir(),
  );

  return getSingleRow(
    rabbtTestDB,
    `
    SELECT sqlite_version() as version
    , sqlite_source_id() as source_id
    , sqlite_compileoption_used('THREADSAFE') as thread_safe
    , sqlite_compileoption_used('OMIT_DEPRECATED') as omit_deprecated
    , sqlite_compileoption_used('TEMP_STORE=2') as temp_store_2
    , sqlite_compileoption_used('TEMP_STORE=3') as temp_store_3
    ;
      `,
  )
    .then(async row => {
      const tempStoreRow = await getSingleRow(
        rabbtTestDB,
        'PRAGMA temp_store;',
      );
      const androidDiskProbe = await getAndroidSQLiteDiskProbe();

      return {
        version: row.version as string,
        source_id: row.source_id as string,
        thread_safe: row.thread_safe + '' === '1',
        temp_store: Number(tempStoreRow.temp_store ?? 0),
        temp_store_label: formatSQLiteTempStoreValue(
          Number(tempStoreRow.temp_store ?? 0),
        ),
        compile_options: {
          omit_deprecated: row.omit_deprecated + '' === '1',
          temp_store_2: row.temp_store_2 + '' === '1',
          temp_store_3: row.temp_store_3 + '' === '1',
        },
        test_db_path: dbPath || null,
        runtime_policy: tempStorePolicy,
        android_disk_probe: androidDiskProbe,
      };
    })
    .catch(err => {
      console.error(err);
      throw err;
    });
}

export type SQLiteInfo = Awaited<ReturnType<typeof getSQLiteInfo>>;

// export async function getSQLiteCompileOptions(): Promise<string[]> {
//   const rabbtTestDB = await onTestDbReady();

//   return rabbtTestDB
//     .executeSql('SELECT * FROM sqlite_compile_options;', [])
//     .then(([results]) => {
//       return Array.from({ length: results.rows.length }, (_, i) => {
//         return results.rows.item(i);
//       });
//     })
//     .catch(err => {
//       console.error(err);
//       throw err;
//     });
// }
