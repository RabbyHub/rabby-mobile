import { PERPS_PRO_NUMBER_STYLE } from '../common/perpsProNumberText';
import { Text, TextInput } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import React from 'react';
import { View } from 'react-native';

import {
  sanitizePerpsProPriceEditingInput,
  sanitizePerpsProPriceInput,
} from '../../model/trade';
import {
  PERPS_PRO_DIALOG_FIELD,
  PERPS_PRO_DIALOG_LABELED_FIELD,
  resolvePerpsProDialogFieldBackground,
} from '../common/perpsProDialogVisual';
import { PerpsProDecimalTextInput } from '../trade/PerpsProDecimalTextInput';
import { PERPS_PRO_ANDROID_SINGLE_LINE_INPUT_STYLE } from '../common/perpsProSingleLineInput';

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
  /** 46pt labeled field (Figma 86609:347557); defaults to the 56pt field. */
  compact?: boolean;
  currentValue?: string | null;
  disabled?: boolean;
  label?: string;
  maxDecimals: number;
  onChangeText: (value: string) => void;
  onFocus?: () => void;
  priceSzDecimals?: number;
  testID?: string;
  unit?: string;
  value: string;
}> = React.memo(
  ({
    accessibilityLabel,
    compact = false,
    currentValue,
    disabled = false,
    label,
    maxDecimals,
    onChangeText,
    onFocus,
    priceSzDecimals,
    testID,
    unit,
    value,
  }) => {
    const { styles } = useTheme2024({ getStyle });
    const normalizePriceValue = React.useCallback(
      (nextValue: string) =>
        sanitizePerpsProPriceEditingInput(nextValue, priceSzDecimals ?? 0),
      [priceSzDecimals],
    );
    const canonicalizePriceValue = React.useCallback(
      (nextValue: string) =>
        sanitizePerpsProPriceInput(nextValue, priceSzDecimals ?? 0),
      [priceSzDecimals],
    );
    if (disabled) {
      return (
        <View style={[styles.compactField, styles.disabled]} testID={testID}>
          <Text style={styles.disabledText}>{value}</Text>
        </View>
      );
    }
    return (
      <View
        style={compact ? styles.compactField : styles.field}
        testID={testID}>
        {label ? (
          <Text
            numberOfLines={1}
            style={[styles.label, compact && styles.compactLabel]}>
            <Text style={styles.labelTitle}>{label} </Text>
            {currentValue ? `(${currentValue})` : null}
          </Text>
        ) : null}
        <PerpsProDecimalTextInput
          accessibilityLabel={accessibilityLabel}
          inputComponent={OpenOrderBottomSheetTextInput}
          maxDecimals={maxDecimals}
          normalizeValue={
            priceSzDecimals == null ? undefined : normalizePriceValue
          }
          onChangeText={onChangeText}
          onFocus={onFocus}
          canonicalizeValueOnBlur={
            priceSzDecimals == null ? undefined : canonicalizePriceValue
          }
          preserveIntegerZeroRun={priceSzDecimals != null}
          style={[
            styles.input,
            compact && styles.compactInput,
            unit ? styles.inputWithUnit : null,
          ]}
          value={value}
        />
        {unit ? (
          <Text
            pointerEvents="none"
            style={compact ? styles.compactUnit : styles.unit}>
            {unit}
          </Text>
        ) : null}
      </View>
    );
  },
);

PerpsProOpenOrderEditInput.displayName = 'PerpsProOpenOrderEditInput';

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  field: {
    backgroundColor: resolvePerpsProDialogFieldBackground(colors2024, isLight),
    borderRadius: 6,
    height: PERPS_PRO_DIALOG_LABELED_FIELD.height,
    justifyContent: 'center',
    paddingHorizontal: 12,
    position: 'relative',
  },
  compactField: {
    backgroundColor: resolvePerpsProDialogFieldBackground(colors2024, isLight),
    borderRadius: 6,
    height: PERPS_PRO_DIALOG_FIELD.height,
    justifyContent: 'center',
    paddingHorizontal: 12,
    position: 'relative',
  },
  disabled: { alignItems: 'center' },
  label: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 10,
    lineHeight: 12,
    position: 'absolute',
    top: PERPS_PRO_DIALOG_LABELED_FIELD.labelTop,
    left: 12,
    right: 12,
  },
  compactLabel: { top: PERPS_PRO_DIALOG_FIELD.labelTop },
  labelTitle: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '500',
  },
  input: {
    ...PERPS_PRO_NUMBER_STYLE,
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    height: PERPS_PRO_DIALOG_LABELED_FIELD.height,
    lineHeight: 18,
    padding: 0,
    ...PERPS_PRO_DIALOG_LABELED_FIELD.inputPadding,
    ...PERPS_PRO_ANDROID_SINGLE_LINE_INPUT_STYLE,
  },
  compactInput: {
    height: PERPS_PRO_DIALOG_FIELD.height,
    ...PERPS_PRO_DIALOG_FIELD.inputPadding,
  },
  inputWithUnit: { paddingRight: 72 },
  // Figma 86609:343156: field units are 16pt Bold.
  unit: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
    position: 'absolute',
    right: 12,
  },
  // Figma 86609:347561: the compact field keeps the 14pt Medium unit.
  compactUnit: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
    position: 'absolute',
    right: 12,
  },
  disabledText: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
}));
