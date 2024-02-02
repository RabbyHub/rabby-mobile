import React, { useState, useCallback, useEffect } from 'react';
import { TextInput, TextInputProps } from 'react-native';

import { BottomSheetTextInput } from '@gorhom/bottom-sheet';

import { coerceFloat } from '@/utils/number';

type BottomSheetTextInputProps = React.ComponentProps<
  typeof BottomSheetTextInput
>;

type NumericInputProps = RNViewProps &
  Omit<TextInputProps, 'onChangeText'> & {
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

  if (min !== undefined && coerceFloat(numericValue) < min) {
    return min;
  }

  if (max !== undefined && coerceFloat(numericValue) > max) {
    return max;
  }

  return numericValue;
}

export const NumericInput = React.forwardRef<TextInput, NumericInputProps>(
  (
    {
      style,
      value = '',
      onChangeText,
      min,
      max,
      ...props
    }: RNViewProps & NumericInputProps,
    ref,
  ) => {
    const [internalValue, setInternalValue] = useState(
      correctInputToNumber(value, { min, max }).toString(),
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
      setInternalValue(correctInputToNumber(value, { min, max }).toString());
    }, [value, min, max]);

    return (
      <TextInput
        {...props}
        ref={ref}
        keyboardType="numeric"
        style={style}
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
        keyboardType="numeric"
        style={style}
        value={internalValue}
        onChangeText={handleChange}
      />
    );
  },
);
