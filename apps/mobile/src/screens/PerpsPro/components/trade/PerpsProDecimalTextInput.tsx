import { TextInput } from '@/components/Typography';
import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type {
  NativeSyntheticEvent,
  TextInputProps,
  TextInputSelectionChangeEventData,
} from 'react-native';

import { sanitizePerpsProDecimalInput } from '../../model/trade';

const UNRESTRICTED_TEXT_INPUT_MAX_LENGTH = 2147483647;
const EMPTY_INPUT_SELECTION = { end: 0, start: 0 } as const;

type PerpsProDecimalTextInputProps = Omit<
  TextInputProps,
  | 'inputMode'
  | 'keyboardType'
  | 'maxLength'
  | 'multiline'
  | 'numberOfLines'
  | 'onChangeText'
  | 'onSelectionChange'
  | 'selection'
  | 'value'
> & {
  maxDecimals: number;
  onChangeText: (value: string) => void;
  value: string;
};

export const PerpsProDecimalTextInput: React.FC<PerpsProDecimalTextInputProps> =
  React.memo(({ maxDecimals, onChangeText, value, ...inputProps }) => {
    const inputRef = useRef<TextInput>(null);
    const selectionRef = useRef({ start: value.length, end: value.length });
    const [inputValue, setInputValue] = useState(value);
    const [selection, setSelection] = useState(selectionRef.current);

    useLayoutEffect(() => {
      setInputValue(current => (current === value ? current : value));
    }, [value]);

    const handleSelectionChange = useCallback(
      (event: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
        const nextSelection = event.nativeEvent.selection;
        selectionRef.current = nextSelection;
        setSelection(current =>
          current.start === nextSelection.start &&
          current.end === nextSelection.end
            ? current
            : nextSelection,
        );
      },
      [],
    );

    const handleChangeText = useCallback(
      (nextValue: string) => {
        const normalizedValue = sanitizePerpsProDecimalInput(
          nextValue,
          maxDecimals,
        );

        if (normalizedValue !== nextValue) {
          inputRef.current?.setNativeProps?.({ text: normalizedValue });
        }
        if (normalizedValue === inputValue) return;

        setInputValue(normalizedValue);
        onChangeText(normalizedValue);
      },
      [inputValue, maxDecimals, onChangeText],
    );

    const normalizedSelectionStart = Math.max(
      0,
      Math.min(selection.start, inputValue.length),
    );
    const normalizedSelectionEnd = Math.max(
      normalizedSelectionStart,
      Math.min(selection.end, inputValue.length),
    );
    const decimalSeparatorIndex = inputValue.indexOf('.');
    const decimalPlacesCount =
      decimalSeparatorIndex >= 0
        ? inputValue.length - decimalSeparatorIndex - 1
        : 0;
    const shouldLockInputLength =
      decimalSeparatorIndex >= 0 &&
      normalizedSelectionStart === normalizedSelectionEnd &&
      normalizedSelectionStart > decimalSeparatorIndex &&
      decimalPlacesCount >= Math.max(0, maxDecimals);

    return (
      <TextInput
        {...inputProps}
        ref={inputRef}
        inputMode="decimal"
        keyboardType="decimal-pad"
        maxLength={
          shouldLockInputLength
            ? inputValue.length
            : UNRESTRICTED_TEXT_INPUT_MAX_LENGTH
        }
        multiline={false}
        numberOfLines={1}
        onChangeText={handleChangeText}
        onSelectionChange={handleSelectionChange}
        scrollEnabled
        selection={inputValue.length === 0 ? EMPTY_INPUT_SELECTION : undefined}
        value={inputValue}
      />
    );
  });

PerpsProDecimalTextInput.displayName = 'PerpsProDecimalTextInput';
