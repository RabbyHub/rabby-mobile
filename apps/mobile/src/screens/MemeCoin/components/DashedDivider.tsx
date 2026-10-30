import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { useTheme2024 } from '@/hooks/theme';

export const DashedDivider = ({ style }: { style?: StyleProp<ViewStyle> }) => {
  const { colors2024 } = useTheme2024();
  return (
    <Svg width="100%" height={1} style={style}>
      <Line
        x1="0"
        y1="0.5"
        x2="100%"
        y2="0.5"
        stroke={colors2024['neutral-line']}
        strokeWidth={1}
        strokeDasharray="2 2"
      />
    </Svg>
  );
};
