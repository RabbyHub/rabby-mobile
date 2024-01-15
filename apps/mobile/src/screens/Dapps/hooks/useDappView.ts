import { createRef, useCallback, useMemo } from 'react';
import { atom, useAtom, useAtomValue } from 'jotai';

import { useSheetModals } from '@/hooks/useSheetModal';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { DappInfo } from '@rabby-wallet/service-dapp';
import { useDapps } from '@/hooks/useDapps';

const activeDappOriginAtom = atom<DappInfo['origin'] | null>(null);
const openedDappOriginsAtom = atom<DappInfo['origin'][]>([]);

export function useOpenDappView() {
  const { dapps } = useDapps();
  const [activeDappOrigin, setActiveDappOrigin] = useAtom(activeDappOriginAtom);

  // TODO: how about opened non-dapp urls?
  const [openedDappOrigins, setOpenedOriginsDapps] = useAtom(
    openedDappOriginsAtom,
  );

  const addOpenedDapp = useCallback(
    (dappOrigin: DappInfo['origin'], options?: { isActiveDapp?: boolean }) => {
      setOpenedOriginsDapps(prev => {
        if (!prev.includes(dappOrigin)) {
          return [...prev, dappOrigin];
        }

        return prev;
      });

      if (options?.isActiveDapp) {
        setActiveDappOrigin(activeDappOrigin);
      }
    },
    [setOpenedOriginsDapps, setActiveDappOrigin],
  );

  const removeOpenedDapp = useCallback(
    (dappOrigin: DappInfo['origin']) => {
      setOpenedOriginsDapps(prev => prev.filter(item => item !== dappOrigin));

      if (activeDappOrigin === dappOrigin) {
        setActiveDappOrigin(null);
      }
    },
    [setOpenedOriginsDapps, activeDappOrigin],
  );

  const hideActiveDapp = useCallback(
    (dappOrigin?: DappInfo['origin']) => {
      setActiveDappOrigin(null);
    },
    [setActiveDappOrigin],
  );

  const closeOpenedDapp = useCallback(
    (dappOrigin: DappInfo['origin']) => {
      removeOpenedDapp(dappOrigin);
    },
    [removeOpenedDapp],
  );

  const { openedDapps, activeDapp } = useMemo(() => {
    const retOpenedDapps = [] as DappInfo[];
    openedDappOrigins.forEach(origin => {
      if (dapps[origin]) {
        retOpenedDapps.push(dapps[origin]);
      }
    });

    const regActiveDapp = activeDappOrigin ? dapps[activeDappOrigin] : null;

    return {
      openedDapps: retOpenedDapps,
      activeDapp: regActiveDapp,
    };
  }, [dapps, activeDappOrigin, openedDappOrigins]);

  return {
    activeDapp,
    openedDappOrigins,
    openedDapps,

    addOpenedDapp,
    removeOpenedDapp,
    hideActiveDapp,
    closeOpenedDapp,
  };
}

const activeWebViewSheetModalRefs = atom({
  dappWebviewContainerRef: createRef<BottomSheetModal>(),
  urlWebviewContainerRef: createRef<BottomSheetModal>(),
});

export function useActiveViewSheetModalRefs() {
  return useSheetModals(useAtomValue(activeWebViewSheetModalRefs));
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
