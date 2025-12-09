import { useAtom } from 'jotai';
import { useEffect } from 'react';

import { getChainList } from '@/constant/chains';
import { setCurrentAccount } from '@/hooks/account';
import { setTabs } from '@/hooks/browser/useBrowser';
import { useBrowserBookmark } from '@/hooks/browser/useBrowserBookmark';
import { useBrowserHistory } from '@/hooks/browser/useBrowserHistory';
import {
  usePerpsEffectOnTop,
  usePerpsStore,
} from '@/hooks/perps/usePerpsStore';
// import { chainListAtom } from '@/hooks/useChainList';
// import { currencyServiceAtom } from '@/hooks/useCurrency';
import { useCustomRPC } from '@/hooks/useCustomRPC';
// import { dappServiceAtom } from '@/hooks/useDapps';
import {
  EVENT_SWITCH_ACCOUNT,
  EVENT_UPDATE_CHAIN_LIST,
  eventBus,
} from '@/utils/events';
import { safeGetOrigin } from '@rabby-wallet/base-utils/dist/isomorphic/url';
import { useMount } from 'ahooks';
import {
  browserService,
  currencyService,
  dappService,
} from '../services/shared';
import { setChainList } from '@/hooks/useChainList';

/**
 * @description only call this hook on app's top level
 */
export function useSetupServiceStub() {
  const { getAllRPC } = useCustomRPC();
  const { getBookmarkList } = useBrowserBookmark();
  const { getBrowserHistoryList } = useBrowserHistory();
  usePerpsEffectOnTop();

  useMount(() => {
    setChainList({
      mainnetList: getChainList('mainnet'),
      testnetList: getChainList('testnet'),
    });
  });

  useMount(() => {
    getAllRPC();
  });

  useMount(() => {
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
