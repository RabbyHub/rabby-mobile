import { AppBottomSheetModal } from '@/components';
import { Text } from '@/components/Typography';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import React, { useEffect, useRef } from 'react';
import { Pressable, View } from 'react-native';

export interface PerpsProTradeOption<T extends string> {
  description?: string;
  disabled?: boolean;
  label: string;
  value: T;
}

export const PerpsProTradeOptionSheet = <T extends string>({
  onClose,
  onSelect,
  options,
  selected,
  title,
  visible,
}: {
  onClose: () => void;
  onSelect: (value: T) => void;
  options: PerpsProTradeOption<T>[];
  selected: T;
  title: string;
  visible: boolean;
}) => {
  const modalRef = useRef<AppBottomSheetModal>(null);
  const { colors2024, isLight, styles } = useTheme2024({ getStyle });

  useEffect(() => {
    if (visible) modalRef.current?.present();
    else modalRef.current?.close();
  }, [visible]);

  return (
    <AppBottomSheetModal
      enableDynamicSizing
      onDismiss={onClose}
      ref={modalRef}
      {...makeBottomSheetProps({
        colors: colors2024,
        linearGradientType: isLight ? 'bg0' : 'bg1',
      })}>
      <BottomSheetView style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        {options.map(option => {
          const active = option.value === selected;
          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{
                checked: active,
                disabled: option.disabled,
              }}
              disabled={option.disabled}
              key={option.value}
              onPress={() => {
                onSelect(option.value);
                onClose();
              }}
              style={[styles.option, option.disabled ? styles.disabled : null]}>
              <View style={styles.copy}>
                <Text style={styles.label}>{option.label}</Text>
                {option.description ? (
                  <Text style={styles.description}>{option.description}</Text>
                ) : null}
              </View>
              {active ? <Text style={styles.check}>✓</Text> : null}
            </Pressable>
          );
        })}
      </BottomSheetView>
    </AppBottomSheetModal>
  );
};

const getStyle = createGetStyles2024(({ colors2024, safeAreaInsets }) => ({
  content: {
    paddingBottom: Math.max(20, safeAreaInsets.bottom),
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  title: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
    marginBottom: 8,
  },
  option: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 56,
  },
  disabled: {
    opacity: 0.45,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  label: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20,
  },
  description: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro',
    fontSize: 12,
    lineHeight: 16,
  },
  check: {
    color: colors2024['neutral-title-1'],
    fontSize: 18,
    fontWeight: '700',
  },
}));
