import { getChainList } from '@/constant/chains';
import { setTabs } from '@/hooks/browser/useBrowser';
import { getBookmarkList } from '@/hooks/browser/useBrowserBookmark';
import { getBrowserHistoryList } from '@/hooks/browser/useBrowserHistory';
import { getAllRPC } from '@/hooks/useCustomRPC';
import { safeGetOrigin } from '@rabby-wallet/base-utils/dist/isomorphic/url';
import { useMount } from 'ahooks';
import { browserService, dappService } from '../services/shared';
import { setChainList } from '@/hooks/useChainList';

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
    getAllRPC();
    getBookmarkList();
    getBrowserHistoryList();
    const data = browserService.getBrowserTabs();
    setTabs(
      data.tabs.map(tab => {
        if (tab.isDapp) {
          return tab;
        }
        const isDapp = !!dappService.getDapp(
          safeGetOrigin(tab.url || tab.initialUrl),
        )?.isDapp;

        return {
          ...tab,
          isDapp,
        };
      }),
    );
  });
}
