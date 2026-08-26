import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';

import { resolvePerpsProFieldBackground } from '../common/perpsProVisual';
import { PerpsProSelectCaret } from '../common/PerpsProSelectCaret';
import { PerpsProDecimalTextInput } from '../trade/PerpsProDecimalTextInput';
import { PerpsProPositionTpSlBottomSheetTextInput } from './PerpsProPositionTpSlBottomSheetTextInput';

const withThousandsSeparators = (value: string) => {
  const [integer = '', fraction] = value.split('.');
  const formattedInteger = integer.replace(/\B(?=(\d{3})+(?!\d))/gu, ',');
  return fraction === undefined
    ? formattedInteger
    : `${formattedInteger}.${fraction}`;
};

export const PerpsProPositionTpSlInput: React.FC<{
  accessibilityLabel: string;
  disabled: boolean;
  invalid?: boolean;
  label: string;
  maxDecimals: number;
  negative?: boolean;
  onChangeText: (value: string) => void;
  onPressMode?: () => void;
  testID: string;
  unit?: string;
  value: string;
}> = React.memo(
  ({
    accessibilityLabel,
    disabled,
    invalid = false,
    label,
    maxDecimals,
    negative = false,
    onChangeText,
    onPressMode,
    testID,
    unit,
    value,
  }) => {
    const { colors2024, styles } = useTheme2024({ getStyle });
    const [focused, setFocused] = useState(false);
    const showFloatingLabel = focused || !!value;
    const showNegativePrefix = negative && !!value;
    const displayValue = `${
      showNegativePrefix ? '−' : ''
    }${withThousandsSeparators(value)}`;

    return (
      <View
        style={[styles.field, invalid ? styles.invalidField : null]}
        testID={`${testID}-field`}>
        <View style={styles.inputArea}>
          {showFloatingLabel ? (
            <Text
              pointerEvents="none"
              style={styles.floatingLabel}
              testID={`${testID}-label`}>
              {label}
            </Text>
          ) : (
            <Text
              pointerEvents="none"
              style={styles.centeredPlaceholder}
              testID={`${testID}-placeholder`}>
              {label}
            </Text>
          )}
          {!focused && value ? (
            <Text
              numberOfLines={1}
              pointerEvents="none"
              style={styles.formattedValue}
              testID={`${testID}-formatted-value`}>
              {displayValue}
            </Text>
          ) : null}
          {focused && showNegativePrefix ? (
            <Text
              pointerEvents="none"
              style={styles.negativePrefix}
              testID={`${testID}-negative-prefix`}>
              −
            </Text>
          ) : null}
          <PerpsProDecimalTextInput
            accessibilityLabel={accessibilityLabel}
            cursorColor={colors2024['brand-default']}
            editable={!disabled}
            focusCursorAtEnd
            inputComponent={PerpsProPositionTpSlBottomSheetTextInput}
            maxFontSizeMultiplier={1.2}
            maxDecimals={maxDecimals}
            onBlur={() => setFocused(false)}
            onChangeText={onChangeText}
            onFocus={() => setFocused(true)}
            selectionColor={colors2024['brand-default']}
            style={[
              styles.input,
              !focused && value ? styles.hiddenInput : null,
              focused && showNegativePrefix ? styles.inputWithNegative : null,
            ]}
            testID={testID}
            value={value}
          />
        </View>
        {unit && onPressMode ? (
          <Pressable
            accessibilityLabel={`${accessibilityLabel} mode`}
            accessibilityRole="button"
            disabled={disabled}
            hitSlop={8}
            onPress={onPressMode}
            style={styles.mode}
            testID={`${testID}-mode`}>
            <Text numberOfLines={1} style={styles.unit}>
              {unit}
            </Text>
            <PerpsProSelectCaret
              color={colors2024['neutral-secondary']}
              testID={`${testID}-caret`}
            />
          </Pressable>
        ) : null}
      </View>
    );
  },
);

PerpsProPositionTpSlInput.displayName = 'PerpsProPositionTpSlInput';

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  field: {
    alignItems: 'center',
    backgroundColor: resolvePerpsProFieldBackground({
      darkBackground: colors2024['neutral-bg-2'],
      isLight,
    }),
    borderRadius: 6,
    borderColor: 'transparent',
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 4,
    height: 40,
    minWidth: 0,
    paddingHorizontal: 8,
  },
  invalidField: { borderColor: colors2024['red-default'] },
  inputArea: {
    flex: 1,
    height: 40,
    minWidth: 0,
    position: 'relative',
  },
  floatingLabel: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro',
    fontSize: 10,
    fontWeight: '500',
    left: 0,
    lineHeight: 12,
    position: 'absolute',
    right: 0,
    top: 4,
  },
  centeredPlaceholder: {
    color: colors2024['neutral-info'],
    fontFamily: 'SF Pro',
    fontSize: 14,
    fontWeight: '500',
    left: 0,
    lineHeight: 18,
    position: 'absolute',
    right: 0,
    top: 11,
  },
  formattedValue: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro',
    fontSize: 14,
    fontWeight: '500',
    left: 0,
    lineHeight: 18,
    position: 'absolute',
    right: 0,
    top: 18,
  },
  input: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro',
    fontSize: 14,
    fontWeight: '500',
    height: 40,
    includeFontPadding: false,
    lineHeight: 18,
    paddingBottom: 0,
    paddingHorizontal: 0,
    paddingTop: 12,
    textAlignVertical: 'center',
  },
  hiddenInput: { color: 'transparent' },
  inputWithNegative: { paddingLeft: 9 },
  negativePrefix: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro',
    fontSize: 14,
    fontWeight: '500',
    left: 0,
    lineHeight: 18,
    position: 'absolute',
    top: 18,
  },
  mode: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    height: 40,
    justifyContent: 'flex-end',
  },
  unit: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
}));
