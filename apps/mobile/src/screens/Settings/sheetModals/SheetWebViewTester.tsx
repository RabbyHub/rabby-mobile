import { useCallback } from 'react';
import { Dimensions } from 'react-native';

import {
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { useSheetModalsOnSettingScreen } from './hooks';
import DappWebViewControl from '@/components/WebView/DappWebViewControl';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { devLog } from '@/utils/logger';

const renderBackdrop = (props: BottomSheetBackdropProps) => (
  <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
);

export default function SheetWebViewTester() {
  const {
    sheetModalRefs: { webviewTesterRef },
    toggleShowSheetModal,
  } = useSheetModalsOnSettingScreen();

  const handleSheetChanges = useCallback(
    (index: number) => {
      devLog('handleSheetChanges', index);
      if (index === -1) {
        toggleShowSheetModal('webviewTesterRef', false);
      }
    },
    [toggleShowSheetModal],
  );

  const { top } = useSafeAreaInsets();

  return (
    <BottomSheetModal
      backdropComponent={renderBackdrop}
      enableContentPanningGesture={false}
      ref={webviewTesterRef}
      snapPoints={[Dimensions.get('screen').height - top]}
      onChange={handleSheetChanges}>
      <BottomSheetView className="px-[20] items-center justify-center">
        <DappWebViewControl dappId={'debank.com'} />
      </BottomSheetView>
    </BottomSheetModal>
  );
}
