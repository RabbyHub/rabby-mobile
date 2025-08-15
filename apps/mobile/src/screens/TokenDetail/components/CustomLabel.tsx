// ((props: TabItemProps<T>) => React.ReactNode);
import React from 'react';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { View } from 'react-native';

interface CustomLabelProps {
  index: number;
  indexDecimal: Animated.SharedValue<number>;
  icon?: React.ReactNode;
  text: string;
}
const CustomLabel = ({ index, indexDecimal, icon, text }: CustomLabelProps) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const stylez = useAnimatedStyle(() => {
    return {
      color:
        Math.abs(index - indexDecimal.value) < 0.5
          ? colors2024['neutral-body']
          : colors2024['neutral-secondary'],
      fontWeight: Math.abs(index - indexDecimal.value) < 0.5 ? '700' : '500',
    };
  });
  return (
    <View style={styles.container}>
      <Animated.Text style={[styles.label, stylez]}>{text}</Animated.Text>
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
