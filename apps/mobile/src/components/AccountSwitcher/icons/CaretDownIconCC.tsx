import React from 'react';
import { SvgProps, Svg, Rect, Path } from 'react-native-svg';

interface CaretDownIconCCProps extends SvgProps {
  width?: number;
  height?: number;
  bgColor?: string;
  lineColor?: string;
}

export const CaretDownIconCC: React.FC<CaretDownIconCCProps> = ({
  width = 18,
  height = 18,
  bgColor = '#F2F4F7',
  lineColor = '#192945',
  ...props
}) => (
  <Svg width={width} height={height} viewBox="0 0 18 18" fill="none" {...props}>
    <Rect
      width="18"
      height="18"
      rx="9"
      transform="matrix(0 1 1 0 0 0)"
      fill={bgColor}
      fillOpacity="1"
    />
    <Path
      d="M5.27344 7.4984L8.82973 11.0547L12.386 7.4984"
      stroke={lineColor}
      strokeWidth="1.25723"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);
