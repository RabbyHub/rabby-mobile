import { useCallback } from 'react';
import { View, Text, Dimensions, StyleSheet } from 'react-native';

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

export default function SheetWebViewTester() {
  const {
    sheetModalRefs: { webviewTesterRef },
    toggleShowSheetModal,
  } = useSheetModalsOnSettingScreen();

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
      />
    ),
    [],
  );

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
        <View className="w-[100%]">
          <DappWebViewControl dappId={'debank.com'} />
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
}
