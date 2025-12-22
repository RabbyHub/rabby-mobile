import { useCallback, useEffect, useState } from 'react';
import { getSQLiteInfo } from './apis';
import { zCreate } from '@/core/utils/reexports';
import { resolveValFromUpdater, UpdaterOrPartials } from '@/core/utils/store';
import { useShallow } from 'zustand/react/shallow';

type SQLiteInfo = {
  version?: string;
  source_id?: string;
  thread_safe?: boolean;
} | null;

const sqliteInfoStore = zCreate<{
  sqliteInfo: SQLiteInfo;
}>(() => ({
  sqliteInfo: null,
}));

function setSqliteInfo(valOrFunc: UpdaterOrPartials<SQLiteInfo>) {
  sqliteInfoStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev.sqliteInfo, valOrFunc);
    return { ...prev, sqliteInfo: newVal };
  });
}

export function useSQLiteInfo(options?: { enableAutoFetch?: boolean }) {
  const { sqliteInfo } = sqliteInfoStore(useShallow(s => s));

  const { enableAutoFetch } = options ?? {};

  const [isLoading, setIsLoading] = useState(false);

  const getSqliteInfo = useCallback(async () => {
    setIsLoading(true);

    return Promise.allSettled([
      getSQLiteInfo().then(res => {
        setSqliteInfo(prev => ({
          ...prev,
          version: res.version,
          source_id: res.source_id,
          thread_safe: res.thread_safe,
        }));
      }),
    ])
      .then(([reqSqliteInfo]) => {
        return { reqSqliteInfo };
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    if (enableAutoFetch) {
      getSqliteInfo();
    }
  }, [enableAutoFetch, getSqliteInfo]);

  return { isLoading, sqliteInfo };
}
