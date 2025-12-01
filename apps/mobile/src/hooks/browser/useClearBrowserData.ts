import { browserService } from '@/core/services';
import { emptyTab } from '@/core/services/browserService';
import { useMemoizedFn } from 'ahooks';
import { useAtom } from 'jotai';
import { resetTabsStore } from './useBrowser';
import { resetBrowserHistoryStore } from './useBrowserHistory';

export function useClearBrowserData() {
  // const [, setTabs] = useAtom(tabsAtom);
  // const [, setHistory] = useAtom(browserHistoryAtom);

  const clearBrowserData = useMemoizedFn(() => {
    browserService.clearBrowserData();
    resetTabsStore();
    resetBrowserHistoryStore();
  });

  return {
    clearBrowserData,
  };
}
