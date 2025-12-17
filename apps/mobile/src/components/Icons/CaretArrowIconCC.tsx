import React from 'react';
import { SvgProps, Svg, Rect, Path } from 'react-native-svg';

interface CaretIconCCProps extends SvgProps {
  /** @default 'down' */
  dir?: 'left' | 'right' | 'up' | 'down';
  width?: number;
  height?: number;
  bgColor?: string;
  lineColor?: string;
}

export const CaretArrowIconCC: React.FC<CaretIconCCProps> = ({
  width = 18,
  height = 18,
  bgColor = '#F2F4F7',
  lineColor = '#192945',
  dir = 'down',
  ...props
}) => {
  return (
    <Svg
      width={width}
      height={height}
      viewBox="0 0 18 18"
      fill="none"
      {...props}>
      <Rect
        width="18"
        height="18"
        rx="9"
        transform="matrix(0 1 1 0 0 0)"
        fill={bgColor}
        fillOpacity="1"
      />
      {dir === 'left' && (
        <Path
          d="M11.0547 5.27344L7.4984 8.82973L11.0547 12.386"
          stroke={lineColor}
          strokeWidth="1.25723"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {dir === 'right' && (
        <Path
          d="M7.4984 12.7266L11.0547 9.17027L7.4984 5.61396"
          stroke={lineColor}
          strokeWidth="1.25723"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {dir === 'up' && (
        <Path
          d="M12.386 11.0547L8.82973 7.4984L5.27344 11.0547"
          stroke={lineColor}
          strokeWidth="1.25723"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {dir === 'down' && (
        <Path
          d="M5.27344 7.4984L8.82973 11.0547L12.386 7.4984"
          stroke={lineColor}
          strokeWidth="1.25723"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </Svg>
  );
};
