import { createRef, useCallback, useMemo } from 'react';
import { atom, useAtom, useAtomValue } from 'jotai';

import { useSheetModals } from '@/hooks/useSheetModal';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { DappInfo } from '@rabby-wallet/service-dapp';
import { useDapps } from '@/hooks/useDapps';

const activeDappOriginAtom = atom<DappInfo['origin'] | null>(null);

type OpenedDappItem = {
  origin: DappInfo['origin'];
  $openParams?: {
    initialUrl?: string;
  };
};
export type OpenedDappInfo = OpenedDappItem & DappInfo;
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

  const addOpenedDapp = useCallback(
    (
      dappOrigin: DappInfo['origin'] | OpenedDappItem,
      options?: { isActiveDapp?: boolean },
    ) => {
      const item =
        typeof dappOrigin === 'string' ? { origin: dappOrigin } : dappOrigin;

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
    const retOpenedDapps = [] as (OpenedDappItem & DappInfo)[];
    openedDappRecords.forEach(item => {
      if (dapps[item.origin]) {
        retOpenedDapps.push({
          ...item,
          ...dapps[item.origin],
        });
      }
    });

    const retActiveDapp = activeDappOrigin ? dapps[activeDappOrigin] : null;

    return {
      openedDappItems: retOpenedDapps,
      activeDapp: retActiveDapp,
    };
  }, [dapps, activeDappOrigin, openedDappRecords]);

  return {
    activeDapp,
    openedDappItems,

    showDappWebViewModal,
    addOpenedDapp,
    removeOpenedDapp,
    hideActiveDapp,
    closeOpenedDapp,
  };
}

const openedNonDappOriginAtom = atom<string | null>(null);
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
