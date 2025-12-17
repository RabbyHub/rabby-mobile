// ((props: TabItemProps<T>) => React.ReactNode);
import React from 'react';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { TextProps, View } from 'react-native';
import { DefaultStyle } from 'react-native-reanimated/lib/typescript/hook/commonTypes';

interface CustomLabelProps {
  index: number;
  indexDecimal: Animated.SharedValue<number>;
  icon?: React.ReactNode;
  text: string;
  activeColor?: string;
  inactiveColor?: string;
  activeFontWeight?: string;
  inactiveFontWeight?: string;
  activeFontSize?: number;
  inactiveFontSize?: number;
  style?: TextProps['style'];
}
const CustomLabel = ({
  index,
  indexDecimal,
  icon,
  text,
  activeColor: activeColorProp,
  inactiveColor: inactiveColorProp,
  activeFontWeight = '700',
  inactiveFontWeight = '500',
  activeFontSize = 16,
  inactiveFontSize = 16,
  style,
}: CustomLabelProps) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });

  const activeColor = activeColorProp || colors2024['neutral-body'];
  const inactiveColor = inactiveColorProp || colors2024['neutral-secondary'];

  const stylez = useAnimatedStyle(() => {
    return {
      fontSize:
        Math.abs(index - indexDecimal.value) < 0.5
          ? activeFontSize
          : inactiveFontSize,
      color:
        Math.abs(index - indexDecimal.value) < 0.5
          ? activeColor
          : inactiveColor,
      fontWeight:
        Math.abs(index - indexDecimal.value) < 0.5
          ? activeFontWeight
          : inactiveFontWeight,
    } as DefaultStyle;
  });
  return (
    <View style={styles.container}>
      <Animated.Text style={[styles.label, stylez, style]}>
        {text}
      </Animated.Text>
      {icon}
    </View>
  );
};

export default CustomLabel;

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  container: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 30,
  },
  label: {
    margin: 4,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
    textTransform: 'none',
    textAlign: 'center',
    color: colors2024['neutral-secondary'],
  },
}));
