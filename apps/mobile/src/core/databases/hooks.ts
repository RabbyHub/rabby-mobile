import { atom, useAtom } from 'jotai';
import { useCallback, useEffect, useState } from 'react';
import { getSQLiteInfo } from './apis';

const sqliteInfoAtom = atom<{
  version?: string;
  source_id?: string;
  thread_safe?: boolean;
} | null>(null);

export function useSQLiteInfo(options?: { enableAutoFetch?: boolean }) {
  const [sqliteInfo, setSqliteInfo] = useAtom(sqliteInfoAtom);

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
  }, [setSqliteInfo]);

  useEffect(() => {
    if (enableAutoFetch) {
      getSqliteInfo();
    }
  }, [enableAutoFetch, getSqliteInfo]);

  return { isLoading, sqliteInfo };
}
