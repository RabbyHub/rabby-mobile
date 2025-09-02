import React, { useRef } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useMemoizedFn } from 'ahooks';
import { isNumber } from 'lodash';

export const StepInput: React.FC<{
  value?: number;
  onChange?(v: number): void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}> = ({ value, onChange, min, max, step = 1, suffix }) => {
  const { styles } = useTheme2024({ getStyle: getStyle });
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
    if (Number.isNaN(nextVal)) {
      onChange?.(0);
    } else if (isNumber(min) && nextVal < min) {
      onChange?.(min);
    } else if (isNumber(max) && nextVal > max) {
      onChange?.(max);
    } else {
      onChange?.(nextVal);
    }
  });

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={handleMinus}
        disabled={value == null || (isNumber(min) && value <= min)}>
        <View style={styles.minus}>
          <Text style={styles.text}>-</Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => {
          inputRef.current?.focus();
        }}>
        <View style={styles.content}>
          <TextInput
            keyboardType="numeric"
            ref={inputRef}
            value={value == null ? '' : String(value)}
            style={styles.input}
            onChangeText={handleChangeText}
          />
          {suffix ? <Text style={styles.text}>{suffix}</Text> : null}
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={handlePlus}
        disabled={value == null || (isNumber(max) && value >= max)}>
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
    },
  };
});
