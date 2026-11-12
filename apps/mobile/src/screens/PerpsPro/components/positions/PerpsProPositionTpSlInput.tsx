import { PERPS_PRO_NUMBER_STYLE } from '../common/perpsProNumberText';
import { Text, TextInput } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { IS_ANDROID, IS_IOS } from '@/core/native/utils';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useLayoutEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import {
  sanitizePerpsProPriceEditingInput,
  sanitizePerpsProPriceInput,
} from '../../model/trade';
import {
  PERPS_PRO_DIALOG_FIELD,
  resolvePerpsProDialogFieldBackground,
} from '../common/perpsProDialogVisual';
import { resolvePerpsProFittedFontSize } from '../common/perpsProFitFontSize';
import { PerpsProTextWidthProbe } from '../common/PerpsProTextWidthProbe';
import RcSelectCaret from '@/assets2024/icons/perps/PerpsProTpSlSelectCaret.svg';
import { PerpsProDecimalTextInput } from '../trade/PerpsProDecimalTextInput';
import { PerpsProPositionTpSlBottomSheetTextInput } from './PerpsProPositionTpSlBottomSheetTextInput';

const FLOATING_LABEL_FONT_SIZE = 10;
const FLOATING_LABEL_MIN_FONT_SIZE = 8;
const PLACEHOLDER_FONT_SIZE = 14;
const PLACEHOLDER_MIN_FONT_SIZE = 10;

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
  placeholder?: string;
  maxDecimals: number;
  negative?: boolean;
  onChangeText: (value: string) => void;
  onPressMode?: () => void;
  priceSzDecimals?: number;
  registerKeyboardRevealInput?: (input: TextInput) => (() => void) | undefined;
  testID: string;
  unit?: string;
  value: string;
}> = React.memo(
  ({
    accessibilityLabel,
    disabled,
    invalid = false,
    label,
    placeholder = label,
    maxDecimals,
    negative = false,
    onChangeText,
    onPressMode,
    priceSzDecimals,
    registerKeyboardRevealInput,
    testID,
    unit,
    value,
  }) => {
    const { colors2024, styles } = useTheme2024({ getStyle });
    const inputRef = React.useRef<TextInput>(null);
    useLayoutEffect(() => {
      if (IS_ANDROID && inputRef.current) {
        return registerKeyboardRevealInput?.(inputRef.current);
      }
    }, [registerKeyboardRevealInput]);
    const [focused, setFocused] = useState(false);
    // Long translations must shrink on one line instead of wrapping onto the
    // value row.
    const [inputAreaWidth, setInputAreaWidth] = useState(0);
    const [labelWidth, setLabelWidth] = useState(0);
    const [placeholderWidth, setPlaceholderWidth] = useState(0);
    const labelFontSize = resolvePerpsProFittedFontSize({
      availableWidth: inputAreaWidth,
      baseFontSize: FLOATING_LABEL_FONT_SIZE,
      minFontSize: FLOATING_LABEL_MIN_FONT_SIZE,
      naturalWidth: labelWidth,
    });
    const placeholderFontSize = resolvePerpsProFittedFontSize({
      availableWidth: inputAreaWidth,
      baseFontSize: PLACEHOLDER_FONT_SIZE,
      minFontSize: PLACEHOLDER_MIN_FONT_SIZE,
      naturalWidth: placeholderWidth,
    });
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
    const showFloatingLabel = focused || !!value;
    const showNegativePrefix = negative && !!value;
    const displayValue = `${
      showNegativePrefix ? '−' : ''
    }${withThousandsSeparators(value)}`;

    return (
      <View
        style={[
          styles.field,
          onPressMode ? styles.modeField : null,
          invalid ? styles.invalidField : null,
        ]}
        testID={`${testID}-field`}>
        <Pressable
          accessible={false}
          disabled={disabled || (IS_IOS && focused)}
          onLayout={event => setInputAreaWidth(event.nativeEvent.layout.width)}
          onPress={() => {
            if (!focused) {
              inputRef.current?.focus();
            }
          }}
          style={styles.inputArea}
          testID={`${testID}-focus-proxy`}>
          <PerpsProTextWidthProbe
            onWidth={setLabelWidth}
            style={styles.floatingLabel}
            text={label}
          />
          <PerpsProTextWidthProbe
            onWidth={setPlaceholderWidth}
            style={styles.centeredPlaceholder}
            text={placeholder}
          />
          {showFloatingLabel ? (
            <Text
              numberOfLines={1}
              pointerEvents="none"
              style={[
                styles.floatingLabel,
                labelFontSize !== FLOATING_LABEL_FONT_SIZE && {
                  fontSize: labelFontSize,
                },
              ]}
              testID={`${testID}-label`}>
              {label}
            </Text>
          ) : (
            <Text
              numberOfLines={1}
              pointerEvents="none"
              style={[
                styles.centeredPlaceholder,
                placeholderFontSize !== PLACEHOLDER_FONT_SIZE && {
                  fontSize: placeholderFontSize,
                },
              ]}
              testID={`${testID}-placeholder`}>
              {placeholder}
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
            editable={!disabled}
            caretHidden={IS_ANDROID ? !focused : undefined}
            focusCursorAtEnd
            focusCursorAtEndMode="nativeFocus"
            inputComponent={PerpsProPositionTpSlBottomSheetTextInput}
            maxFontSizeMultiplier={1.2}
            maxDecimals={maxDecimals}
            normalizeValue={
              priceSzDecimals == null ? undefined : normalizePriceValue
            }
            onBlur={() => setFocused(false)}
            onChangeText={onChangeText}
            onFocus={() => setFocused(true)}
            canonicalizeValueOnBlur={
              priceSzDecimals == null ? undefined : canonicalizePriceValue
            }
            preserveIntegerZeroRun={priceSzDecimals != null}
            pointerEvents={focused ? 'auto' : 'none'}
            ref={inputRef}
            style={[
              styles.input,
              !focused && value ? styles.hiddenInput : null,
              focused && showNegativePrefix ? styles.inputWithNegative : null,
            ]}
            testID={testID}
            value={value}
          />
        </Pressable>
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
            <RcSelectCaret
              width={16}
              height={16}
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
    backgroundColor: resolvePerpsProDialogFieldBackground(colors2024, isLight),
    borderRadius: 6,
    borderColor: 'transparent',
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 4,
    height: PERPS_PRO_DIALOG_FIELD.height,
    minWidth: 0,
    // Include the 1px validation border in the Figma 12px inset.
    paddingHorizontal: 11,
  },
  modeField: { paddingRight: 7 },
  invalidField: { borderColor: colors2024['red-default'] },
  inputArea: {
    flex: 1,
    height: PERPS_PRO_DIALOG_FIELD.height,
    minWidth: 0,
    position: 'relative',
  },
  floatingLabel: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: FLOATING_LABEL_FONT_SIZE,
    fontWeight: '500',
    left: 0,
    lineHeight: 12,
    position: 'absolute',
    right: 0,
    top: PERPS_PRO_DIALOG_FIELD.labelTop,
  },
  centeredPlaceholder: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: PLACEHOLDER_FONT_SIZE,
    fontWeight: '400',
    left: 0,
    lineHeight: 18,
    position: 'absolute',
    right: 0,
    // A lone 18pt line centered in the 46pt field (Figma 86609:305215).
    top: (PERPS_PRO_DIALOG_FIELD.height - 18) / 2,
  },
  formattedValue: {
    ...PERPS_PRO_NUMBER_STYLE,
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    left: 0,
    lineHeight: 18,
    position: 'absolute',
    right: 0,
    top: PERPS_PRO_DIALOG_FIELD.valueTop,
  },
  input: {
    ...PERPS_PRO_NUMBER_STYLE,
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    height: PERPS_PRO_DIALOG_FIELD.height,
    includeFontPadding: false,
    lineHeight: 18,
    paddingHorizontal: 0,
    ...PERPS_PRO_DIALOG_FIELD.inputPadding,
    textAlignVertical: 'center',
  },
  // Android Fabric treats transparent black (ARGB 0) as an unset text color.
  // Keep alpha zero with nonzero RGB, preserving the native view's opacity.
  hiddenInput: { color: IS_ANDROID ? 'rgba(255,255,255,0)' : 'transparent' },
  inputWithNegative: { paddingLeft: 9 },
  negativePrefix: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    left: 0,
    lineHeight: 18,
    position: 'absolute',
    top: PERPS_PRO_DIALOG_FIELD.valueTop,
  },
  mode: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    height: PERPS_PRO_DIALOG_FIELD.height,
    justifyContent: 'flex-end',
  },
  unit: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
}));
