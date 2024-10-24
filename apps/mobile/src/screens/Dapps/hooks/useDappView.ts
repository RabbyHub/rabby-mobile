import { createRef, useCallback, useMemo } from 'react';
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
};
const openedDappRecordsAtom = atom<OpenedDappItem[]>([]);

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

export const OPEN_DAPP_VIEW_INDEXES = {
  expanded: 1,
  collapsed: 0,
};
export function useOpenDappView() {
  const { dapps, addDapp } = useDapps();
  // const { activeDappOrigin, setActiveDappState } = useOpenedActiveDappState();
  const [activeDappOrigin, _setActiveDappOrigin] =
    useAtom(activeDappOriginAtom);

  const setActiveDappOrigin = useCallback(
    (origin: DappInfo['origin'] | null) => {
      globalSetActiveDappState({ dappOrigin: origin });
      _setActiveDappOrigin(origin);
    },
    [_setActiveDappOrigin],
  );

  const { toggleShowSheetModal } = useActiveViewSheetModalRefs();

  // TODO: how about opened non-dapp urls?
  const [openedDappRecords, setOpenedOriginsDapps] = useAtom(
    openedDappRecordsAtom,
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
          ? { origin: dappUrl, dappTabId: makeDappTabId() }
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
        };

        return [...prev];
      });

      if (isActiveDapp) {
        setActiveDappOrigin(item.origin);
      }

      return true;
    },
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

  const onHideActiveDapp = useCallback(() => {
    setActiveDappOrigin(null);
  }, [setActiveDappOrigin]);

  const closeActiveOpenedDapp = useCallback(() => {
    if (activeDappOrigin) {
      removeOpenedDapp(activeDappOrigin);
    }

    collapseDappWebViewModal();
    onHideActiveDapp();
  }, [
    onHideActiveDapp,
    collapseDappWebViewModal,
    removeOpenedDapp,
    activeDappOrigin,
  ]);

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
    openedDappItems,
    setActiveDappOrigin,

    expandDappWebViewModal,
    collapseDappWebViewModal,

    openUrlAsDapp,
    removeOpenedDapp,
    closeOpenedDapp,

    onHideActiveDapp,
    closeActiveOpenedDapp,
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
