import { useMemo } from 'react';
import { browserHistoryService } from './../core/services/shared';

import { BrowserHistoryItem } from '@/core/services/browserHistoryService';
import { DappInfo } from '@/core/services/dappService';
import { dappsAtom } from '@/core/storage/serviceStoreStub';
import { useMemoizedFn } from 'ahooks';
import { atom, useAtom } from 'jotai';

const browserHistoryAtom = atom<BrowserHistoryItem[]>([]);

export function useBrowserHistory() {
  const [dapps] = useAtom(dappsAtom);
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
      if (dapps[item.origin]) {
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
