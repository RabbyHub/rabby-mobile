import { createRef, useCallback, useMemo } from 'react';
import { atom, useAtom, useAtomValue } from 'jotai';

import { useSheetModals } from '@/hooks/useSheetModal';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { DappInfo } from '@/core/services/dappService';
import { useDapps } from '@/hooks/useDapps';
import { canoicalizeDappUrl } from '@rabby-wallet/base-utils/dist/isomorphic/url';
import { createDappBySession } from '@/core/apis/dapp';

const activeDappOriginAtom = atom<DappInfo['origin'] | null>(null);

export type OpenedDappItem = {
  origin: DappInfo['origin'];
  $openParams?: {
    initialUrl?: string;
  };
  maybeDappInfo?: DappInfo;
};
const openedDappRecordsAtom = atom<OpenedDappItem[]>([]);

const activeWebViewSheetModalRefs = atom({
  dappWebviewContainerRef: createRef<BottomSheetModal>(),
  urlWebviewContainerRef: createRef<BottomSheetModal>(),
});

export function useActiveViewSheetModalRefs() {
  return useSheetModals(useAtomValue(activeWebViewSheetModalRefs));
}

export function useOpenDappView() {
  const { dapps } = useDapps();
  const [activeDappOrigin, setActiveDappOrigin] = useAtom(activeDappOriginAtom);

  const { toggleShowSheetModal } = useActiveViewSheetModalRefs();

  // TODO: how about opened non-dapp urls?
  const [openedDappRecords, setOpenedOriginsDapps] = useAtom(
    openedDappRecordsAtom,
  );

  const openUrlAsDapp = useCallback(
    (
      dappUrl: DappInfo['origin'] | OpenedDappItem,
      options?: { isActiveDapp?: boolean },
    ) => {
      const item = typeof dappUrl === 'string' ? { origin: dappUrl } : dappUrl;

      const itemUrl = item.origin;
      item.origin = canoicalizeDappUrl(itemUrl).origin;

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
            ...item.$openParams,
            ...prev[itemIdx].$openParams,
          },
        };

        return [...prev];
      });

      const { isActiveDapp = true } = options || {};

      if (isActiveDapp) {
        setActiveDappOrigin(item.origin);
      }
    },
    [setOpenedOriginsDapps, setActiveDappOrigin],
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

  const hideActiveDapp = useCallback(() => {
    setActiveDappOrigin(null);
  }, [setActiveDappOrigin]);

  const closeActiveDapp = useCallback(() => {
    if (activeDappOrigin) {
      removeOpenedDapp(activeDappOrigin);
    }

    hideActiveDapp();
  }, [hideActiveDapp, removeOpenedDapp, activeDappOrigin]);

  const closeOpenedDapp = useCallback(
    (dappOrigin: DappInfo['origin']) => {
      removeOpenedDapp(dappOrigin);
    },
    [removeOpenedDapp],
  );

  const showDappWebViewModal = useCallback(() => {
    toggleShowSheetModal('dappWebviewContainerRef', true);
  }, [toggleShowSheetModal]);

  const { openedDappItems, activeDapp } = useMemo(() => {
    const retOpenedDapps = [] as OpenedDappItem[];
    openedDappRecords.forEach(item => {
      retOpenedDapps.push({
        ...item,
        maybeDappInfo: dapps[item.origin],
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

  return {
    activeDapp,
    openedDappItems,

    showDappWebViewModal,
    openUrlAsDapp,
    removeOpenedDapp,
    closeOpenedDapp,

    hideActiveDapp,
    closeActiveDapp,
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
