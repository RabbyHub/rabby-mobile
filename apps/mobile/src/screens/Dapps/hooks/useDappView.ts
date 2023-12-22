import { createRef } from 'react';
import { atom, useAtom, useAtomValue } from 'jotai';

import {
  DappBottomSheetModalRefs,
  useSheetModals,
} from '@/hooks/useSheetModal';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { DappInfo } from '@rabby-wallet/service-dapp';

const activeDappAtom = atom<DappInfo | null>(null);

export function useActiveDappView() {
  const [activeDapp, setActiveDapp] = useAtom(activeDappAtom);

  return {
    activeDapp,
    setActiveDapp,
  };
}

const activeDappViewSheetModalRefs = atom({
  webviewContainerRef: createRef<BottomSheetModal>(),
});

export function useActiveDappViewSheetModalRefs() {
  return useSheetModals(useAtomValue(activeDappViewSheetModalRefs));
}
