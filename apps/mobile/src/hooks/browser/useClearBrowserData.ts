import { browserService } from '@/core/services';
import { useMemoizedFn } from 'ahooks';
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
