import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import {
  StyleSheet,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { Text } from '@/components/Typography';

type Option = {
  key: string;
  label: string;
  testID?: RNViewProps['testID'];
  accessibilityLabel?: RNViewProps['accessibilityLabel'];
};

export type PillsSwitchProps<T extends readonly Option[] | Option[]> = {
  value?: T[number]['key'];
  options?: T;
  onTabChange?: (key: T[number]['key']) => any;
  itemStyle?: ViewStyle | TextStyle;
  itemActiveStyle?: ViewStyle | TextStyle;
  itemInactiveStyle?: ViewStyle | TextStyle;
  containerStyle?: ViewStyle;
  activeTextStyle?: TextStyle;
  inactiveTextStyle?: TextStyle;
} & Pick<RNViewProps, 'testID' | 'accessibilityLabel'>;

export function PillsSwitch<T extends readonly Option[] | Option[]>({
  options = [] as unknown as T,
  value,
  onTabChange,
  itemStyle,
  itemActiveStyle,
  itemInactiveStyle,
  containerStyle,
  activeTextStyle,
  inactiveTextStyle,
  testID,
  accessibilityLabel,
}: PillsSwitchProps<T>) {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  return (
    <View
      style={[styles.container, containerStyle]}
      testID={testID}
      accessibilityLabel={accessibilityLabel}>
      {options.map((item: Option) => {
        const isActive = item.key === value;

        return (
          <TouchableOpacity
            key={`pills-switch-${item.key}`}
            testID={item.testID}
            accessibilityLabel={item.accessibilityLabel ?? item.testID}
            style={[
              styles.item,
              itemStyle,
              isActive
                ? [styles.activeItem, itemActiveStyle]
                : [itemInactiveStyle],
            ]}
            onPress={() => {
              onTabChange?.(item.key);
            }}
            activeOpacity={0.7}>
            <Text
              style={[
                styles.text,
                isActive
                  ? [styles.activeText, activeTextStyle]
                  : inactiveTextStyle,
              ]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const getStyles = createGetStyles2024(({ colors }) => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors['neutral-line'],
    borderRadius: 4,
    padding: 2,
  },
  item: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    height: 28,
    minWidth: 120,
  },
  activeItem: {
    backgroundColor: colors['neutral-bg-1'],
  },
  text: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '500',
    color: colors['neutral-body'],
  },
  activeText: {
    color: colors['blue-default'],
  },
}));
