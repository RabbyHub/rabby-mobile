import { atom, useAtom } from 'jotai';
import { isOrHasWithAllowedProtocol } from '@/constant/dappView';
import { RootNames } from '@/constant/layout';
import { getLatestNavigationName } from '@/utils/navigation';
import { canoicalizeDappUrl } from '@rabby-wallet/base-utils/dist/isomorphic/url';
import { TabActions, useNavigation } from '@react-navigation/native';
import { useMemoizedFn } from 'ahooks';
import { v4 as uuid } from 'uuid';
import { useRabbyAppNavigation } from '../navigation';

export type Tab = {
  url: string;
  id: string;
  $openParams?: {
    initialUrl?: string;
  };
  openTime: number;
  lastOpenWebViewId?: string | null;
  viewShot?: string;
};

const tabsAtom = atom<Tab[]>([]);

const activeTabAtom = atom<Tab | undefined | null>(null);

export function useBrowser() {
  const navigation = useRabbyAppNavigation();

  const [tabs, setTabs] = useAtom(tabsAtom);
  const [activeTab, setActiveTab] = useAtom(activeTabAtom);
  const switchToTab = useMemoizedFn((tab: Tab) => {
    setActiveTab(tab);
    navigation.navigate(RootNames.StackBrowser, {
      screen: 'BrowserScreen',
    });
  });
  const closeTab = useMemoizedFn((tabId: string) => {
    if (tabId === activeTab?.id) {
      const index = tabs.findIndex(item => item.id === tabId);
      if (index === -1) {
        return;
      }
      const newActiveTab = tabs[index + 1] || tabs[index - 1];
      setActiveTab(newActiveTab);
    }
    const newTabs = tabs.filter(item => item.id !== tabId);
    setTabs(newTabs);
    if (newTabs.length <= 0) {
      // todo
      navigation.goBack();
    }
  });

  const updateTab = useMemoizedFn(
    (tabId: string, payload: Partial<Omit<Tab, 'id'>>) => {
      setTabs(prev => {
        return prev.map(item => {
          if (item.id === tabId) {
            return {
              ...item,
              ...payload,
            };
          }
          return item;
        });
      });
    },
  );

  const openTab = useMemoizedFn((url: string) => {
    const newTab: Tab = {
      url,
      id: uuid(),
      openTime: Date.now(),
    };

    const { httpOrigin: targetOrigin, urlInfo } = canoicalizeDappUrl(
      newTab.url,
    );

    if (!isOrHasWithAllowedProtocol(urlInfo?.protocol)) {
      return false;
    }

    setTabs(prev => {
      return [...prev, newTab];
    });

    setActiveTab(newTab);

    // preferenceService.toggleAllowNotifyAccountsChanged(true);

    // activate(dappInfo);
    //
    const routeName = getLatestNavigationName();
    const needRedirect =
      routeName && routeName !== RootNames.DappWebViewStubOnHome;
    if (needRedirect) {
      navigation.navigate(RootNames.StackBrowser, {
        screen: 'BrowserScreen',
      });

      // try trigger notify again
      // setTimeout(() => activate(dapps[item.origin]), 1 * 1e3);
    } else {
      // activate(dapps[item.origin]);
    }

    return true;
  });

  return {
    activeTab,
    tabs,
    switchToTab,
    closeTab,
    updateTab,
    openTab,
  };
}
