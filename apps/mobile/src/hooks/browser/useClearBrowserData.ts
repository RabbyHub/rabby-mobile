import { browserServiceApi } from '@/core/serviceApi/browser';
import { useMemoizedFn } from 'ahooks';
import { useAtom } from 'jotai';
import { resetTabsStore } from './useBrowser';
import { resetBrowserHistoryStore } from './useBrowserHistory';

export function useClearBrowserData() {
  const clearBrowserData = useMemoizedFn(() => {
    void browserServiceApi.clearBrowserData().catch(console.error);
    resetTabsStore();
    resetBrowserHistoryStore();
  });

  return {
    clearBrowserData,
  };
}
