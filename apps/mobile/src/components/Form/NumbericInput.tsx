import React, { useState, useCallback, useEffect } from 'react';
import { StyleSheet, TextInput, TextInputProps, TextStyle } from 'react-native';

import { BottomSheetTextInput } from '@gorhom/bottom-sheet';

import {
  ALLOWED_NUMBIC_INPUT,
  coerceFloat,
  formatSpeicalAmount,
} from '@/utils/number';
import { createGetStyles } from '@/utils/styles';
import { useThemeStyles } from '@/hooks/theme';

type BottomSheetTextInputProps = React.ComponentProps<
  typeof BottomSheetTextInput
>;

type NumericInputProps = Omit<TextInputProps, 'onChangeText'> & {
  value?: string | number;
  onChangeText?: (value: string) => void;
  min?: number;
  max?: number;
};

function correctInputToNumber<T extends number | string>(
  numericValue: T,
  options?: { min?: number; max?: number },
) {
  const { min, max } = options || {};

  const formattedValue = formatSpeicalAmount(numericValue);

  if (min !== undefined && coerceFloat(formattedValue) < min) {
    return min;
  }

  if (max !== undefined && coerceFloat(formattedValue) > max) {
    return max;
  }

  // keep original input tough formattedValue not equal to numericValue
  return numericValue;
}

const getInputStyles = createGetStyles(colors => {
  return {
    input: {
      color: colors['neutral-title1'],
    } as TextStyle,
  };
});

export const NumericInput = React.forwardRef<TextInput, NumericInputProps>(
  (
    { style, value = '', onChangeText, min, max, ...props }: NumericInputProps,
    ref,
  ) => {
    const { styles } = useThemeStyles(getInputStyles);
    const [internalValue, setInternalValue] = useState(
      correctInputToNumber(value, { min, max }).toString(),
    );

    const handleChange = useCallback(
      (newValue: string) => {
        if (ALLOWED_NUMBIC_INPUT.test(newValue)) {
          newValue = correctInputToNumber(newValue, { min, max }).toString();
          setInternalValue(newValue);
          onChangeText?.(newValue);
        }
      },
      [min, max, onChangeText],
    );

    useEffect(() => {
      setInternalValue(correctInputToNumber(value, { min, max }).toString());
    }, [value, min, max]);

    return (
      <TextInput
        keyboardType="number-pad"
        {...props}
        ref={ref}
        style={StyleSheet.flatten([styles.input, style])}
        value={internalValue}
        onChangeText={handleChange}
      />
    );
  },
);

export const BottomSheetModalNumericInput = React.forwardRef<
  TextInput,
  NumericInputProps & Omit<BottomSheetTextInputProps, 'onChangeText'>
>(
  (
    {
      style,
      value,
      onChangeText,
      min = Number.NEGATIVE_INFINITY,
      max = Number.POSITIVE_INFINITY,
      ...props
    },
    ref,
  ) => {
    const [internalValue, setInternalValue] = useState(
      correctInputToNumber(value || '', { min, max }).toString(),
    );

    const handleChange = useCallback(
      (newValue: string) => {
        if (/^\d*(\.\d*)?$/.test(newValue)) {
          newValue = correctInputToNumber(newValue, { min, max }).toString();
          setInternalValue(newValue);
          onChangeText?.(newValue);
        }
      },
      [min, max, onChangeText],
    );

    useEffect(() => {
      setInternalValue(
        correctInputToNumber(value || '', { min, max }).toString(),
      );
    }, [value, min, max]);

    return (
      <BottomSheetTextInput
        {...props}
        ref={ref as any}
        keyboardType="number-pad"
        style={style}
        value={internalValue}
        onChangeText={handleChange}
      />
    );
  },
);
