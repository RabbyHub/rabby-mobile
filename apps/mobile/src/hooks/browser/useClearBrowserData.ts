import { browserService } from '@/core/services';
import { emptyTab } from '@/core/services/browserService';
import { useMemoizedFn } from 'ahooks';
import { useAtom } from 'jotai';
import { tabsAtom } from './useBrowser';
import { browserHistoryAtom } from './useBrowserHistory';

export function useClearBrowserData() {
  const [, setTabs] = useAtom(tabsAtom);
  const [, setHistory] = useAtom(browserHistoryAtom);

  const clearBrowserData = useMemoizedFn(() => {
    browserService.clearBrowserData();
    setTabs({
      tabs: [emptyTab],
      activeTabId: emptyTab.id,
    });
    setHistory({
      ids: [],
      entities: {},
    });
  });

  return {
    clearBrowserData,
  };
}
