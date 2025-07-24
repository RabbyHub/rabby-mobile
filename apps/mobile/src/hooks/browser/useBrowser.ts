import { isOrHasWithAllowedProtocol } from '@/constant/dappView';
import { RootNames } from '@/constant/layout';
import { emptyTab, Tab } from '@/core/services/browserService';
import {
  canoicalizeDappUrl,
  safeGetOrigin,
} from '@rabby-wallet/base-utils/dist/isomorphic/url';
import { TabActions, useRoute } from '@react-navigation/native';
import { useMemoizedFn } from 'ahooks';
import { atom, useAtom } from 'jotai';
import { v4 as uuid } from 'uuid';
import { useRabbyAppNavigation } from '../navigation';
import { browserService, dappService } from '@/core/services';
import { omit, last } from 'lodash';
import { boolean } from 'yup';
import { useMemo } from 'react';

export const tabsAtom = atom<{
  tabs: Tab[];
  activeTabId: string;
}>({
  tabs: [],
  activeTabId: '',
});

export const visibleAtom = atom(false);
const managePopupAtom = atom(false);
const browserStateAtom = atom({
  isShowBrowser: false,
  isShowSearch: false,
  isShowManage: false,
  searchText: '',
  searchTabId: '',
  trigger: '',
});

export function useBrowser() {
  // const navigation = useRabbyAppNavigation();

  const [store, setStore] = useAtom(tabsAtom);
  const [visible, setVisible] = useAtom(visibleAtom);
  const [isShowManagePopup, setIsShowManagePopup] = useAtom(managePopupAtom);
  const [browserState, setBrowserState] = useAtom(browserStateAtom);

  const setPartialBrowserState = useMemoizedFn(
    (payload: Partial<typeof browserState>) => {
      return setBrowserState(prev => ({
        ...prev,
        ...payload,
      }));
    },
  );

  // const route = useRoute();

  const getBrowserTabs = useMemoizedFn(() => {
    setStore(browserService.getBrowserTabs());
  });

  const updateBrowserTabs = useMemoizedFn((payload: Partial<typeof store>) => {
    browserService.updateBrowserTabs(payload);
    getBrowserTabs();
  });

  const navigateToBrowserScreen = useMemoizedFn(() => {
    // if (route.name === RootNames.BrowserScreen) {
    //   return;
    // }
    // navigation.dispatch(
    //   TabActions.jumpTo(RootNames.StackBrowser, {
    //     screen: RootNames.BrowserScreen,
    //   }),
    // );
    // navigation.navigate(RootNames.StackBrowser, {
    //   screen: RootNames.BrowserScreen,
    // });
    setIsShowManagePopup(false);
  });

  const switchToTab = useMemoizedFn((tabId: string) => {
    const activeTab = store.tabs.find(item => item.id === tabId);
    if (activeTab?.isTerminate) {
      updateTab(tabId, {
        isTerminate: false,
      });
    }
    updateBrowserTabs({
      activeTabId: tabId,
    });
    setPartialBrowserState({
      isShowBrowser: true,
      isShowManage: false,
      isShowSearch: false,
    });
  });
  const closeTab = useMemoizedFn((tabId: string) => {
    if (tabId === store.activeTabId) {
      const index = store.tabs.findIndex(item => item.id === tabId);
      if (index === -1) {
        return;
      }
      const newActiveTab = store.tabs[index + 1] || store.tabs[index - 1];
      updateBrowserTabs({
        activeTabId: newActiveTab?.id || '',
      });
    }
    const newTabs = store.tabs.filter(item => item.id !== tabId);
    updateBrowserTabs({
      tabs: newTabs,
    });
  });

  const closeAllTabs = useMemoizedFn(() => {
    updateBrowserTabs({
      tabs: [],
      activeTabId: '',
    });
  });

  const updateTab = useMemoizedFn(
    (tabId: string, payload: Partial<Omit<Tab, 'id'>>) => {
      const _payload =
        !payload?.url || !/^https?:\/\//.test(payload.url)
          ? omit(payload, 'url')
          : payload;
      updateBrowserTabs({
        tabs: store.tabs.map(item => {
          if (item.id === tabId) {
            return {
              ...item,
              ..._payload,
            };
          }
          return item;
        }),
      });
    },
  );

  const openTab = useMemoizedFn((url?: string) => {
    setPartialBrowserState({
      isShowBrowser: true,
      isShowSearch: false,
      isShowManage: false,
    });
    if (!url || !/^https?:\/\//.test(url)) {
      // switchToTab(emptyTab.id);
      return;
    }
    const newTab: Tab = {
      url,
      initialUrl: url,
      id: uuid(),
      openTime: Date.now(),
    };

    const { httpOrigin: targetOrigin, urlInfo } = canoicalizeDappUrl(
      newTab.url,
    );

    if (!isOrHasWithAllowedProtocol(urlInfo?.protocol)) {
      return false;
    }

    updateBrowserTabs({
      tabs: [...store.tabs, newTab],
      activeTabId: newTab.id,
    });

    return true;
  });

  const showBrowser = useMemoizedFn((options?: { isOpenNewTab?: boolean }) => {
    setPartialBrowserState({
      isShowBrowser: true,
      isShowSearch: false,
    });
  });

  const displayedTabs = useMemo(() => {
    return store.tabs.filter(item => {
      const origin = safeGetOrigin(item.url || item.initialUrl);
      return dappService.getDapp(origin)?.isDapp;
    });
  }, [store.tabs]);

  const onHideBrowser = useMemoizedFn(() => {
    setStore(pre => {
      const tabs = pre.tabs.filter(
        tab =>
          dappService.getDapp(safeGetOrigin(tab.url || tab.initialUrl))?.isDapp,
      );
      const activeTabId = tabs.find(tab => tab.id === pre.activeTabId)
        ? pre.activeTabId
        : last(tabs)?.id || '';
      const res = {
        activeTabId,
        tabs,
      };
      updateBrowserTabs(res);
      return res;
    });
  });

  return {
    getBrowserTabs,
    activeTabId: store.activeTabId,
    tabs: store.tabs,
    displayedTabs,
    switchToTab,
    closeTab,
    updateTab,
    openTab,
    closeAllTabs,
    visible,
    setVisible,
    isShowManagePopup,
    setIsShowManagePopup,
    showBrowser,
    browserState,
    setBrowserState,
    setPartialBrowserState,
    onHideBrowser,
  };
}

// export function useBrowserSearch() {
//   const [searchState, setSearchState] = useAtom(searchStateAtom);

//   return {
//     searchState,
//     setSearchState,
//   };
// }
