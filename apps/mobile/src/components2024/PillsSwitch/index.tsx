import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { StyleProp, Text, TextStyle, View, ViewStyle } from 'react-native';
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
  height?: number;
  itemStyle?: StyleProp<ViewStyle>;
  activeItemStyle?: StyleProp<ViewStyle>;
  itemTextStyle?: StyleProp<TextStyle>;
  activeItemTextStyle?: StyleProp<TextStyle>;
  optionsStyle?: StyleProp<ViewStyle>;
};

export const PillsSwitch = <T extends readonly Option[] | Option[]>({
  options = [] as unknown as T,
  value,
  onTabChange,
  style,
  itemStyle,
  activeItemStyle,
  itemTextStyle,
  activeItemTextStyle,
  optionsStyle,
}: React.PropsWithoutRef<PillsSwitchProps<T>>) => {
  const { styles } = useTheme2024({ getStyle });
  return (
    <View style={[styles.container, style]}>
      <View style={[styles.options, optionsStyle]}>
        {options.map((item: Option) => {
          const isActive = item.key === value;

          return (
            <TouchableOpacity
              onPress={() => {
                onTabChange?.(item.key);
              }}
              containerStyle={[
                styles.item,
                isActive && styles.itemActive,
                itemStyle,
                isActive && activeItemStyle,
              ]}
              key={`pills-switch-${item.key}`}>
              <Text
                numberOfLines={1}
                style={[
                  styles.itemText,
                  isActive && styles.itemActiveText,
                  itemTextStyle,
                  isActive && activeItemTextStyle,
                ]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  options: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    borderRadius: 100,
    overflow: 'hidden',
    backgroundColor: colors2024['neutral-line'],
    width: '100%',
    paddingVertical: 4,
    paddingHorizontal: 5,
  },
  item: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
  itemActive: {
    backgroundColor: colors2024['neutral-bg-1'],
    borderRadius: 18,
  },
  itemText: {
    fontSize: 14,
    lineHeight: 18,
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
    textAlign: 'center',
    width: '100%',
  },
  itemActiveText: {
    color: colors2024['neutral-body'],
  },
}));
