import { isOrHasWithAllowedProtocol } from '@/constant/dappView';
import { RootNames } from '@/constant/layout';
import { emptyTab, Tab } from '@/core/services/browserService';
import { canoicalizeDappUrl } from '@rabby-wallet/base-utils/dist/isomorphic/url';
import { TabActions, useRoute } from '@react-navigation/native';
import { useMemoizedFn } from 'ahooks';
import { atom, useAtom } from 'jotai';
import { v4 as uuid } from 'uuid';
import { useRabbyAppNavigation } from '../navigation';
import { browserService } from '@/core/services';
import { omit } from 'lodash';

export const tabsAtom = atom({
  tabs: [emptyTab],
  activeTabId: emptyTab.id,
});

export function useBrowser() {
  const navigation = useRabbyAppNavigation();

  const [store, setStore] = useAtom(tabsAtom);
  const route = useRoute();

  const getBrowserTabs = useMemoizedFn(() => {
    setStore(browserService.getBrowserTabs());
  });

  const updateBrowserTabs = useMemoizedFn((payload: Partial<typeof store>) => {
    browserService.updateBrowserTabs(payload);
    getBrowserTabs();
  });

  const navigateToBrowserScreen = useMemoizedFn(() => {
    if (route.name === RootNames.BrowserScreen) {
      return;
    }
    navigation.dispatch(
      TabActions.jumpTo(RootNames.StackBrowser, {
        screen: RootNames.BrowserScreen,
      }),
    );
    // navigation.navigate(RootNames.StackBrowser, {
    //   screen: RootNames.BrowserScreen,
    // });
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
    navigateToBrowserScreen();
  });
  const closeTab = useMemoizedFn((tabId: string) => {
    if (tabId === store.activeTabId) {
      const index = store.tabs.findIndex(item => item.id === tabId);
      if (index === -1) {
        return;
      }
      const newActiveTab = store.tabs[index + 1] || store.tabs[index - 1];
      updateBrowserTabs({
        activeTabId: newActiveTab?.id || emptyTab.id,
      });
    }
    const newTabs = store.tabs.filter(item => item.id !== tabId);
    updateBrowserTabs({
      tabs: newTabs,
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
    if (!url || !/^https?:\/\//.test(url)) {
      switchToTab(emptyTab.id);
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

    navigateToBrowserScreen();

    // activate(dappInfo);
    //
    // const routeName = getLatestNavigationName();
    // const needRedirect = routeName && routeName !== RootNames.BrowserScreen;
    // if (needRedirect) {
    //   navigateToBrowserScreen();
    //   // try trigger notify again
    //   // setTimeout(() => activate(dapps[item.origin]), 1 * 1e3);
    // } else {
    //   // activate(dapps[item.origin]);
    // }

    return true;
  });

  return {
    getBrowserTabs,
    activeTabId: store.activeTabId,
    tabs: store.tabs,
    switchToTab,
    closeTab,
    updateTab,
    openTab,
  };
}
