import React, { useEffect } from 'react';
import { Pressable, View } from 'react-native';

import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { getStyle as getPresetSheetStyle } from './ConvertDustPresetSheet';

export function ConvertDustStopSheet({
  visible,
  onContinue,
  onStop,
}: {
  visible: boolean;
  onContinue: () => void;
  onStop: () => void;
}) {
  const modalRef = React.useRef<AppBottomSheetModal>(null);
  const { styles } = useTheme2024({ getStyle: getPresetSheetStyle });
  const { safeOffBottom } = useSafeSizes();

  useEffect(() => {
    if (visible) {
      modalRef.current?.present();
    } else {
      modalRef.current?.close();
    }
  }, [visible]);

  return (
    <AppBottomSheetModal
      ref={modalRef}
      index={0}
      snapPoints={[220 + safeOffBottom]}
      backgroundStyle={styles.sheetBackground}
      handleStyle={styles.sheetHandle}
      handleIndicatorStyle={styles.sheetHandleIndicator}>
      <BottomSheetView
        style={[styles.presetSheet, { paddingBottom: safeOffBottom + 21 }]}>
        <Text style={styles.presetSheetTitle}>Stop convert?</Text>
        <Text style={styles.stopSheetDesc}>
          Current conversion is paused. You can continue or stop the process.
        </Text>
        <View style={styles.presetActions}>
          <Pressable
            style={[styles.presetActionButton, styles.presetCancelButton]}
            onPress={onContinue}>
            <Text style={[styles.presetActionText, styles.presetCancelText]}>
              Continue
            </Text>
          </Pressable>
          <Pressable
            style={[styles.presetActionButton, styles.stopButton]}
            onPress={onStop}>
            <Text style={[styles.presetActionText, styles.presetConfirmText]}>
              Stop
            </Text>
          </Pressable>
        </View>
      </BottomSheetView>
    </AppBottomSheetModal>
  );
}
