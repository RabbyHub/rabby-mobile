import { browserService } from '@/core/services';
import { emptyTab } from '@/core/services/browserService';
import { useMemoizedFn } from 'ahooks';
import { useAtom } from 'jotai';
import { resetTabsStore } from './useBrowser';
import { resetBrowserHistoryStore } from './useBrowserHistory';

export function useClearBrowserData() {
  const clearBrowserData = useMemoizedFn(() => {
    browserService.clearBrowserData();
    resetTabsStore();
    resetBrowserHistoryStore();
  });

  return {
    clearBrowserData,
  };
}
