import { AnimatedText } from '@/components/Typography';
import {
  getPerpsProTabTextStyle,
  PERPS_MARKET_TAB_LAYOUT,
} from '@/components2024/PerpsTab/visual';
import { RoundedFontStyles } from '@/core/utils/fonts';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { View } from 'react-native';
import { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

export const PerpsSearchTabLabel = ({
  index,
  indexDecimal,
  text,
  icon,
}: {
  index: number;
  indexDecimal: SharedValue<number>;
  text: string;
  icon?: React.ReactNode;
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const activeColor = colors2024['neutral-title-1'];
  const inactiveColor = colors2024['neutral-secondary'];
  const animatedStyle = useAnimatedStyle(() => {
    const active = Math.abs(index - indexDecimal.value) < 0.5;
    return {
      ...(active ? RoundedFontStyles.bold : RoundedFontStyles.medium),
      color: active ? activeColor : inactiveColor,
    };
  });
  return (
    <View style={styles.container}>
      {text ? (
        <AnimatedText numberOfLines={1} style={[styles.label, animatedStyle]}>
          {text}
        </AnimatedText>
      ) : null}
      {icon}
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    height: PERPS_MARKET_TAB_LAYOUT.height,
    paddingTop: PERPS_MARKET_TAB_LAYOUT.paddingTop,
    alignItems: 'center',
  },
  label: getPerpsProTabTextStyle(colors2024),
}));
