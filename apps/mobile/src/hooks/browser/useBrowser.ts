import { isOrHasWithAllowedProtocol } from '@/constant/dappView';
import { browserService, dappService } from '@/core/services';
import { Tab } from '@/core/services/browserService';
import { isGoogle } from '@/utils/browser';
import {
  EVENT_SHOW_BROWSER,
  EVENT_SHOW_BROWSER_MANAGE,
  eventBus,
} from '@/utils/events';
import {
  canoicalizeDappUrl,
  safeGetOrigin,
} from '@rabby-wallet/base-utils/dist/isomorphic/url';
import { useMemoizedFn } from 'ahooks';
import { atom, useAtom } from 'jotai';
import { last, omit, sortBy } from 'lodash';
import { v4 as uuid } from 'uuid';
import { dappsAtom } from '../useDapps';
import { ContentMode } from 'react-native-webview/lib/WebViewTypes';
import { Platform } from 'react-native';

export const tabsAtom = atom<{
  tabs: Tab[];
  activeTabId: string;
}>({
  tabs: [],
  activeTabId: '',
});

export const visibleAtom = atom(false);
const managePopupAtom = atom(false);
export const browserStateAtom = atom({
  isShowBrowser: false,
  isShowSearch: false,
  isShowManage: false,
  searchText: '',
  searchTabId: '',
  trigger: '',
});

const browserActiveTabStateAtom = atom<{
  url: string;
  contentMode?: ContentMode;
  isConnected?: boolean;
  isBookmark?: boolean;
  isDapp?: boolean;
}>({
  url: '',
  contentMode: undefined,
});

const MAX_ACTIVE_TABS_COUNT = Platform.OS === 'android' ? 4 : 4;

const displayedTabsAtom = atom(get => {
  const store = get(tabsAtom);

  return store.tabs.filter(item => {
    return item.isDapp;
  });

  // return sortBy(
  //   store.tabs.filter(item => {
  //     return item.isDapp;
  //   }),
  //   tab => -(tab.openTime || Number.MAX_SAFE_INTEGER),
  // );
});

const homeDisplayedTabsAtom = atom(get => {
  const store = get(tabsAtom);
  const dapps = get(dappsAtom);

  return sortBy(
    store.tabs.filter(item => {
      return dapps[safeGetOrigin(item.url || item.initialUrl)]?.isDapp;
    }),
    tab => -(tab.openTime || Number.MAX_SAFE_INTEGER),
  ).slice(0, 4);
});

export const useHomeDisplayedTabs = () => {
  const [tabs] = useAtom(homeDisplayedTabsAtom);
  return tabs;
};

export const useBrowserActiveTabState = () => {
  return useAtom(browserActiveTabStateAtom);
};

export function useBrowser() {
  const [store, setStore] = useAtom(tabsAtom);
  const [visible, setVisible] = useAtom(visibleAtom);
  const [isShowManagePopup, setIsShowManagePopup] = useAtom(managePopupAtom);
  const [browserState, setBrowserState] = useAtom(browserStateAtom);
  const [displayedTabs] = useAtom(displayedTabsAtom);

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
    updateTab(tabId, {
      isTerminate: false,
      openTime: Date.now(),
    });
    updateBrowserTabs({
      activeTabId: tabId,
    });
    setPartialBrowserState({
      isShowBrowser: true,
      isShowManage: false,
      isShowSearch: false,
    });
    // terminateTabs();
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
    browserService.removeScreenshot({ tabId });
  });

  const closeAllTabs = useMemoizedFn(() => {
    store.tabs.forEach(tab => {
      browserService.removeScreenshot({ tabId: tab.id });
    });
    updateBrowserTabs({
      tabs: [],
      activeTabId: '',
    });
  });

  const terminateTabs = useMemoizedFn(() => {
    setTimeout(() => {
      setStore(prev => {
        const tabs = sortBy(
          prev.tabs.filter(tab => tab.isDapp),
          tab => -(tab.openTime || Number.MAX_SAFE_INTEGER),
        );

        const time = tabs[MAX_ACTIVE_TABS_COUNT - 1]?.openTime || 0;

        const finalTabs = tabs.map(tab => {
          if (tab.openTime < time && tab.id !== prev.activeTabId) {
            return {
              ...tab,
              isTerminate: true,
            };
          }
          return tab;
        });

        const activeTabId =
          finalTabs.find(tab => tab.id && tab.id === prev.activeTabId)?.id ||
          finalTabs[0]?.id ||
          '';

        const result = {
          activeTabId,
          tabs: finalTabs,
        };

        browserService.updateBrowserTabs(result);
        return result;
      });
    });
  });

  const updateTab = useMemoizedFn(
    (tabId: string, payload: Partial<Omit<Tab, 'id'>>) => {
      const _payload =
        !payload?.url || !/^https?:\/\//.test(payload.url)
          ? omit(payload, 'url')
          : payload;
      setStore(prev => {
        const res = {
          ...prev,
          tabs: prev.tabs.map(item => {
            if (item.id === tabId) {
              return {
                ...item,
                ..._payload,
              };
            }
            return item;
          }),
        };
        browserService.updateBrowserTabs(res);
        return res;
      });
    },
  );

  const openTab = useMemoizedFn(
    (
      url: string,
      options?: {
        isDapp?: boolean;
      },
    ) => {
      if (!url?.trim() || !/^https?:\/\//.test(url)) {
        // switchToTab(emptyTab.id);
        return;
      }
      const newTab: Tab = {
        url,
        initialUrl: url,
        id: uuid(),
        openTime: Date.now(),
        ...options,
      };

      const { httpOrigin: targetOrigin, urlInfo } = canoicalizeDappUrl(
        newTab.url,
      );

      const sameOriginTab = displayedTabs.find(
        item => safeGetOrigin(item.url || item.initialUrl) === targetOrigin,
      );

      if (sameOriginTab && !isGoogle(targetOrigin)) {
        switchToTab(sameOriginTab.id);
        return true;
      }

      if (!isOrHasWithAllowedProtocol(urlInfo?.protocol)) {
        return false;
      }

      setPartialBrowserState({
        isShowBrowser: true,
        isShowSearch: false,
        isShowManage: false,
      });

      updateBrowserTabs({
        tabs: [...store.tabs, newTab],
        activeTabId: newTab.id,
      });

      // terminateTabs();

      return true;
    },
  );

  const forceShowBrowser = useMemoizedFn(() => {
    eventBus.emit(EVENT_SHOW_BROWSER, true);
  });

  const forceShowBrowserManage = useMemoizedFn(() => {
    eventBus.emit(EVENT_SHOW_BROWSER_MANAGE, true);
  });

  const showBrowser = useMemoizedFn(() => {
    setPartialBrowserState({
      isShowBrowser: true,
      isShowSearch: false,
    });
  });

  const onHideBrowser = useMemoizedFn(() => {
    setStore(pre => {
      const tabs = pre.tabs.filter(tab => tab.isDapp);
      const activeTabId = tabs.find(tab => tab.id === pre.activeTabId)
        ? pre.activeTabId
        : last(tabs)?.id || '';
      const res = {
        activeTabId,
        tabs,
      };
      browserService.updateBrowserTabs(res);
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
    forceShowBrowser,
    forceShowBrowserManage,
    terminateTabs,
  };
}

// export function useBrowserSearch() {
//   const [searchState, setSearchState] = useAtom(searchStateAtom);

//   return {
//     searchState,
//     setSearchState,
//   };
// }
