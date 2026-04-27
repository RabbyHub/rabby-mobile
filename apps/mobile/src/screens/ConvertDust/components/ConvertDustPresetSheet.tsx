import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetView } from '@gorhom/bottom-sheet';

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
  options: readonly string[];
  onCancel: () => void;
  onConfirm: (value: string) => void;
}) {
  const modalRef = React.useRef<AppBottomSheetModal>(null);
  const { styles } = useTheme2024({ getStyle });
  const { safeOffBottom } = useSafeSizes();
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
      snapPoints={[258 + safeOffBottom]}
      onDismiss={onCancel}
      backgroundStyle={styles.sheetBackground}
      handleStyle={styles.sheetHandle}
      handleIndicatorStyle={styles.sheetHandleIndicator}>
      <BottomSheetView
        style={[styles.presetSheet, { paddingBottom: safeOffBottom + 21 }]}>
        <Text style={styles.presetSheetTitle}>{title}</Text>
        <View style={styles.presetOptions}>
          {options.map(option => {
            const selected = draftValue === option;
            return (
              <Pressable
                key={option}
                onPress={() => setDraftValue(option)}
                style={[
                  styles.presetOption,
                  selected && styles.presetOptionActive,
                ]}>
                <Text
                  style={[
                    styles.presetOptionText,
                    selected && styles.presetOptionTextActive,
                  ]}>
                  {option}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.presetActions}>
          <Pressable
            style={[styles.presetActionButton, styles.presetCancelButton]}
            onPress={onCancel}>
            <Text style={[styles.presetActionText, styles.presetCancelText]}>
              Cancel
            </Text>
          </Pressable>
          <Pressable
            style={[styles.presetActionButton, styles.presetConfirmButton]}
            onPress={() => onConfirm(draftValue)}>
            <Text style={[styles.presetActionText, styles.presetConfirmText]}>
              Confirm
            </Text>
          </Pressable>
        </View>
      </BottomSheetView>
    </AppBottomSheetModal>
  );
}

export const getStyle = createGetStyles2024(({ colors2024 }) => ({
  sheetBackground: {
    backgroundColor: colors2024['neutral-bg-1'],
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
    paddingTop: 8,
    paddingHorizontal: 19.5,
  },
  presetSheetTitle: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    fontWeight: '700',
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
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors2024['neutral-bg-2'],
  },
  presetOptionActive: {
    backgroundColor: colors2024['brand-light-1'],
  },
  presetOptionText: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '700',
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
