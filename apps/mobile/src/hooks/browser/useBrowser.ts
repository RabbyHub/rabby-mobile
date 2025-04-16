import { atom, useAtom, useAtomValue } from 'jotai';
import { useCallback } from 'react';

import { isOrHasWithAllowedProtocol } from '@/constant/dappView';
import { RootNames } from '@/constant/layout';
import {
  ActiveDappState,
  activeDappStateEvents,
  globalSetActiveDappState,
} from '@/core/bridges/state';
import { preferenceService } from '@/core/services';
import { DappInfo } from '@/core/services/dappService';
import { useRefState } from '@/hooks/common/useRefState';
import { HomeNavigatorParamsList } from '@/navigation-type';
import { getLatestNavigationName } from '@/utils/navigation';
import { canoicalizeDappUrl } from '@rabby-wallet/base-utils/dist/isomorphic/url';
import { TabActions, useNavigation } from '@react-navigation/native';
import { useMemoizedFn } from 'ahooks';
import { v4 as uuid } from 'uuid';

const activeDappTabIdAtom = atom<ActiveDappState['tabId']>(null);
activeDappTabIdAtom.onMount = set => {
  const listener = (tabId: ActiveDappState['tabId']) => {
    set(tabId);
  };
  activeDappStateEvents.addListener('updated', listener);

  return () => {
    activeDappStateEvents.removeListener('updated', listener);
  };
};

const activeDappOriginAtom = atom<ActiveDappState['dappOrigin']>(null);
export function useOpenedActiveDappState() {
  const activeDappOrigin = useAtomValue(activeDappOriginAtom);
  const activeTabId = useAtomValue(activeDappTabIdAtom);

  return {
    activeDappOrigin,
    activeTabId: activeTabId,
    hasActiveDapp: !!activeDappOrigin,
  };
}

export type OpenedDappItem = {
  url: string;
  id: string;
  $openParams?: {
    initialUrl?: string;
  };
  openTime: number;
  lastOpenWebViewId?: string | null;
  viewShot?: string;
};

export type Tab = OpenedDappItem;

const tabsAtom = atom<Tab[]>([]);

const activeTabAtom = atom<Tab | undefined | null>(null);

export const OPEN_DAPP_VIEW_INDEXES = {
  expanded: 1,
  collapsed: 0,
};
export type DappWebViewHideContext = {
  webviewId: string | undefined;
  dappOrigin: string;
  latestUrl?: string;
};
export function useBrowser() {
  const [activeDappOrigin, _setActiveDappOrigin] =
    useAtom(activeDappOriginAtom);

  const navigation = useNavigation();

  // const openingActiveDappRef = useRef<boolean>(false);
  const { stateRef: openingActiveDappRef } = useRefState<any>(false);
  const setActiveDappOrigin = useCallback(
    (origin: DappInfo['origin'] | null) => {
      globalSetActiveDappState({ dappOrigin: origin });
      _setActiveDappOrigin(origin);

      if (!origin) {
        preferenceService.toggleAllowNotifyAccountsChanged(false);
      }
    },
    [_setActiveDappOrigin],
  );

  const [tabs, setTabs] = useAtom(tabsAtom);
  const [activeTab, setActiveTab] = useAtom(activeTabAtom);
  const switchToTab = useMemoizedFn((tab: Tab) => {
    setActiveTab(tab);
    navigation.dispatch(TabActions.jumpTo(RootNames.DappWebViewStubOnHome));
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

  const openUrlAsDapp = useCallback(
    (
      url: string,
      options?: {
        /** @default {true} */
        isActiveDapp?: boolean;
        forceReopen?: boolean;
        /** @default {RootNames.Dapps} */
        dappsWebViewFromRoute?: (HomeNavigatorParamsList['DappWebViewStubOnHome'] &
          object)['dappsWebViewFromRoute'];
      },
    ) => {
      console.log(url);
      const {
        isActiveDapp = true,
        forceReopen = true,
        dappsWebViewFromRoute = RootNames.Dapps,
      } = options || {};

      const newTab: OpenedDappItem = {
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
        /**
         * @description always push here, because we put RootNames.DappWebViewStubOnHome
         * at top level home-navigator (which's bottom-tabs-navigator)
         **/
        // naviPush(RootNames.StackRoot, {
        //   screen: RootNames.DappWebViewStubOnHome,
        //   params: {
        //     dappsWebViewFromRoute,
        //     // nextOpenDappInfo: dapps[item.origin],
        //   },
        // });

        navigation.dispatch(
          TabActions.jumpTo(RootNames.DappWebViewStubOnHome, {
            dappsWebViewFromRoute,
          }),
        );

        // try trigger notify again
        // setTimeout(() => activate(dapps[item.origin]), 1 * 1e3);
      } else {
        // activate(dapps[item.origin]);
      }

      return true;
    },
    [setTabs, setActiveTab, navigation],
  );

  const removeOpenedDapp = useCallback(
    (tabId: string) => {
      setTabs(prev => prev.filter(item => item.id !== tabId));

      // todo
      if (activeDappOrigin === tabId) {
        setActiveDappOrigin(null);
      }
    },
    [setTabs, activeDappOrigin, setActiveDappOrigin],
  );

  const clearActiveDappOrigin = useCallback(() => {
    setActiveDappOrigin(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setActiveDappOrigin]);

  const closeOpenedDapp = useCallback(
    (dappOrigin: DappInfo['origin']) => {
      removeOpenedDapp(dappOrigin);
      // if (activeDappOrigin === dappOrigin) {
      //   collapseDappWebViewScreen();
      // }
    },
    [removeOpenedDapp],
  );

  return {
    openingActiveDappRef,
    // activeDapp,
    // finalActiveDappId: activeDapp?.origin,
    // openedDappItems,
    activeTab,
    tabs,
    switchToTab,
    closeTab,
    updateTab,
    // expandDappWebViewScreen,
    // collapseDappWebViewScreen,

    openUrlAsDapp,
    removeOpenedDapp,
    closeOpenedDapp,

    clearActiveDappOrigin,
  };
}
