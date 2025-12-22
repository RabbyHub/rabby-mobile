import { useCallback, useEffect, useMemo, useState } from 'react';

import { getRabbyAppDbPath } from '../constant';
import { getDbFileSize } from '../dbfs';
import { zCreate } from '@/core/utils/reexports';
import { resolveValFromUpdater, UpdaterOrPartials } from '@/core/utils/store';
import { useShallow } from 'zustand/react/shallow';

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

type SQLiteStaticsInfo = {
  total_bytes: number | null;
} | null;

const sqliteStaticsInfoStore = zCreate<{
  sqliteStatics: SQLiteStaticsInfo;
}>(() => ({
  sqliteStatics: {
    total_bytes: 0,
  },
}));

function setSqliteStatics(valOrFunc: UpdaterOrPartials<SQLiteStaticsInfo>) {
  sqliteStaticsInfoStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev.sqliteStatics, valOrFunc);
    return { ...prev, sqliteStatics: newVal };
  });
}

export function useSQLiteStatics(options?: { enableAutoFetch?: boolean }) {
  const { sqliteStatics } = sqliteStaticsInfoStore(useShallow(s => s));

  const { enableAutoFetch } = options ?? {};

  const [isLoading, setIsLoading] = useState(false);
  const fetchSqliteStatics = useCallback(async () => {
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
  }, []);

  const semanticBytes = useMemo(() => {
    // if (!sqliteStatics || typeof sqliteStatics?.total_bytes !== 'number') return '-';
    if (!sqliteStatics?.total_bytes) return '-';

    const total_bytes = sqliteStatics.total_bytes;
    return getSemanticBytes(total_bytes);
  }, [sqliteStatics?.total_bytes]);

  useEffect(() => {
    if (enableAutoFetch) {
      fetchSqliteStatics();
    }
  }, [enableAutoFetch, fetchSqliteStatics]);

  return {
    isLoading,
    semanticBytes: isLoading ? '-' : semanticBytes,
    fetchSqliteStatics,
    sqliteStatics,
  };
}
