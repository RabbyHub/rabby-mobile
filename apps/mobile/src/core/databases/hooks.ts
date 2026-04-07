import { atom, useAtom } from 'jotai';
import { useCallback, useEffect, useState } from 'react';
import { getSQLiteInfo, type SQLiteInfo } from './apis';

const sqliteInfoAtom = atom<SQLiteInfo | null>(null);

export function useSQLiteInfo(options?: { enableAutoFetch?: boolean }) {
  const [sqliteInfo, setSqliteInfo] = useAtom(sqliteInfoAtom);

  const { enableAutoFetch } = options ?? {};

  const [isLoading, setIsLoading] = useState(false);

  const getSqliteInfo = useCallback(async () => {
    setIsLoading(true);

    return getSQLiteInfo()
      .then(res => {
        setSqliteInfo(res);
        return res;
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

  return { isLoading, sqliteInfo, getSqliteInfo };
}
