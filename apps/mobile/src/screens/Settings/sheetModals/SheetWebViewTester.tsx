import { useCallback } from 'react';
import { View, Text, Dimensions, StyleSheet } from 'react-native';

import {
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { useSheetModalRefs } from './hooks';
import { useThemeColors } from '@/hooks/theme';
import { Button } from '@/components';
import DappWebViewControl from '@/components/WebView/DappWebViewControl';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { devLog } from '@/utils/logger';

export default function ModalWebViewTesterScreen() {
  const {
    sheetModals: { webviewTesterRef },
  } = useSheetModalRefs();

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

  const { toggleShowSheetModal } = useSheetModalRefs();

  // const handleCloseInputModalPress = useCallback(() => {
  //   toggleShowSheetModal('webviewTesterRef', true, true);
  // }, [toggleShowSheetModal]);

  const handleSheetChanges = useCallback(
    (index: number) => {
      devLog('handleSheetChanges', index);
      if (index === -1) {
        toggleShowSheetModal('webviewTesterRef', false, true);
      }
    },
    [toggleShowSheetModal],
  );

  const colors = useThemeColors();

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
          <DappWebViewControl />
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
}
