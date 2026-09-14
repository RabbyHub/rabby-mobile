import { AppBottomSheetModal } from '@/components';
import { Text } from '@/components/Typography';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import React, { useEffect, useRef } from 'react';
import { Pressable, View } from 'react-native';

import type { PerpsProBboStrategy } from '../../model/bbo';
import { getPerpsProDialogStyles } from '../common/perpsProDialogVisual';
import { PerpsProDialogBackdrop } from '../common/PerpsProDialogBackdrop';
import { usePerpsProSheetNavigationRegistration } from '../common/perpsProSheetNavigationRegistry';

export interface PerpsProBboOption {
  label: string;
  value: PerpsProBboStrategy;
}

export const PerpsProBboSheet: React.FC<{
  onClose: () => void;
  onSelect: (value: PerpsProBboStrategy) => void;
  options: readonly PerpsProBboOption[];
  selected: PerpsProBboStrategy | null;
  visible: boolean;
}> = React.memo(({ onClose, onSelect, options, selected, visible }) => {
  const modalRef = useRef<AppBottomSheetModal>(null);
  const { colors2024, styles } = useTheme2024({ getStyle });
  usePerpsProSheetNavigationRegistration({
    active: visible,
    dismiss: onClose,
  });

  useEffect(() => {
    if (visible) modalRef.current?.present();
    else modalRef.current?.close();
  }, [visible]);

  return (
    <AppBottomSheetModal
      onDismiss={onClose}
      ref={modalRef}
      {...makeBottomSheetProps({
        colors: colors2024,
        linearGradientType: 'bg0',
      })}
      enableDynamicSizing
      backdropComponent={PerpsProDialogBackdrop}
      backgroundStyle={styles.background}
      handleIndicatorStyle={styles.handleIndicator}
      handleStyle={styles.handle}
      style={styles.modal}>
      <BottomSheetView style={styles.sheet}>
        <View style={styles.content}>
          <Text style={styles.title}>BBO</Text>
          <View style={styles.options}>
            {options.map(option => {
              const active = option.value === selected;
              return (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  key={option.value}
                  onPress={() => {
                    onSelect(option.value);
                    onClose();
                  }}
                  style={[
                    styles.option,
                    active ? styles.optionActive : styles.optionInactive,
                  ]}
                  testID={`perps-pro-bbo-${option.value}`}>
                  <Text style={styles.label}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </BottomSheetView>
    </AppBottomSheetModal>
  );
});

PerpsProBboSheet.displayName = 'PerpsProBboSheet';

const getStyle = createGetStyles2024(({ colors2024, safeAreaInsets }) => ({
  ...getPerpsProDialogStyles(colors2024, safeAreaInsets.bottom),
}));
