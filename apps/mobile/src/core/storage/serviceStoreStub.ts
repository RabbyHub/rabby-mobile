import { useAtom } from 'jotai';
import { useEffect } from 'react';

import { getChainList } from '@/constant/chains';
import { currentAccountAtom } from '@/hooks/account';
import { tabsAtom } from '@/hooks/browser/useBrowser';
import { useBrowserBookmark } from '@/hooks/browser/useBrowserBookmark';
import { useBrowserHistory } from '@/hooks/browser/useBrowserHistory';
import { chainListAtom } from '@/hooks/useChainList';
import { useCustomRPC } from '@/hooks/useCustomRPC';
import { dappServiceAtom } from '@/hooks/useDapps';
import {
  EVENT_SWITCH_ACCOUNT,
  EVENT_UPDATE_CHAIN_LIST,
  eventBus,
} from '@/utils/events';
import { useMount } from 'ahooks';
import { browserService, dappService } from '../services/shared';

/**
 * @description only call this hook on app's top level
 */
export function useSetupServiceStub() {
  const [, setDappServices] = useAtom(dappServiceAtom);
  const [, setCurrentAccount] = useAtom(currentAccountAtom);
  const [, setChainList] = useAtom(chainListAtom);
  const { getAllRPC } = useCustomRPC();
  const { getBookmarkList } = useBrowserBookmark();
  const { getBrowserHistoryList } = useBrowserHistory();
  const [, setTabs] = useAtom(tabsAtom);

  useEffect(() => {
    const disposes: Function[] = [];

    dappService.setBeforeSetKV((k, v) => {
      setDappServices(prev => ({ ...prev, [k]: v }));
    }, disposes);

    return () => {
      disposes.forEach(dispose => dispose());
    };
  }, [setDappServices]);

  useMount(() => {
    eventBus.on(EVENT_SWITCH_ACCOUNT, (v: any) => {
      setCurrentAccount(v);
    });
  });

  useMount(() => {
    setChainList({
      mainnetList: getChainList('mainnet'),
      testnetList: getChainList('testnet'),
    });
    eventBus.on(EVENT_UPDATE_CHAIN_LIST, v => {
      setChainList(prev => {
        return {
          ...prev,
          ...v,
        };
      });
    });
  });

  useMount(() => {
    getAllRPC();
  });

  useMount(() => {
    getBookmarkList();
    getBrowserHistoryList();
    setTabs(browserService.getBrowserTabs());
  });
}
