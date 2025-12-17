import './setup';

import { MakeSurePromise } from '@rabby-wallet/base-utils';
import { SQLite, SQLiteDriverType } from './exports';

const rabbyTestDBRef = {
  // TODO: maybe we can try to run it in non-UI Thread provided by react-native-reanimated
  current: null as MakeSurePromise<
    ReturnType<typeof SQLite.openDatabase>
  > | null,
};

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

  return rabbtTestDB
    .executeSql<any>(
      `
    SELECT sqlite_version() as version
    , sqlite_source_id() as source_id
    , sqlite_compileoption_used('THREADSAFE') as thread_safe
    ;
      `,
      [],
    )
    .then(results => {
      const row =
        SQLiteDriverType === 'RNSQLiteStorage'
          ? results[0].rows.item(0)
          : results.rows.item(0);
      return {
        version: row.version as string,
        source_id: row.source_id as string,
        thread_safe: row.thread_safe + '' === '1',
      };
    })
    .catch(err => {
      console.error(err);
      throw err;
    });
}

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
