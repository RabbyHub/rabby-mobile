import { useMemo } from 'react';
import { browserHistoryService } from './../core/services/shared';

import { isNonPublicProductionEnv } from '@/constant/env';
import { BrowserHistoryItem } from '@/core/services/browserHistoryService';
import { DappInfo } from '@/core/services/dappService';
import { useMemoizedFn } from 'ahooks';
import { atom, useAtom } from 'jotai';

const browserHistoryAtom = atom<BrowserHistoryItem[]>([]);

const BROWSER_HISTORY_LIMIT_SHORT = {
  // maxCount: 10,
  expireDuration: 10 * 60 * 1000, // 10 minutes
};
const BROWSER_HISTORY_LIMIT = {
  // maxCount: 100,
  expireDuration: 30 * 24 * 60 * 60 * 1000, // 30 days
};

const EXPIRE_DURATION = !isNonPublicProductionEnv
  ? BROWSER_HISTORY_LIMIT.expireDuration
  : BROWSER_HISTORY_LIMIT_SHORT.expireDuration;

export function useBrowserHistory({
  dapps,
}: {
  dapps: Record<string, DappInfo>;
}) {
  const [historyStore, setHistoryStore] = useAtom(browserHistoryAtom);

  const getBrowserHistoryList = useMemoizedFn(() => {
    const res = browserHistoryService.getHistoryList();
    setHistoryStore(res);
    return res;
  });

  const setBrowserHistory = useMemoizedFn((origin: string) => {
    browserHistoryService.setHistory({ origin });
    getBrowserHistoryList();
  });

  const removeBrowserHistory = useMemoizedFn((origin: string) => {
    browserHistoryService.removeHistory(origin);
    getBrowserHistoryList();
  });

  const browserHistoryList = useMemo(() => {
    const res: DappInfo[] = [];
    historyStore.forEach(item => {
      // filter dapps older then 30 days
      const favoriteDiff = Date.now() - item.createdAt;
      if (dapps[item.origin] && favoriteDiff <= EXPIRE_DURATION) {
        res.push(dapps[item.origin]);
      }
    });
    return res;
  }, [historyStore, dapps]);

  return {
    browserHistoryList,
    setBrowserHistory,
    removeBrowserHistory,
    getBrowserHistoryList,
  };
}
