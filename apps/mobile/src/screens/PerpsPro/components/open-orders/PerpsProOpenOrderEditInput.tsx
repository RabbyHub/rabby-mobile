import { Text, TextInput } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import React from 'react';
import { View } from 'react-native';

import { PerpsProDecimalTextInput } from '../trade/PerpsProDecimalTextInput';

const OpenOrderBottomSheetTextInput = React.forwardRef<
  TextInput,
  React.ComponentProps<typeof TextInput>
>((props, forwardedRef) => (
  <BottomSheetTextInput
    {...props}
    ref={
      forwardedRef as React.Ref<React.ElementRef<typeof BottomSheetTextInput>>
    }
  />
));

OpenOrderBottomSheetTextInput.displayName = 'OpenOrderBottomSheetTextInput';

export const PerpsProOpenOrderEditInput: React.FC<{
  accessibilityLabel: string;
  currentValue?: string | null;
  disabled?: boolean;
  label?: string;
  maxDecimals: number;
  onChangeText: (value: string) => void;
  onFocus?: () => void;
  testID?: string;
  unit?: string;
  value: string;
}> = React.memo(
  ({
    accessibilityLabel,
    currentValue,
    disabled = false,
    label,
    maxDecimals,
    onChangeText,
    onFocus,
    testID,
    unit,
    value,
  }) => {
    const { colors2024, styles } = useTheme2024({ getStyle });
    if (disabled) {
      return (
        <View style={[styles.field, styles.disabled]} testID={testID}>
          <Text style={styles.disabledText}>{value}</Text>
        </View>
      );
    }
    return (
      <View style={styles.field} testID={testID}>
        {label ? (
          <Text numberOfLines={1} style={styles.label}>
            <Text style={styles.labelTitle}>{label} </Text>
            {currentValue ? `(${currentValue})` : ''}
          </Text>
        ) : null}
        <PerpsProDecimalTextInput
          accessibilityLabel={accessibilityLabel}
          cursorColor={colors2024['brand-default']}
          inputComponent={OpenOrderBottomSheetTextInput}
          maxDecimals={maxDecimals}
          onChangeText={onChangeText}
          onFocus={onFocus}
          selectionColor={colors2024['brand-default']}
          style={[styles.input, unit ? styles.inputWithUnit : null]}
          value={value}
        />
        {unit ? (
          <Text pointerEvents="none" style={styles.unit}>
            {unit}
          </Text>
        ) : null}
      </View>
    );
  },
);

PerpsProOpenOrderEditInput.displayName = 'PerpsProOpenOrderEditInput';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  field: {
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 6,
    height: 40,
    justifyContent: 'center',
    paddingHorizontal: 8,
    position: 'relative',
  },
  disabled: { opacity: 0.5 },
  label: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro',
    fontSize: 10,
    lineHeight: 12,
    position: 'absolute',
    top: 5,
    left: 8,
    right: 8,
  },
  labelTitle: { fontWeight: '500' },
  input: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro',
    fontSize: 14,
    fontWeight: '500',
    height: 40,
    lineHeight: 18,
    padding: 0,
    paddingTop: 13,
  },
  inputWithUnit: { paddingRight: 72 },
  unit: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
    position: 'absolute',
    right: 8,
  },
  disabledText: {
    color: colors2024['neutral-info'],
    fontFamily: 'SF Pro',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
}));
