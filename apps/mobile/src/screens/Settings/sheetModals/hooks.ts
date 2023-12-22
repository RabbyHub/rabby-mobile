import * as React from 'react';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { atom, useAtomValue } from 'jotai';
import { useSheetModals } from '@/hooks/useSheetModal';

export const sheetModalRefAtom = atom({
  webviewTesterRef: React.createRef<BottomSheetModal>(),
});

export function useSheetModalsOnSettingScreen() {
  const sheetModals = useAtomValue(sheetModalRefAtom);

  return useSheetModals(sheetModals);
}
