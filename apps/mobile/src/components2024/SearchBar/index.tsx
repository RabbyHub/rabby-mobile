import React, { useImperativeHandle, useRef, useState } from 'react';
import {
  StyleProp,
  Text,
  TextInput,
  TextInputProps,
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

export interface Props extends Omit<TextInputProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  onCancel?(): void;
  noCancel?: boolean;
  ref?: React.ForwardedRef<{
    focus(): void;
    blur(): void;
    clear(): void;
  }>;
}

export const NextSearchBar: React.FC<Props> = React.forwardRef(
  (
    {
      style,
      value,
      onChangeText,
      onChange,
      onBlur,
      onFocus,
      onCancel,
      noCancel,
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
        <View style={styles.inputContainer}>
          <TouchableWithoutFeedback
            hitSlop={8}
            onPress={() => {
              inputRef.current?.focus();
            }}>
            <RcNextSearchCC
              style={styles.searchIcon}
              color={colors2024['neutral-foot']}
              width={16}
              height={16}
            />
          </TouchableWithoutFeedback>
          <TextInput
            ref={inputRef}
            style={[styles.input, isEmpty ? styles.placeholder : null]}
            placeholderTextColor={styles.placeholder.color}
            value={value}
            onChangeText={onChangeText}
            onChange={onChange}
            onBlur={handleBlur}
            onFocus={handleFocus}
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
        {isFocus && !noCancel ? (
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
    borderRadius: 16,
    backgroundColor: colors2024['neutral-bg-2'],
    paddingHorizontal: 8,
    gap: 7,
  },

  searchIcon: { marginLeft: 12 },
  closeIcon: {},
  input: {
    flex: 1,
    fontFamily: 'SF Pro Rounded',
    height: 52,
    fontSize: 17,
    // lineHeight: 22,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    textAlignVertical: 'center',
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  placeholder: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '400',
    color: isLight
      ? colors2024['neutral-secondary']
      : colors2024['neutral-foot'],
  },
  cancelText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    color: colors2024['neutral-secondary'],
  },
}));
