import React, { useRef } from 'react';
import {
  StyleProp,
  Text,
  TextInput,
  TextStyle,
  TouchableOpacity,
  View,
  Platform,
} from 'react-native';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useMemoizedFn } from 'ahooks';
import { isNumber } from 'lodash';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
const isAndroid = Platform.OS === 'android';

export const StepInput: React.FC<{
  value?: number;
  onChange?(v?: number): void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  as?: 'TextInput' | 'BottomSheetTextInput';
  inputStyle?: StyleProp<TextStyle>;
}> = ({
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
  as = 'TextInput',
  inputStyle,
}) => {
  const { styles } = useTheme2024({ getStyle: getStyle });
  const InputComponent =
    as === 'BottomSheetTextInput'
      ? (BottomSheetTextInput as unknown as typeof TextInput)
      : TextInput;

  const inputRef = useRef<TextInput>(null);

  const handlePlus = useMemoizedFn(() => {
    const nextVal = (value || 0) + step;
    if (isNumber(max) && nextVal > max) {
      onChange?.(max);
    } else {
      onChange?.(nextVal);
    }
  });

  const handleMinus = useMemoizedFn(() => {
    const nextVal = (value || 0) - step;
    if (isNumber(min) && nextVal < min) {
      onChange?.(min);
    } else {
      onChange?.(nextVal);
    }
  });

  const handleChangeText = useMemoizedFn((v: string) => {
    const nextVal = +v;

    if (Number.isNaN(nextVal) || v === '') {
      onChange?.();
      // } else if (isNumber(min) && nextVal < min) {
      //   onChange?.(min);
      // } else if (isNumber(max) && nextVal > max) {
      //   onChange?.(max);
    } else {
      onChange?.(nextVal);
    }
  });

  const isMinDisabled = value == null || (isNumber(min) && value <= min);
  const isMaxDisabled = value == null || (isNumber(max) && value >= max);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={handleMinus}
        disabled={isMinDisabled}
        style={isMinDisabled ? styles.disabled : null}>
        <View style={styles.minus}>
          <Text style={styles.text}>-</Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => {
          inputRef.current?.focus();
        }}>
        <View style={styles.content}>
          <InputComponent
            keyboardType="numeric"
            ref={inputRef}
            value={value == null ? '' : String(value)}
            style={[styles.input, inputStyle]}
            onChangeText={handleChangeText}
          />
          {suffix ? (
            <Text
              style={[
                styles.text,
                inputStyle,
                value == null ? styles.opacity0 : null,
              ]}>
              {suffix}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={handlePlus}
        disabled={isMaxDisabled}
        style={isMaxDisabled ? styles.disabled : null}>
        <View style={styles.plus}>
          <Text style={styles.text}>+</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => {
  return {
    container: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    minus: {
      backgroundColor: colors2024['neutral-bg-5'],
      width: 32,
      height: 30,
      borderTopLeftRadius: 6,
      borderBottomLeftRadius: 6,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    plus: {
      backgroundColor: colors2024['neutral-bg-5'],
      width: 32,
      height: 30,
      borderTopRightRadius: 6,
      borderBottomRightRadius: 6,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    text: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 17,
      lineHeight: 22,
      fontWeight: '700',
      color: colors2024['neutral-title-1'],
    },
    content: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors2024['neutral-bg-5'],
      height: 30,
      paddingVertical: 4,
      paddingHorizontal: 12,
    },
    input: {
      minWidth: 10,
      textAlign: 'right',
      fontFamily: 'SF Pro Rounded',
      fontSize: 17,
      // lineHeight: 22,
      fontWeight: '700',
      ...(isAndroid
        ? {
            height: 60, // avoid some android phone show number not in center
            lineHeight: 22,
          }
        : {}),
      color: colors2024['neutral-title-1'],
    },
    opacity0: {
      opacity: 0,
    },
    disabled: {
      opacity: 0.5,
    },
  };
});
