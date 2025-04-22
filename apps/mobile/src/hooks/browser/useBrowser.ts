import { isOrHasWithAllowedProtocol } from '@/constant/dappView';
import { RootNames } from '@/constant/layout';
import { preferenceService } from '@/core/services';
import { getLatestNavigationName } from '@/utils/navigation';
import { canoicalizeDappUrl } from '@rabby-wallet/base-utils/dist/isomorphic/url';
import { useMemoizedFn } from 'ahooks';
import { atom, useAtom } from 'jotai';
import { v4 as uuid } from 'uuid';
import {
  useSceneAccountInfo,
  useSwitchSceneCurrentAccount,
} from '../accountsSwitcher';
import { useRabbyAppNavigation } from '../navigation';
import { useMemo } from 'react';
import {
  TabActions,
  useNavigationState,
  useRoute,
} from '@react-navigation/native';

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

const emptyTab: Tab = {
  id: 'EMPTY_TAB_ID',
  url: '',
  openTime: 0,
};

const tabsAtom = atom<Tab[]>([emptyTab]);
const activeTabIdAtom = atom<string>(emptyTab.id);

export function useBrowser() {
  const navigation = useRabbyAppNavigation();
  const { switchSceneCurrentAccount } = useSwitchSceneCurrentAccount();
  const forScene = '@ActiveDappWebViewModal';
  const { finalSceneCurrentAccount } = useSceneAccountInfo({
    forScene,
  });

  const [tabs, setTabs] = useAtom(tabsAtom);
  const [activeTabId, setActiveTabId] = useAtom(activeTabIdAtom);
  const route = useRoute();
  console.log('route', route);

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
    setActiveTabId(tabId);
    navigateToBrowserScreen();
    setTimeout(() => {
      switchSceneCurrentAccount(forScene, finalSceneCurrentAccount);
    });
  });
  const closeTab = useMemoizedFn((tabId: string) => {
    if (tabId === activeTabId) {
      const index = tabs.findIndex(item => item.id === tabId);
      if (index === -1) {
        return;
      }
      const newActiveTab = tabs[index + 1] || tabs[index - 1];
      setActiveTabId(newActiveTab?.id || emptyTab.id);
    }
    const newTabs = tabs.filter(item => item.id !== tabId);
    setTabs(newTabs);
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

  const openTab = useMemoizedFn((url?: string) => {
    if (!url) {
      switchToTab(emptyTab.id);
      return;
    }
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

    setActiveTabId(newTab.id);

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
    activeTabId,
    tabs,
    switchToTab,
    closeTab,
    updateTab,
    openTab,
  };
}
