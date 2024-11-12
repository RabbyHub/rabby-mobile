import React, { useRef, useState } from 'react';
import {
  StyleProp,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';

import { RcIconCloseCC, RcNextSearchCC } from '@/assets/icons/common';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useMemoizedFn } from 'ahooks';
import {
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native-gesture-handler';

export interface Props
  extends Pick<
    TextInputProps,
    'value' | 'onChange' | 'onChangeText' | 'onBlur' | 'onFocus'
  > {
  style?: StyleProp<ViewStyle>;
  placeholder?: string;
  onCancel?(): void;
}

export const NextSearchBar: React.FC<Props> = ({
  style,
  placeholder,
  value,
  onChangeText,
  onChange,
  onBlur,
  onFocus,
  onCancel,
}) => {
  const { styles, colors2024 } = useTheme2024({
    getStyle,
  });

  const inputRef = useRef<TextInput>(null);
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
          />
        </TouchableWithoutFeedback>
        <TextInput
          ref={inputRef}
          style={[styles.input, isEmpty ? styles.placeholder : null]}
          numberOfLines={1}
          placeholder={placeholder}
          value={value}
          onChangeText={onChangeText}
          onChange={onChange}
          onBlur={handleBlur}
          onFocus={handleFocus}
        />
        {!isEmpty ? (
          <TouchableWithoutFeedback
            hitSlop={8}
            onPress={() => {
              onChangeText?.('');
              console.log('xx');
            }}>
            <RcIconCloseCC
              style={styles.closeIcon}
              color={colors2024['neutral-secondary']}
            />
          </TouchableWithoutFeedback>
        ) : null}
      </View>
      {isFocus ? (
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
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  inputContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 30,
    backgroundColor: colors2024['neutral-bg-2'],
    paddingHorizontal: 8,
    paddingVertical: 12,
    gap: 8,
  },

  searchIcon: { marginLeft: 12 },
  closeIcon: {},
  input: {
    flex: 1,

    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],

    verticalAlign: 'middle',
  },
  placeholder: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '400',
    color: colors2024['neutral-secondary'],
  },
  cancelText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    color: colors2024['neutral-secondary'],
  },
}));
