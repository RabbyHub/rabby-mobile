import { useMemo } from 'react';
import { Platform } from 'react-native';
import { useMemoizedFn } from 'ahooks';
import { last, omit, sortBy } from 'lodash';
import { v4 as uuid } from 'uuid';
import { ContentMode } from 'react-native-webview/lib/WebViewTypes';

import { isOrHasWithAllowedProtocol } from '@/constant/dappView';
import { browserService } from '@/core/services';
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

import { useDappsValue } from '../useDapps';
import { zCreate } from '@/core/utils/reexports';
import { resolveValFromUpdater, UpdaterOrPartials } from '@/core/utils/store';

type TabsState = {
  tabs: Tab[];
  activeTabId: string;
};

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
  isShowFavorite: boolean;
  searchText: string;
  searchTabId: string;
  trigger: string;
  isEditingFavorite?: boolean;
};

const browserStateStore = zCreate<BrowserStateType>(() => ({
  isShowBrowser: false,
  isShowSearch: false,
  isShowManage: false,
  isShowFavorite: false,
  searchText: '',
  searchTabId: '',
  trigger: '',
  isEditingFavorite: false,
}));

export function setBrowserState(
  valOrFunc: UpdaterOrPartials<BrowserStateType>,
) {
  browserStateStore.setState(prev => {
    const { newVal, changed } = resolveValFromUpdater(prev, valOrFunc, {
      strict: true,
    });
    if (!changed) return prev;

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

function getDisplayedTabs(tabs?: Tab[]) {
  tabs = tabs || tabsStore.getState().tabs;

  const displayedTabs = tabs.filter(item => item.isDapp);

  return displayedTabs;
}

function useDisplayedTabs() {
  const tabs = tabsStore(s => s.tabs);
  const displayedTabs = useMemo(() => getDisplayedTabs(tabs), [tabs]);

  return { displayedTabs };
}

export function useHomeDisplayedTabs() {
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
  return [
    browserActiveTabStateStore(s => s),
    setBrowserActiveTabState,
  ] as const;
};

export const browserApis = {
  setPartialBrowserState: (payload: Partial<BrowserStateType>) => {
    return setBrowserState(prev => ({
      ...prev,
      ...payload,
    }));
  },

  getBrowserTabs: () => {
    setTabsStore(browserService.getBrowserTabs());
  },

  updateBrowserTabs: (payload: Partial<TabsState>) => {
    browserService.updateBrowserTabs(payload);
    browserApis.getBrowserTabs();
  },

  navigateToBrowserScreen: () => {
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
  },

  switchToTab: (tabId: string) => {
    browserApis.updateTab(tabId, {
      isTerminate: false,
      openTime: Date.now(),
    }),
      browserApis.updateBrowserTabs({
        activeTabId: tabId,
      });
    browserApis.setPartialBrowserState({
      isShowBrowser: true,
      isShowManage: false,
      isShowSearch: false,
    });
    // terminateTabs();
  },
  closeTab: (tabId: string) => {
    const store = tabsStore.getState();
    if (tabId === store.activeTabId) {
      const index = store.tabs.findIndex(item => item.id === tabId);
      if (index === -1) {
        return;
      }
      const newActiveTab = store.tabs[index + 1] || store.tabs[index - 1];
      browserApis.updateBrowserTabs({
        activeTabId: newActiveTab?.id || '',
      });
    }
    const newTabs = store.tabs.filter(item => item.id !== tabId);
    browserApis.updateBrowserTabs({
      tabs: newTabs,
    });
    browserService.removeScreenshot({ tabId });
  },

  closeAllTabs: () => {
    const store = tabsStore.getState();
    store.tabs.forEach(tab => {
      browserService.removeScreenshot({ tabId: tab.id });
    });
    browserApis.updateBrowserTabs({
      tabs: [],
      activeTabId: '',
    });
  },

  terminateTabs: () => {
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
  },

  updateTab: (tabId: string, payload: Partial<Omit<Tab, 'id'>>) => {
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

  openTab: (
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
      : getDisplayedTabs().find(
          item => safeGetOrigin(item.url || item.initialUrl) === targetOrigin,
        );

    if (sameOriginTab && !isGoogle(targetOrigin)) {
      browserApis.switchToTab(sameOriginTab.id);
      return true;
    }

    if (!isOrHasWithAllowedProtocol(urlInfo?.protocol)) {
      return false;
    }

    browserApis.setPartialBrowserState({
      isShowBrowser: true,
      isShowSearch: false,
      isShowManage: false,
    });

    const store = tabsStore.getState();
    browserApis.updateBrowserTabs({
      tabs: [...store.tabs, newTab],
      activeTabId: newTab.id,
    });

    // terminateTabs();

    return true;
  },

  forceShowBrowser: () => {
    eventBus.emit(EVENT_SHOW_BROWSER, true);
  },

  forceShowBrowserManage: () => {
    eventBus.emit(EVENT_SHOW_BROWSER_MANAGE, true);
  },

  showBrowser: () => {
    browserApis.setPartialBrowserState({
      isShowBrowser: true,
      isShowSearch: false,
    });
  },

  onHideBrowser: () => {
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
  },
};

export function useBrowser() {
  const store = tabsStore(s => s);
  const visible = browserExtraStore(s => s.visible);
  const isShowManagePopup = browserExtraStore(s => s.isShowManagePopup);
  const { displayedTabs } = useDisplayedTabs();

  return {
    activeTabId: store.activeTabId,
    tabs: store.tabs,
    displayedTabs,

    visible,
    setVisible,
    isShowManagePopup,
    setIsShowManagePopup,
    browserState: browserStateStore(s => s),
    setBrowserState,

    /* from apis */
    getBrowserTabs: browserApis.getBrowserTabs,
    switchToTab: browserApis.switchToTab,
    closeTab: browserApis.closeTab,
    updateTab: browserApis.updateTab,
    openTab: browserApis.openTab,
    closeAllTabs: browserApis.closeAllTabs,
    showBrowser: browserApis.showBrowser,
    setPartialBrowserState: browserApis.setPartialBrowserState,
    onHideBrowser: browserApis.onHideBrowser,
    forceShowBrowser: browserApis.forceShowBrowser,
    forceShowBrowserManage: browserApis.forceShowBrowserManage,
    terminateTabs: browserApis.terminateTabs,
  };
}
