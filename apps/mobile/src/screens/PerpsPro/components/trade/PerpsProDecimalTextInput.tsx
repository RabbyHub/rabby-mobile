import { TextInput } from '@/components/Typography';
import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type {
  NativeSyntheticEvent,
  TextInputProps,
  TextInputSelectionChangeEventData,
} from 'react-native';

import { sanitizePerpsProDecimalInput } from '../../model/trade';
import { resolvePerpsProEmptyInputSelection } from '../common/perpsProInputSelection';

const UNRESTRICTED_TEXT_INPUT_MAX_LENGTH = 2147483647;

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
  emptySelection?: NonNullable<TextInputProps['selection']>;
  focusCursorAtEnd?: boolean;
  inputComponent?: React.ForwardRefExoticComponent<
    TextInputProps & React.RefAttributes<TextInput>
  >;
  inputMode?: TextInputProps['inputMode'];
  keyboardType?: TextInputProps['keyboardType'];
  maxDecimals: number;
  normalizeValue?: (value: string) => string;
  onChangeText: (value: string) => void;
  value: string;
};

export const PerpsProDecimalTextInput = React.memo(
  React.forwardRef<TextInput, PerpsProDecimalTextInputProps>(
    (
      {
        emptySelection,
        focusCursorAtEnd = false,
        inputComponent: InputComponent = TextInput,
        inputMode = 'decimal',
        keyboardType = 'decimal-pad',
        maxDecimals,
        normalizeValue,
        onBlur,
        onChangeText,
        onFocus,
        value,
        ...inputProps
      },
      forwardedRef,
    ) => {
      const inputRef = useRef<TextInput>(null);
      React.useImperativeHandle(forwardedRef, () => inputRef.current!);
      const selectionRef = useRef({ start: value.length, end: value.length });
      const shouldForceCursorAtEndRef = useRef(false);
      const [inputValue, setInputValue] = useState(value);
      const [selection, setSelection] = useState(selectionRef.current);
      const [shouldForceCursorAtEnd, setShouldForceCursorAtEnd] =
        useState(false);

      const releaseForcedCursor = useCallback(() => {
        if (!shouldForceCursorAtEndRef.current) {
          return;
        }
        shouldForceCursorAtEndRef.current = false;
        setShouldForceCursorAtEnd(false);
      }, []);

      useLayoutEffect(() => {
        if (value.length === 0) {
          releaseForcedCursor();
        }
        setInputValue(current => (current === value ? current : value));
      }, [releaseForcedCursor, value]);

      const handleSelectionChange = useCallback(
        (event: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
          const inputEnd = inputValue.length;
          const shouldKeepCursorAtEnd =
            shouldForceCursorAtEndRef.current && inputEnd > 0;
          const nextSelection = shouldKeepCursorAtEnd
            ? { end: inputEnd, start: inputEnd }
            : event.nativeEvent.selection;

          if (
            shouldKeepCursorAtEnd &&
            (event.nativeEvent.selection.start !== inputEnd ||
              event.nativeEvent.selection.end !== inputEnd)
          ) {
            inputRef.current?.setNativeProps?.({ selection: nextSelection });
          }

          selectionRef.current = nextSelection;
          setSelection(current =>
            current.start === nextSelection.start &&
            current.end === nextSelection.end
              ? current
              : nextSelection,
          );
        },
        [inputValue.length],
      );

      const handleChangeText = useCallback(
        (nextValue: string) => {
          releaseForcedCursor();
          const sanitizedValue = sanitizePerpsProDecimalInput(
            nextValue,
            maxDecimals,
          );
          const normalizedValue = normalizeValue
            ? normalizeValue(sanitizedValue)
            : sanitizedValue;

          if (normalizedValue !== nextValue) {
            inputRef.current?.setNativeProps?.({ text: normalizedValue });
          }
          if (normalizedValue === inputValue) {
            return;
          }

          setInputValue(normalizedValue);
          onChangeText(normalizedValue);
        },
        [
          inputValue,
          maxDecimals,
          normalizeValue,
          onChangeText,
          releaseForcedCursor,
        ],
      );

      const handleFocus = useCallback<NonNullable<TextInputProps['onFocus']>>(
        event => {
          if (focusCursorAtEnd && inputValue.length > 0) {
            const end = inputValue.length;
            const endSelection = { end, start: end };
            shouldForceCursorAtEndRef.current = true;
            selectionRef.current = endSelection;
            setSelection(endSelection);
            setShouldForceCursorAtEnd(true);
            inputRef.current?.setNativeProps?.({
              selection: endSelection,
            });
          } else {
            releaseForcedCursor();
          }
          onFocus?.(event);
        },
        [focusCursorAtEnd, inputValue.length, onFocus, releaseForcedCursor],
      );

      const handleBlur = useCallback<NonNullable<TextInputProps['onBlur']>>(
        event => {
          releaseForcedCursor();
          onBlur?.(event);
        },
        [onBlur, releaseForcedCursor],
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

      const textInputProps: TextInputProps = {
        ...inputProps,
        allowFontScaling: false,
        inputMode,
        keyboardType,
        maxLength: shouldLockInputLength
          ? inputValue.length
          : UNRESTRICTED_TEXT_INPUT_MAX_LENGTH,
        multiline: false,
        numberOfLines: 1,
        onBlur: handleBlur,
        onChangeText: handleChangeText,
        onFocus: handleFocus,
        onSelectionChange: handleSelectionChange,
        scrollEnabled: true,
        selection:
          shouldForceCursorAtEnd && inputValue.length > 0
            ? { end: inputValue.length, start: inputValue.length }
            : inputValue.length === 0
            ? emptySelection ?? resolvePerpsProEmptyInputSelection()
            : undefined,
        value: inputValue,
      };

      return <InputComponent {...textInputProps} ref={inputRef} />;
    },
  ),
);

PerpsProDecimalTextInput.displayName = 'PerpsProDecimalTextInput';
