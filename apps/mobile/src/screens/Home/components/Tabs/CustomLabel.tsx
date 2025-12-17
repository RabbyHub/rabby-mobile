// ((props: TabItemProps<T>) => React.ReactNode);
import React from 'react';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { TextProps } from 'react-native';
import { DefaultStyle } from 'react-native-reanimated/lib/typescript/hook/commonTypes';
import { ThemeColors2024 } from '@rabby-wallet/base-utils';

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
  text,
  style,
}: CustomLabelProps) => {
  const { styles, colors2024, isLight } = useTheme2024({ getStyle: getStyles });

  const stylez = useAnimatedStyle(() => {
    return {
      color:
        Math.abs(index - indexDecimal.value) < 0.5
          ? isLight
            ? ThemeColors2024.dark['neutral-title-1']
            : ThemeColors2024.light['neutral-title-1']
          : colors2024['neutral-secondary'],
    } as DefaultStyle;
  });
  const wrapperStyle = useAnimatedStyle(() => {
    return {
      backgroundColor:
        Math.abs(index - indexDecimal.value) < 0.5
          ? isLight
            ? ThemeColors2024.dark['neutral-bg-1']
            : '#FFF'
          : 'transparent',
    } as DefaultStyle;
  });
  return (
    <Animated.View style={[styles.container, wrapperStyle]}>
      <Animated.Text style={[styles.label, stylez, style]}>
        {text}
      </Animated.Text>
    </Animated.View>
  );
};

export default CustomLabel;

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  container: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 32,
    width: 70,
    paddingLeft: 8,
    paddingRight: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  label: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    textTransform: 'none',
    textAlign: 'center',
    color: colors2024['neutral-secondary'],
  },
}));
