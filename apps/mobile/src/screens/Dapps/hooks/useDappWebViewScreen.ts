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
import { useDebouncedValue } from '@/hooks/common/delayLikeValue';
import { stringUtils, urlUtils, hashUtils } from '@rabby-wallet/base-utils';
import {
  useSceneAccountInfo,
  useSwitchSceneCurrentAccount,
} from '@/hooks/accountsSwitcher';
import { isNonPublicProductionEnv } from '@/constant';
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
  origin: DappInfo['origin'];
  dappTabId: string;
  $openParams?: {
    initialUrl?: string;
  };
  maybeDappInfo?: DappInfo;
  /**
   * @description timestamp on opening
   *
   * // TODO: clear it if time changed
   *
   **/
  openTime: number;
  lastOpenWebViewId?: string | null;
};
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
const openedDappWebViewRecordsAtom = atom<OpenedDappItem[]>([]);
/**
 * @deprecated
 */
export function useOpenedDappsRecordsOnDEV() {
  const openedDappRecords = useAtomValue(openedDappWebViewRecordsAtom);

  return {
    openedDappRecords,
  };
}

function makeDappWebViewTabId(seed?: string) {
  if (seed) {
    return hashUtils.djb2hash(seed).toString(16);
  }

  return stringUtils.randString(8);
}

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
  const { dapps, addDapp } = useDapps();
  const [activeDappOrigin, _setActiveDappOrigin] =
    useAtom(activeDappOriginAtom);

  const { activate, inactivate } = useDappLastUsedAccount();

  // const openingActiveDappRef = useRef<boolean>(false);
  const { stateRef: openingActiveDappRef } = useRefState<any>(false);
  const setActiveDappOrigin = useCallback(
    (origin: DappInfo['origin'] | null) => {
      globalSetActiveDappState({ dappOrigin: origin });
      _setActiveDappOrigin(origin);

      if (!origin) {
        preferenceService.toggleAllowNotifyAccountsChanged(false);
        inactivate();
      }
    },
    [_setActiveDappOrigin, inactivate],
  );

  const { dappsViewConfig } = useDappsViewConfig();

  // TODO: how about opened non-dapp urls?
  const [openedDappRecords, _setOpenedOriginsDapps] = useAtom(
    openedDappWebViewRecordsAtom,
  );
  const setOpenedOriginsDapps = useCallback<typeof _setOpenedOriginsDapps>(
    valueOrFunc => {
      let nextVal =
        typeof valueOrFunc === 'function'
          ? valueOrFunc(openedDappRecords)
          : valueOrFunc;
      if (nextVal.length > dappsViewConfig.maxCount) {
        // sort desc by openTime
        nextVal.sort((a, b) => b.openTime - a.openTime);
      }

      // trim all dapps expired
      nextVal = nextVal.filter(
        item => Date.now() - item.openTime <= dappsViewConfig.expireDuration,
      );

      _setOpenedOriginsDapps(nextVal.slice(0, dappsViewConfig.maxCount));
    },
    [openedDappRecords, _setOpenedOriginsDapps, dappsViewConfig],
  );

  const expandDappWebViewScreen = useCallback(
    ({ onDone }: { onDone?: () => void } = {}) => {
      if (openingActiveDappRef.current) return;

      openingActiveDappRef.current = setTimeout(() => {
        openingActiveDappRef.current = false;
        onDone?.();
      }, 500);
    },
    [openingActiveDappRef],
  );

  const setLastWebViewIdByDappOrigin = useCallback(
    (
      dappOrigin: DappInfo['origin'],
      input: {
        webviewId?: string;
        url?: string;
      },
    ) => {
      if (
        !input.url ||
        urlUtils.canoicalizeDappUrl(input.url).httpOrigin !== dappOrigin
      )
        return;

      setOpenedOriginsDapps(prev => {
        const itemIdx = prev.findIndex(item => item.origin === dappOrigin);
        if (itemIdx === -1) return prev;

        prev[itemIdx].lastOpenWebViewId = input.webviewId || null;

        return [...prev];
      });
    },
    [setOpenedOriginsDapps],
  );

  const collapseDappWebViewScreen = useCallback(
    (ctx?: DappWebViewHideContext) => {
      const result = { willClose: false };
      if (openingActiveDappRef.current) return result;

      if (ctx?.dappOrigin && ctx.webviewId) {
        setLastWebViewIdByDappOrigin(ctx.dappOrigin, {
          webviewId: ctx.webviewId,
          url: ctx.latestUrl,
        });
      }

      result.willClose = true;

      return result;
    },
    [openingActiveDappRef, setLastWebViewIdByDappOrigin],
  );

  const openUrlAsDapp = useCallback(
    (
      dappUrl: DappInfo['origin'] | OpenedDappItem,
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
        forceReopen = false,
        dappsWebViewFromRoute = RootNames.Dapps,
      } = options || {};
      let useLatestWebViewId = true;
      if (forceReopen) useLatestWebViewId = false;

      const item =
        typeof dappUrl === 'string'
          ? {
              origin: dappUrl,
              dappTabId: '',
              openTime: Date.now(),
            }
          : dappUrl;

      const newUrl = item.origin;
      const { httpOrigin: targetOrigin, urlInfo } = canoicalizeDappUrl(
        item.origin,
      );
      item.dappTabId = makeDappWebViewTabId(targetOrigin);

      if (!isOrHasWithAllowedProtocol(urlInfo?.protocol)) return false;

      item.origin = targetOrigin;

      if (!dapps[item.origin]) {
        addDapp(
          createDappBySession({
            origin: item.origin,
            name: '',
            icon: '',
          }),
        );
      }

      // this will change data in dapps backend, maybe not sync with dappInfo, but we don't need basic info later
      syncBasicDappInfo(item.origin);

      const dappInfo: DappInfo = dapps[item.origin];
      if (!dappInfo.currentAccount) {
        const account = apisDapp.setCurrentAccountForDapp(item.origin);
        dappInfo.currentAccount = account;
      }

      const needTriggerWebViewReload =
        forceReopen || item.$openParams?.initialUrl !== newUrl;

      const $openParams = { ...item.$openParams };
      if (needTriggerWebViewReload) {
        $openParams.initialUrl = item.$openParams?.initialUrl || newUrl;
        item.$openParams = $openParams;
      }

      setOpenedOriginsDapps(prev => {
        const itemIdx = prev.findIndex(
          prevItem => prevItem.origin === item.origin,
        );
        if (itemIdx === -1) {
          return [...prev, item];
        }

        prev[itemIdx] = {
          ...prev[itemIdx],
          openTime: Date.now(),
        };

        if (
          useLatestWebViewId &&
          prev[itemIdx].lastOpenWebViewId === prev[itemIdx].dappTabId
        ) {
          // call to open active id
          setActiveDappOrigin(item.origin);
          console.debug(
            `[dapp webview - ${prev[itemIdx].dappTabId}] just show webview.`,
          );
        } else {
          prev[itemIdx] = {
            ...prev[itemIdx],
            $openParams: {
              ...prev[itemIdx].$openParams,
              ...$openParams,
            },
          };
          console.debug(
            `[dapp webview - ${prev[itemIdx].dappTabId}] will redirect webview.`,
          );
        }

        return [...prev];
      });

      if (isActiveDapp) {
        setActiveDappOrigin(item.origin);
      }

      preferenceService.toggleAllowNotifyAccountsChanged(true);

      activate(dappInfo);

      const routeName = getLatestNavigationName();
      const needRedirect =
        routeName && routeName !== RootNames.DappWebViewStubOnHome;
      if (needRedirect) {
        /**
         * @description always push here, because we put RootNames.DappWebViewStubOnHome
         * at top level home-navigator (which's bottom-tabs-navigator)
         **/
        naviPush(RootNames.StackRoot, {
          screen: RootNames.DappWebViewStubOnHome,
          params: {
            dappsWebViewFromRoute,
            // nextOpenDappInfo: dapps[item.origin],
          },
        });
        // try trigger notify again
        setTimeout(() => activate(dapps[item.origin]), 1 * 1e3);
      } else {
        activate(dapps[item.origin]);
      }

      return true;
    },
    [dapps, setOpenedOriginsDapps, addDapp, setActiveDappOrigin, activate],
  );

  const removeOpenedDapp = useCallback(
    (dappOrigin: DappInfo['origin']) => {
      if (IS_ANDROID) {
        // dont keep the dapp in the stack on android
        setOpenedOriginsDapps([]);
      } else {
        setOpenedOriginsDapps(prev =>
          prev.filter(item => item.origin !== dappOrigin),
        );
      }

      if (activeDappOrigin === dappOrigin) {
        setActiveDappOrigin(null);
      }
    },
    [setOpenedOriginsDapps, activeDappOrigin, setActiveDappOrigin],
  );

  const clearActiveDappOrigin = useCallback(() => {
    setActiveDappOrigin(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setActiveDappOrigin]);

  const closeOpenedDapp = useCallback(
    (dappOrigin: DappInfo['origin']) => {
      removeOpenedDapp(dappOrigin);
      if (activeDappOrigin === dappOrigin) {
        collapseDappWebViewScreen();
      }
    },
    [removeOpenedDapp, activeDappOrigin, collapseDappWebViewScreen],
  );

  const originalInfo = useMemo(() => {
    const retOpenedDapps = [] as OpenedDappItem[];
    openedDappRecords.forEach(item => {
      retOpenedDapps.push({
        ...item,
        maybeDappInfo: dapps[item.origin]
          ? dapps[item.origin]
          : createDappBySession({
              origin: item.origin,
              name: '',
              icon: '',
            }),
      });
    });

    const retActiveDapp = activeDappOrigin
      ? dapps[activeDappOrigin] ||
        createDappBySession({
          origin: activeDappOrigin,
          name: 'Temp Dapp',
          icon: '',
        })
      : null;

    return {
      openedDappItems: retOpenedDapps,
      activeDapp: retActiveDapp,
    };
  }, [dapps, activeDappOrigin, openedDappRecords]);

  const openedDappItems = useDebouncedValue(originalInfo.openedDappItems, 100);
  const activeDapp = useDebouncedValue(originalInfo.activeDapp, 250);

  return {
    openingActiveDappRef,
    activeDapp,
    finalActiveDappId: activeDapp?.origin,
    openedDappItems,

    expandDappWebViewScreen,
    collapseDappWebViewScreen,

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
