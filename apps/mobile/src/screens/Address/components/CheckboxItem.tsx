import { RcIconCheckedFilledCC, RcIconUncheckCC } from '@/assets/icons/common';
import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    checkbox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      minHeight: 72,
      borderWidth: 1,
      borderColor: 'transparent',
      borderRadius: 8,
      paddingHorizontal: 15,
      paddingVertical: 17,
      backgroundColor: colors['neutral-card-1'],
    },
    checkboxChecked: {
      borderColor: colors['blue-default'],
    },
    checkboxLabel: {
      minWidth: 0,
      flex: 1,
      color: colors['neutral-title-1'],
      lineHeight: 18,
      fontSize: 14,
      fontWeight: '500',
    },
  });

interface Props<T> {
  label: string;
  value: T;
  checked?: boolean;
  onChange?: (value: T) => void;
}

export function CheckboxItem<T>({ label, value, checked, onChange }: Props<T>) {
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  return (
    <TouchableOpacity
      onPress={() => {
        onChange?.(value);
      }}>
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked ? (
          <RcIconCheckedFilledCC
            width={20}
            height={20}
            color={colors['blue-default']}
          />
        ) : (
          <RcIconUncheckCC
            width={20}
            height={20}
            color={colors['neutral-foot']}
          />
        )}
        <Text style={styles.checkboxLabel}>{label}</Text>
      </View>
    </TouchableOpacity>
  );
}
