import { createRef, useCallback, useMemo, useRef } from 'react';
import { atom, useAtom, useAtomValue } from 'jotai';

import { DappInfo } from '@/core/services/dappService';
import { useDapps } from '@/hooks/useDapps';
import { canoicalizeDappUrl } from '@rabby-wallet/base-utils/dist/isomorphic/url';
import { createDappBySession, syncBasicDappInfo } from '@/core/apis/dapp';
import { isOrHasWithAllowedProtocol } from '@/constant/dappView';
import {
  ActiveDappState,
  activeDappStateEvents,
  globalSetActiveDappState,
} from '@/core/bridges/state';
import useDebounceValue from '@/hooks/common/useDebounceValue';
import { stringUtils, urlUtils, hashUtils } from '@rabby-wallet/base-utils';
import {
  useSceneAccountInfo,
  useSwitchSceneCurrentAccount,
} from '@/hooks/accountsSwitcher';
import { isNonPublicProductionEnv } from '@/constant/env';
import { useRefState } from '@/hooks/common/useRefState';
import { useDappsViewConfig } from './useDappView';
import {
  getLatestNavigationName,
  navigate,
  naviPush,
} from '@/utils/navigation';
import { RootNames } from '@/constant/layout';
import { IS_ANDROID } from '@/core/native/utils';
import { HomeNavigatorParamsList } from '@/navigation-type';
import { preferenceService } from '@/core/services';
import { apisDapp } from '@/core/apis';
import { TabActions, useNavigation } from '@react-navigation/native';
import { v4 as uuid } from 'uuid';
import { useMemoizedFn } from 'ahooks';

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
  /**
   * @description timestamp on opening
   *
   * // TODO: clear it if time changed
   *
   **/
  openTime: number;
  lastOpenWebViewId?: string | null;
};

export type Tab = OpenedDappItem;

const DAPPS_VIEW_LIMIT = {
  maxCount: 1,
  // 30days
  expireDuration: 3 * 86400 * 1e3,
};
const DAPPS_VIEW_LIMIT_SHORT = {
  maxCount: 1,
  // 5 mins
  expireDuration: 5 * 60 * 1e3,
};
const dappsViewConfigAtom = atom({
  maxCount: DAPPS_VIEW_LIMIT.maxCount,
  expireDuration: isNonPublicProductionEnv
    ? DAPPS_VIEW_LIMIT_SHORT.expireDuration
    : DAPPS_VIEW_LIMIT.expireDuration,
});

const tabsAtom = atom<Tab[]>([]);

const activeTabAtom = atom<Tab | undefined | null>(null);

/**
 * auto activate and inactivate last used account in dapp
 */
const useDappLastUsedAccount = () => {
  const { switchSceneCurrentAccount } = useSwitchSceneCurrentAccount();
  const { computeFinalSceneAccount } = useSceneAccountInfo({
    forScene: '@ActiveDappWebViewModal',
  });

  const activate = useCallback(
    (dapp: DappInfo) => {
      if (!dapp.currentAccount) return;

      switchSceneCurrentAccount(
        '@ActiveDappWebViewModal',
        computeFinalSceneAccount(dapp.currentAccount),
      );
    },
    [switchSceneCurrentAccount, computeFinalSceneAccount],
  );

  const inactivate = useCallback(() => {
    switchSceneCurrentAccount('@ActiveDappWebViewModal', null);
  }, [switchSceneCurrentAccount]);

  return {
    activate,
    inactivate,
  };
};

export const OPEN_DAPP_VIEW_INDEXES = {
  expanded: 1,
  collapsed: 0,
};
export type DappWebViewHideContext = {
  webviewId: string | undefined;
  dappOrigin: string;
  latestUrl?: string;
};
export function useDappWebViewScreen() {
  // const { dapps, addDapp } = useDapps();
  const [activeDappOrigin, _setActiveDappOrigin] =
    useAtom(activeDappOriginAtom);

  // const { activate, inactivate } = useDappLastUsedAccount();

  const navigation = useNavigation();

  // const openingActiveDappRef = useRef<boolean>(false);
  const { stateRef: openingActiveDappRef } = useRefState<any>(false);
  const setActiveDappOrigin = useCallback(
    (origin: DappInfo['origin'] | null) => {
      globalSetActiveDappState({ dappOrigin: origin });
      _setActiveDappOrigin(origin);

      if (!origin) {
        preferenceService.toggleAllowNotifyAccountsChanged(false);
        // inactivate();
      }
    },
    [_setActiveDappOrigin],
  );

  const [tabs, setTabs] = useAtom(tabsAtom);
  const [activeTab, setActiveTab] = useAtom(activeTabAtom);
  const switchToTab = useMemoizedFn((tab: Tab) => {
    setActiveTab(tab);
  });
  const closeTab = useMemoizedFn((tab: Tab) => {
    if (tab.id === activeTab?.id) {
      const index = tabs.findIndex(item => item.id === tab.id);
      if (index === -1) {
        return;
      }
      const newActiveTab = tabs[index + 1] || tabs[index - 1];
      setActiveTab(newActiveTab);
    }
    const newTabs = tabs.filter(item => item.id !== tab.id);
    setTabs(newTabs);
    if (newTabs.length <= 0) {
      // todo
      navigation.goBack();
    }
  });

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
    // expandDappWebViewScreen,
    // collapseDappWebViewScreen,

    openUrlAsDapp,
    removeOpenedDapp,
    closeOpenedDapp,

    clearActiveDappOrigin,
  };
}

const openedNonDappOriginAtom = atom<string | null>(null);
/**
 * @deprecated
 */
export function useOpenUrlView() {
  const [openedNonDappOrigin, setOpenedNonDappOrigin] = useAtom(
    openedNonDappOriginAtom,
  );

  const setOpenedUrl = useCallback(
    (url: string) => {
      setOpenedNonDappOrigin(url);
    },
    [setOpenedNonDappOrigin],
  );

  const removeOpenedUrl = useCallback(() => {
    setOpenedNonDappOrigin(null);
  }, [setOpenedNonDappOrigin]);

  return {
    openedNonDappOrigin,
    setOpenedUrl,
    removeOpenedUrl,
  };
}
