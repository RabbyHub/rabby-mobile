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
import { omit, last, sortBy, initial } from 'lodash';
import { boolean } from 'yup';
import { useEffect, useMemo } from 'react';
import { dappsAtom } from '../useDapps';
import {
  EVENT_SHOW_BROWSER,
  EVENT_SHOW_BROWSER_MANAGE,
  eventBus,
} from '@/utils/events';
import { matomoRequestEvent } from '@/utils/analytics';
import { isGoogle } from '@/utils/browser';

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

const MAX_ACTIVE_TABS_COUNT = 4;

const displayedTabsAtom = atom(get => {
  const store = get(tabsAtom);

  return store.tabs.filter(item => {
    return item.isDapp;
  });
});

export function useBrowser() {
  // const navigation = useRabbyAppNavigation();

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
    const activeTab = store.tabs.find(item => item.id === tabId);
    if (activeTab?.isTerminate) {
      updateTab(tabId, {
        isTerminate: false,
        openTime: Date.now(),
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
    terminateTabs();
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

        if (tabs.length <= MAX_ACTIVE_TABS_COUNT) {
          return prev;
        }

        const time = tabs[3]?.openTime || 0;
        if (!time) {
          return prev;
        }

        const finalTabs = prev.tabs.map(tab => {
          if (tab.openTime < time && tab.id !== prev.activeTabId) {
            return {
              ...tab,
              isTerminate: true,
            };
          }
          return tab;
        });

        const result = {
          ...prev,
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

  const openTab = useMemoizedFn(
    (
      url: string,
      options?: {
        isDapp?: boolean;
      },
    ) => {
      if (!url || !/^https?:\/\//.test(url)) {
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

      if (dappService.getDapp(targetOrigin)?.isDapp) {
        matomoRequestEvent({
          category: 'Websites Usage',
          action: 'Website_OpenDapp',
          label: url,
        });
      }

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

      terminateTabs();

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
  };
}

// export function useBrowserSearch() {
//   const [searchState, setSearchState] = useAtom(searchStateAtom);

//   return {
//     searchState,
//     setSearchState,
//   };
// }
