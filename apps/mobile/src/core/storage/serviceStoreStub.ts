import { getChainList } from '@/constant/chains';
import { setTabs } from '@/hooks/browser/useBrowser';
import { getBookmarkList } from '@/hooks/browser/useBrowserBookmark';
import { getBrowserHistoryList } from '@/hooks/browser/useBrowserHistory';
import { getAllRPC } from '@/hooks/useCustomRPC';
import { safeGetOrigin } from '@rabby-wallet/base-utils/dist/isomorphic/url';
import { useMount } from 'ahooks';
import { browserServiceApi } from '@/core/serviceApi/browser';
import { dappServiceApi } from '@/core/serviceApi/dapp';
import { scheduleStartupTask } from '@/core/utils/startupScheduler';
import { STARTUP_TASKS } from '@/core/utils/startupTaskManifest';
import { setChainList } from '@/hooks/useChainList';

let browserDappWarmupScheduled = false;

async function warmBrowserDappStores() {
  const [browserTabs, dapps] = await Promise.all([
    browserServiceApi.getBrowserTabs(),
    dappServiceApi.getDapps(),
    getAllRPC(),
  ]);

  getBookmarkList();
  getBrowserHistoryList();
  setTabs(
    browserTabs.tabs.map(tab => {
      if (tab.isDapp) {
        return tab;
      }
      const isDapp = !!dapps[safeGetOrigin(tab.url || tab.initialUrl)]?.isDapp;

      return {
        ...tab,
        isDapp,
      };
    }),
  );
}

function scheduleBrowserDappWarmup() {
  if (browserDappWarmupScheduled) {
    return;
  }

  browserDappWarmupScheduled = true;
  scheduleStartupTask(
    () => warmBrowserDappStores().catch(console.error),
    STARTUP_TASKS.serviceStoreStubBrowserDappWarmup,
  );
}

/**
 * @description only call this hook on app's top level
 */
export function useSetupServiceStub() {
  useMount(() => {
    setChainList({
      mainnetList: getChainList('mainnet'),
      testnetList: getChainList('testnet'),
    });
  });

  useMount(() => {
    scheduleBrowserDappWarmup();
  });
}
