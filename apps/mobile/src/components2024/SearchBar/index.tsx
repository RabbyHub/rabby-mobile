import React, { ReactNode, useImperativeHandle, useRef, useState } from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';

import {
  RcNextCloseCircle,
  RcNextCloseCircleDark,
  RcNextSearchCC,
} from '@/assets/icons/common';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useMemoizedFn } from 'ahooks';
import {
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native-gesture-handler';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';

export interface Props extends Omit<TextInputProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  inputContainerStyle?: StyleProp<ViewStyle>;
  onCancel?(): void;
  noCancel?: boolean;
  searchIcon?: ReactNode;
  alwaysShowCancel?: boolean;
  inputStyle?: StyleProp<TextStyle>;
  as?: 'TextInput' | 'BottomSheetTextInput';
}

export type NextSearchBarMethods = {
  focus(): void;
  blur(): void;
  clear(): void;
};

export const NextSearchBar = React.forwardRef<NextSearchBarMethods, Props>(
  (
    {
      style,
      inputContainerStyle,
      inputStyle,
      value,
      searchIcon,
      alwaysShowCancel,
      onChangeText,
      onChange,
      onBlur,
      onFocus,
      onCancel,
      noCancel,
      as = 'TextInput',
      ...rest
    },
    ref,
  ) => {
    const { styles, colors2024, isLight } = useTheme2024({
      getStyle,
    });

    const inputRef = useRef<any>(null);
    const isEmpty = !value;
    const [isFocus, setIsFocus] = useState(false);
    const handleBlur = useMemoizedFn(e => {
      setIsFocus(false);
      onBlur?.(e);
    });
    const handleFocus = useMemoizedFn(e => {
      setIsFocus(true);
      onFocus?.(e);
    });

    const InputComponent =
      as === 'TextInput' ? TextInput : BottomSheetTextInput;

    useImperativeHandle(ref, () => {
      return {
        focus() {
          return inputRef.current?.focus();
        },
        blur() {
          return inputRef.current?.blur();
        },
        clear() {
          return inputRef.current?.clear();
        },
      };
    });

    return (
      <View style={[styles.container, style]}>
        <View style={[styles.inputContainer, inputContainerStyle]}>
          <TouchableWithoutFeedback
            hitSlop={8}
            onPress={() => {
              inputRef.current?.focus();
            }}>
            {searchIcon || (
              <RcNextSearchCC
                style={styles.searchIcon}
                color={colors2024['neutral-secondary']}
                width={20}
                height={20}
              />
            )}
          </TouchableWithoutFeedback>
          <InputComponent
            ref={inputRef}
            style={StyleSheet.flatten([
              styles.input,
              inputStyle,
              isEmpty ? styles.placeholder : null,
            ])}
            placeholderTextColor={styles.placeholder.color}
            value={value}
            onChangeText={onChangeText}
            onChange={onChange}
            onBlur={handleBlur}
            onFocus={handleFocus}
            autoCorrect={false}
            spellCheck={false}
            {...rest}
          />
          {!isEmpty ? (
            <TouchableWithoutFeedback
              hitSlop={8}
              onPress={() => {
                onChangeText?.('');
                console.log('xx');
              }}>
              {isLight ? (
                <RcNextCloseCircle
                  style={styles.closeIcon}
                  color={colors2024['neutral-secondary']}
                />
              ) : (
                <RcNextCloseCircleDark
                  style={styles.closeIcon}
                  color={colors2024['neutral-secondary']}
                />
              )}
            </TouchableWithoutFeedback>
          ) : null}
        </View>
        {alwaysShowCancel || (isFocus && !noCancel) ? (
          <TouchableOpacity
            onPress={() => {
              onCancel?.();
              inputRef?.current?.blur();
            }}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  },
);

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  container: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  inputContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: colors2024['neutral-bg-5'],
    paddingHorizontal: 12,
    paddingLeft: 12,
    gap: 7,
  },

  searchIcon: {},
  closeIcon: {},
  input: {
    flex: 1,
    fontFamily: 'SF Pro Rounded',
    height: 46,
    fontSize: 16,
    // lineHeight: 20, // to avoid multi row show text
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    textAlignVertical: 'center',
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  placeholder: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
  },
  cancelText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    color: colors2024['neutral-secondary'],
  },
}));
