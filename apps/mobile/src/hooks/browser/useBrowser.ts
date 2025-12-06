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
// import { dappsAtom } from '../useDapps';
import { ContentMode } from 'react-native-webview/lib/WebViewTypes';
import { Platform } from 'react-native';
import { useDappsValue } from '../useDapps';
import { zCreate } from '@/core/utils/reexports';
import { useMemo } from 'react';
import { resolveValFromUpdater, UpdaterOrPartials } from '@/core/utils/store';

type TabsState = {
  tabs: Tab[];
  activeTabId: string;
};
// export const tabsAtom = atom<{
//   tabs: Tab[];
//   activeTabId: string;
// }>({
//   tabs: [],
//   activeTabId: '',
// });
const tabsStore = zCreate<TabsState>(() => ({
  tabs: [],
  activeTabId: '',
}));

function setTabsStore(valOrFunc: UpdaterOrPartials<TabsState>) {
  tabsStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev, valOrFunc, {
      strict: false,
    });
    return newVal;
  });
}

export function resetTabsStore() {
  tabsStore.setState({
    tabs: [],
    activeTabId: '',
  });
}

export function setTabs(val: UpdaterOrPartials<TabsState['tabs']>) {
  tabsStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev.tabs, val, { strict: false });

    return {
      ...prev,
      tabs: newVal,
    };
  });
}

const browserExtraStore = zCreate<{
  visible: boolean;
  isShowManagePopup: boolean;
}>(() => ({
  visible: false,
  isShowManagePopup: false,
}));

function setVisible(val: boolean) {
  browserExtraStore.setState(prev => ({
    ...prev,
    visible: val,
  }));
}

function setIsShowManagePopup(val: boolean) {
  browserExtraStore.setState(prev => ({
    ...prev,
    isShowManagePopup: val,
  }));
}

type BrowserStateType = {
  isShowBrowser: boolean;
  isShowSearch: boolean;
  isShowManage: boolean;
  searchText: string;
  searchTabId: string;
  trigger: string;
};

const browserStateStore = zCreate<BrowserStateType>(() => ({
  isShowBrowser: false,
  isShowSearch: false,
  isShowManage: false,
  searchText: '',
  searchTabId: '',
  trigger: '',
}));

export function setBrowserState(
  valOrFunc: UpdaterOrPartials<BrowserStateType>,
) {
  browserStateStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev, valOrFunc);
    return newVal;
  });
}

type BrowserActiveTabStateType = {
  url: string;
  contentMode?: ContentMode;
  isConnected?: boolean;
  isBookmark?: boolean;
  isDapp?: boolean;
};

const browserActiveTabStateStore = zCreate<BrowserActiveTabStateType>(() => ({
  url: '',
  contentMode: undefined,
}));
// const browserActiveTabStateAtom = atom<{
//   url: string;
//   contentMode?: ContentMode;
//   isConnected?: boolean;
//   isBookmark?: boolean;
//   isDapp?: boolean;
// }>({
//   url: '',
//   contentMode: undefined,
// });
function setBrowserActiveTabState(
  valOrFunc: UpdaterOrPartials<BrowserActiveTabStateType>,
) {
  browserActiveTabStateStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev, valOrFunc);
    return newVal;
  });
}

const MAX_ACTIVE_TABS_COUNT = Platform.OS === 'android' ? 4 : 4;

function useDisplayedTabs() {
  const tabs = tabsStore(s => s.tabs);
  const displayedTabs = useMemo(
    () =>
      tabs.filter(item => {
        return item.isDapp;
      }),
    [tabs],
  );

  return { displayedTabs };
}

export function useHomeDisplayedTabs() {
  // const [store] = useAtom(tabsAtom);
  const tabs = tabsStore(s => s.tabs);
  const { dapps } = useDappsValue();

  const homeDisplayedTabs = useMemo(
    () =>
      sortBy(
        tabs.filter(item => {
          return dapps[safeGetOrigin(item.url || item.initialUrl)]?.isDapp;
        }),
        tab => -(tab.openTime || Number.MAX_SAFE_INTEGER),
      ).slice(0, 4),
    [tabs, dapps],
  );

  return { homeDisplayedTabs };
}

export const useBrowserActiveTabState = () => {
  // return useAtom(browserActiveTabStateAtom);
  return [
    browserActiveTabStateStore(s => s),
    setBrowserActiveTabState,
  ] as const;
};

export function useBrowser() {
  // const [store, setStore] = useAtom(tabsAtom);
  const store = tabsStore(s => s);
  // const [visible, setVisible] = useAtom(visibleAtom);
  const visible = browserExtraStore(s => s.visible);
  // const [isShowManagePopup, setIsShowManagePopup] = useAtom(managePopupAtom);
  const isShowManagePopup = browserExtraStore(s => s.isShowManagePopup);
  // const [browserState, setBrowserState] = useAtom(browserStateAtom);
  // const [displayedTabs] = useAtom(displayedTabsAtom);
  const { displayedTabs } = useDisplayedTabs();

  const setPartialBrowserState = useMemoizedFn(
    (payload: Partial<BrowserStateType>) => {
      return setBrowserState(prev => ({
        ...prev,
        ...payload,
      }));
    },
  );

  // const route = useRoute();

  const getBrowserTabs = useMemoizedFn(() => {
    setTabsStore(browserService.getBrowserTabs());
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
      setTabsStore(prev => {
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
      setTabsStore(prev => {
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
        isNewTab?: boolean;
      },
    ) => {
      const { isNewTab = false } = options || {};
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

      const sameOriginTab = isNewTab
        ? undefined
        : displayedTabs.find(
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
    setTabsStore(pre => {
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
    browserState: browserStateStore(s => s),
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
