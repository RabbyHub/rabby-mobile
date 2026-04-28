import React, { useEffect, useState } from 'react';
import { Pressable, TouchableOpacity, View } from 'react-native';

import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetView } from '@gorhom/bottom-sheet';

export type ConvertDustPresetOption = {
  label: string;
  value: string;
};

export function ConvertDustPresetSheet({
  visible,
  title,
  value,
  options,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  title: string;
  value: string;
  options: readonly ConvertDustPresetOption[];
  onCancel: () => void;
  onConfirm: (value: string) => void;
}) {
  const modalRef = React.useRef<AppBottomSheetModal>(null);
  const { styles } = useTheme2024({ getStyle });
  const [draftValue, setDraftValue] = useState(value);

  useEffect(() => {
    if (visible) {
      setDraftValue(value);
      modalRef.current?.present();
    } else {
      modalRef.current?.close();
    }
  }, [value, visible]);

  return (
    <AppBottomSheetModal
      ref={modalRef}
      index={0}
      snapPoints={[258]}
      onDismiss={onCancel}
      // backgroundStyle={styles.sheetBackground}
    >
      <BottomSheetView style={[styles.presetSheet]}>
        <Text style={styles.presetSheetTitle}>{title}</Text>
        <View style={styles.presetOptions}>
          {options.map(option => {
            const selected = draftValue === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => setDraftValue(option.value)}
                style={[
                  styles.presetOption,
                  selected && styles.presetOptionActive,
                ]}>
                <Text
                  style={[
                    styles.presetOptionText,
                    selected && styles.presetOptionTextActive,
                  ]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.presetActions}>
          <TouchableOpacity
            style={[styles.presetActionButton, styles.presetCancelButton]}
            onPress={onCancel}>
            <Text style={[styles.presetActionText, styles.presetCancelText]}>
              Cancel
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.presetActionButton, styles.presetConfirmButton]}
            onPress={() => onConfirm(draftValue)}>
            <Text style={[styles.presetActionText, styles.presetConfirmText]}>
              Confirm
            </Text>
          </TouchableOpacity>
        </View>
      </BottomSheetView>
    </AppBottomSheetModal>
  );
}

export const getStyle = createGetStyles2024(({ colors2024 }) => ({
  sheetBackground: {
    backgroundColor: colors2024['neutral-bg-1'],
  },
  sheet: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  sheetHandle: {
    backgroundColor: colors2024['neutral-bg-1'],
  },
  sheetHandleIndicator: {
    width: 50,
    height: 6,
    borderRadius: 100,
    backgroundColor: colors2024['neutral-line'],
  },
  presetSheet: {
    paddingTop: 20,
    paddingHorizontal: 19,
  },
  presetSheetTitle: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 24,
    textAlign: 'center',
  },
  stopSheetDesc: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    marginTop: 12,
    textAlign: 'center',
  },
  presetOptions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 25,
  },
  presetOption: {
    flex: 1,
    height: 40,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors2024['neutral-bg-5'],
    borderWidth: 1,
    borderColor: 'transparent',
  },
  presetOptionActive: {
    backgroundColor: colors2024['brand-light-1'],
    borderColor: colors2024['brand-light-2'],
  },
  presetOptionText: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
  presetOptionTextActive: {
    color: colors2024['brand-default'],
  },
  presetActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 25,
  },
  presetActionButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetCancelButton: {
    backgroundColor: colors2024['neutral-bg-2'],
  },
  presetConfirmButton: {
    backgroundColor: colors2024['brand-default'],
  },
  stopButton: {
    backgroundColor: colors2024['red-default'],
  },
  presetActionText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
  },
  presetCancelText: {
    color: colors2024['neutral-title-1'],
  },
  presetConfirmText: {
    color: colors2024['neutral-InvertHighlight'],
  },
}));
