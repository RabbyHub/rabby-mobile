import React from 'react';
import { View, Text, ViewStyle, TextStyle } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { useTheme2024 } from '@/hooks/theme';

interface DashedUnderlineTextProps {
  /**
   * text content
   */
  text: string;
  /**
   * text style
   */
  textStyle?: TextStyle;
  /**
   * dashed line color
   */
  dashColor?: string;
  /**
   * dashed line style "dashed line length,interval length"
   */
  dashArray?: string;
  /**
   * line width
   */
  strokeWidth?: number;
  /**
   * container style
   */
  style?: ViewStyle;
  /**
   * dashed line margin top
   */
  dashMarginTop?: number;
}

export const DashedUnderlineText: React.FC<DashedUnderlineTextProps> = ({
  text,
  textStyle,
  dashColor,
  dashArray = '3,2',
  strokeWidth = 1,
  style,
  dashMarginTop = 2,
}) => {
  const { colors2024 } = useTheme2024();

  const lineColor = dashColor || colors2024['neutral-line'];

  return (
    <View style={style}>
      <Text style={textStyle}>{text}</Text>
      <View style={{ marginTop: dashMarginTop, height: strokeWidth }}>
        <Svg width="100%" height="100%">
          <Line
            x1={0}
            y1={strokeWidth / 2}
            x2="100%"
            y2={strokeWidth / 2}
            stroke={lineColor}
            strokeWidth={1}
            strokeDasharray={dashArray}
            strokeLinecap="round"
          />
        </Svg>
      </View>
    </View>
  );
};

export default DashedUnderlineText;
