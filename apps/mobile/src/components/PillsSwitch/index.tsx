import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';

type Option = {
  key: string;
  label: string;
};

export type PillsSwitchProps<T extends readonly Option[] | Option[]> = {
  value?: T[number]['key'];
  options?: T;
  onTabChange?: (key: T[number]['key']) => any;
  style?: StyleProp<ViewStyle>;
  itemStyle?: StyleProp<ViewStyle>;
};

export const PillsSwitch = <T extends readonly Option[] | Option[]>({
  options = [] as unknown as T,
  value,
  onTabChange,
  style,
  itemStyle,
}: React.PropsWithoutRef<PillsSwitchProps<T>>) => {
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  return (
    <View style={[styles.container, style]}>
      <View style={[styles.options]}>
        {options.map((item: Option) => {
          const isActive = item.key === value;

          return (
            <TouchableOpacity
              onPress={() => {
                onTabChange?.(item.key);
              }}
              key={`pills-switch-${item.key}`}
              style={[styles.item, isActive && styles.itemActive, itemStyle]}>
              <Text
                style={[styles.itemText, isActive && styles.itemActiveText]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const getStyles = (colors: AppColorsVariants) => {
  return StyleSheet.create({
    container: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    options: {
      display: 'flex',
      alignItems: 'center',
      flexDirection: 'row',
      borderRadius: 6,
      padding: 2,
      backgroundColor: colors['neutral-line'],
    },
    item: {
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 4,
    },
    itemActive: {
      backgroundColor: colors['neutral-bg-1'],
    },
    itemText: {
      fontSize: 13,
      lineHeight: 16,
      color: colors['neutral-body'],
      fontWeight: '500',
      textAlign: 'center',
    },
    itemActiveText: {
      color: colors['blue-default'],
    },
  });
};
