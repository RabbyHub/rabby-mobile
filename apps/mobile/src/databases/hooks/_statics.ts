import { useCallback, useEffect, useMemo, useState } from 'react';
import { atom, useAtom } from 'jotai';
import RNFS from 'react-native-fs';

import RNHelpers from '@/core/native/RNHelpers';
import { dropAppDataSource, prepareAppDataSource } from '../imports';
import { getRabbyAppDbPath } from '../constant';

const STAGES = {
  gb: 1024 * 1024 * 1024,
  mb: 1024 * 1024,
  kb: 1024,
};

function computeBytes(bytes: number) {
  return {
    bytes,
    bits: bytes * 8,
    kilobytes: bytes / STAGES.kb,
    milibytes: bytes / STAGES.mb,
    gigabytes: bytes / STAGES.gb,
  };
}

function getSemanticBytes(total_bytes: number) {
  return total_bytes >= STAGES.gb
    ? `${(total_bytes / STAGES.gb).toFixed(2)} GB`
    : total_bytes >= STAGES.mb
    ? `${(total_bytes / STAGES.mb).toFixed(2)} MB`
    : total_bytes >= STAGES.kb
    ? `${(total_bytes / STAGES.kb).toFixed(2)} KB`
    : `${total_bytes} B`;
}

export async function getDbFileSize() {
  const dbPath = getRabbyAppDbPath();
  if (!dbPath) {
    console.error('dbPath is not defined or empty');
    return null;
  }

  if (!(await RNFS.exists(dbPath))) {
    console.error('dbPath is not exists', __DEV__ ? dbPath : '');
    return null;
  }

  return Promise.allSettled([
    RNFS.stat(dbPath).then(info => info.size),
    (await RNFS.exists(`${dbPath}-shm`))
      ? RNFS.stat(`${dbPath}-shm`).then(info => info.size)
      : Promise.resolve(0),
    (await RNFS.exists(`${dbPath}-wal`))
      ? RNFS.stat(`${dbPath}-wal`).then(info => info.size)
      : Promise.resolve(0),
  ]).then(allInfosResult => {
    const total_bytes = allInfosResult.reduce((acc, promiseRet) => {
      if (promiseRet.status === 'fulfilled') acc += promiseRet.value;

      return acc;
    }, 0);

    return total_bytes;
  });
}

// async function queryAllTablesBytes() {
//   const dataSource = await prepareAppDataSource();

//   const result = {
//     bytes: 0,
//     error: null as null | Error,
//   };

//   try {
//     const queryResult = await dataSource.query(
//       `
//       SELECT
//           SUM(total_bytes) AS total_bytes
//       FROM (
//           SELECT
//               name,
//               (page_count * page_size) AS total_bytes
//           FROM
//               pragma_page_size
//           JOIN
//               pragma_page_count ON 1 = 1
//           JOIN
//               sqlite_master ON type = 'table'
//           WHERE
//               name NOT LIKE 'sqlite_%'
//               AND name LIKE 'rabby_%'
//       )
//     `,
//     );
//     result.bytes = queryResult[0]?.total_bytes ?? 0;
//   } catch (error) {
//     console.error(error);
//     result.error = error as any;
//   }

//   return result;
// }

const sqliteStaticsInfoAtom = atom<{
  total_bytes: number | null;
} | null>({
  total_bytes: 0,
});

export function useSQLiteStatics(options?: { enableAutoFetch?: boolean }) {
  const [sqliteStatics, setSqliteStatics] = useAtom(sqliteStaticsInfoAtom);

  const { enableAutoFetch } = options ?? {};

  const [isLoading, setIsLoading] = useState(false);

  const getSqliteStaticsInfo = useCallback(async () => {
    setIsLoading(true);

    return getDbFileSize()
      .then(result => {
        setSqliteStatics(prev => ({
          ...prev,
          total_bytes: result,
        }));
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [setSqliteStatics]);

  const clearDbCacheAndQuiteApp = useCallback(async () => {
    await dropAppDataSource();
    RNHelpers.forceExitApp();
  }, []);

  const semanticBytes = useMemo(() => {
    // if (!sqliteStatics || typeof sqliteStatics?.total_bytes !== 'number') return '-';
    if (!sqliteStatics?.total_bytes) return '-';

    const total_bytes = sqliteStatics.total_bytes;
    return getSemanticBytes(total_bytes);
  }, [sqliteStatics?.total_bytes]);

  useEffect(() => {
    if (enableAutoFetch) {
      getSqliteStaticsInfo();
    }
  }, [enableAutoFetch, getSqliteStaticsInfo]);

  return {
    isLoading,
    semanticBytes: isLoading ? '-' : semanticBytes,
    clearDbCacheAndQuiteApp,
    sqliteStatics,
  };
}
