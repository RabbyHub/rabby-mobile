import React from 'react';
import Svg, { Rect, Path } from 'react-native-svg';

type IconRightCCProps = {
  width?: number;
  height?: number;
  rectColor?: string;
  pathColor?: string;
};

export const IconRightCC = ({
  width = 14,
  height = 14,
  rectColor = 'currentColor',
  pathColor = '#F7FAFC',
}: IconRightCCProps) => {
  return (
    <Svg width={width} height={height} viewBox="0 0 14 14" fill="none">
      <Rect width="14" height="14" rx="7" fill={rectColor} />
      <Path
        d="M5.5 4L8.5625 7.0625L5.5 10.125"
        stroke={pathColor}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
};
