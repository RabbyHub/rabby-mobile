import { createRef, useCallback, useMemo, useRef } from 'react';
import { atom, useAtom, useAtomValue } from 'jotai';

import { useSheetModals } from '@/hooks/useSheetModal';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
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
import { stringUtils } from '@rabby-wallet/base-utils';
import { useAccountSceneVisible } from '@/components/AccountSwitcher/hooks';
import { useSwitchSceneCurrentAccount } from '@/hooks/accountsSwitcher';
import { isNonPublicProductionEnv } from '@/constant/env';

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
};
const DAPPS_VIEW_LIMIT = {
  maxCount: 3,
  // 30days
  expireDuration: 3 * 86400 * 1e3,
};
const DAPPS_VIEW_LIMIT_SHORT = {
  maxCount: 3,
  // 5 mins
  expireDuration: 5 * 60 * 1e3,
};
const dappsViewConfigAtom = atom({
  maxCount: DAPPS_VIEW_LIMIT.maxCount,
  expireDuration: isNonPublicProductionEnv
    ? DAPPS_VIEW_LIMIT_SHORT.expireDuration
    : DAPPS_VIEW_LIMIT.expireDuration,
});
const openedDappRecordsAtom = atom<OpenedDappItem[]>([]);
/**
 * @deprecated
 */
export function useOpenedDappsRecordsOnDEV() {
  const openedDappRecords = useAtomValue(openedDappRecordsAtom);

  return {
    openedDappRecords,
  };
}

const activeWebViewSheetModalRefs = atom({
  openedDappWebviewSheetModalRef: createRef<BottomSheetModal>(),
  urlWebviewContainerRef: createRef<BottomSheetModal>(),
});

export function useActiveViewSheetModalRefs() {
  return useSheetModals(useAtomValue(activeWebViewSheetModalRefs));
}

export function makeDappTabId() {
  return stringUtils.randString(8);
}

export function useDappsViewConfig() {
  const [config, setConfig] = useAtom(dappsViewConfigAtom);

  const { isUsingShort, dappsViewConfig } = useMemo(() => {
    const result = {
      isUsingShort: false,
      dappsViewConfig: { ...config },
    };
    if (!isNonPublicProductionEnv)
      result.dappsViewConfig.expireDuration = DAPPS_VIEW_LIMIT.expireDuration;

    result.isUsingShort =
      result.dappsViewConfig.expireDuration ===
      DAPPS_VIEW_LIMIT_SHORT.expireDuration;

    return result;
  }, [config]);

  const toggleUseShortConfig = useCallback(
    (nextUseShort: boolean = !isUsingShort) => {
      if (nextUseShort) {
        setConfig({ ...DAPPS_VIEW_LIMIT_SHORT });
      } else {
        setConfig({ ...DAPPS_VIEW_LIMIT });
      }
    },
    [isUsingShort, setConfig],
  );

  return {
    toggleUseShortConfig,
    dappsViewConfig,
  };
}

/**
 * auto activate and inactivate last used account in dapp
 */
export const useDappLastUsedAccount = () => {
  const { switchSceneCurrentAccount } = useSwitchSceneCurrentAccount();

  const activate = useCallback(
    (dapp: DappInfo) => {
      dapp.currentAccount &&
        switchSceneCurrentAccount(
          '@ActiveDappWebViewModal',
          dapp.currentAccount,
        );
    },
    [switchSceneCurrentAccount],
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
export function useOpenDappView() {
  const { dapps, addDapp } = useDapps();
  const [activeDappOrigin, _setActiveDappOrigin] =
    useAtom(activeDappOriginAtom);

  const dappLastUsedAccount = useDappLastUsedAccount();
  const { switchSceneCurrentAccount } = useSwitchSceneCurrentAccount();

  const setActiveDappOrigin = useCallback(
    (origin: DappInfo['origin'] | null) => {
      globalSetActiveDappState({ dappOrigin: origin });
      _setActiveDappOrigin(origin);

      if (!origin) {
        dappLastUsedAccount.inactivate();
      } else {
        const dappInfo = dapps[origin];
        switchSceneCurrentAccount(
          '@ActiveDappWebViewModal',
          dappInfo.currentAccount || null,
        );
      }
    },
    [
      _setActiveDappOrigin,
      dappLastUsedAccount,
      dapps,
      switchSceneCurrentAccount,
    ],
  );

  const { toggleShowSheetModal } = useActiveViewSheetModalRefs();

  const { dappsViewConfig } = useDappsViewConfig();

  // TODO: how about opened non-dapp urls?
  const [openedDappRecords, _setOpenedOriginsDapps] = useAtom(
    openedDappRecordsAtom,
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

  const showDappWebViewModal = useCallback(() => {
    toggleShowSheetModal('openedDappWebviewSheetModalRef', true);
  }, [toggleShowSheetModal]);

  const expandDappWebViewModal = useCallback(() => {
    toggleShowSheetModal(
      'openedDappWebviewSheetModalRef',
      OPEN_DAPP_VIEW_INDEXES.expanded,
    );
  }, [toggleShowSheetModal]);

  const collapseDappWebViewModal = useCallback(() => {
    toggleShowSheetModal(
      'openedDappWebviewSheetModalRef',
      OPEN_DAPP_VIEW_INDEXES.collapsed,
    );
  }, [toggleShowSheetModal]);

  const openUrlAsDapp = useCallback(
    (
      dappUrl: DappInfo['origin'] | OpenedDappItem,
      options?: {
        /** @default {true} */
        isActiveDapp?: boolean;
        /** @default {false} */
        showSheetModalFirst?: boolean;
      },
    ) => {
      const { isActiveDapp = true, showSheetModalFirst = false } =
        options || {};

      const item =
        typeof dappUrl === 'string'
          ? {
              origin: dappUrl,
              dappTabId: makeDappTabId(),
              openTime: Date.now(),
            }
          : dappUrl;

      const itemUrl = item.origin;
      const { origin: targetOrigin, urlInfo } = canoicalizeDappUrl(itemUrl);
      if (!isOrHasWithAllowedProtocol(urlInfo?.protocol)) return false;

      if (showSheetModalFirst) showDappWebViewModal();

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

      syncBasicDappInfo(item.origin);

      item.$openParams = {
        ...item.$openParams,
        initialUrl: item.$openParams?.initialUrl || itemUrl,
      };

      setOpenedOriginsDapps(prev => {
        const itemIdx = prev.findIndex(
          prevItem => prevItem.origin === item.origin,
        );
        if (itemIdx === -1) {
          return [...prev, item];
        }

        prev[itemIdx] = {
          ...prev[itemIdx],
          $openParams: {
            ...prev[itemIdx].$openParams,
            ...item.$openParams,
          },
          openTime: Date.now(),
        };

        return [...prev];
      });

      if (isActiveDapp) {
        setActiveDappOrigin(item.origin);
      }

      dappLastUsedAccount.activate(dapps[item.origin]);

      return true;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      showDappWebViewModal,
      dapps,
      setOpenedOriginsDapps,
      addDapp,
      setActiveDappOrigin,
    ],
  );

  const removeOpenedDapp = useCallback(
    (dappOrigin: DappInfo['origin']) => {
      setOpenedOriginsDapps(prev =>
        prev.filter(item => item.origin !== dappOrigin),
      );

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

  const closeActiveOpenedDapp = useCallback(() => {
    if (activeDappOrigin) {
      removeOpenedDapp(activeDappOrigin);
    }

    collapseDappWebViewModal();
  }, [collapseDappWebViewModal, removeOpenedDapp, activeDappOrigin]);

  const collapseActiveOpenedDapp = useCallback(() => {
    collapseDappWebViewModal();
  }, [collapseDappWebViewModal]);

  const closeOpenedDapp = useCallback(
    (dappOrigin: DappInfo['origin']) => {
      removeOpenedDapp(dappOrigin);
      if (activeDappOrigin === dappOrigin) {
        closeActiveOpenedDapp();
      } else {
        removeOpenedDapp(dappOrigin);
      }
    },
    [activeDappOrigin, removeOpenedDapp, closeActiveOpenedDapp],
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

  const openedDappItems = useDebounceValue(originalInfo.openedDappItems, 100);
  const activeDapp = useDebounceValue(originalInfo.activeDapp, 250);

  return {
    activeDapp,
    finalActiveDappId: activeDapp?.origin,
    openedDappItems,

    expandDappWebViewModal,
    collapseDappWebViewModal,

    openUrlAsDapp,
    removeOpenedDapp,
    closeOpenedDapp,

    clearActiveDappOrigin,
    closeActiveOpenedDapp,
    collapseActiveOpenedDapp,
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
