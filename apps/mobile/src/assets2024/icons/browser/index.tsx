import React from 'react';
import Svg, { SvgProps, Rect, Path, Circle } from 'react-native-svg';

export { default as RcIconBackCC } from './back-cc.svg';
export { default as RcIconForwardCC } from './forward-cc.svg';
export { default as RcIconRefreshCC } from './refresh-cc.svg';
export { default as RcIconMoreCC } from './more-cc.svg';

export const RcIconAddPlusCircle = ({
  backgroundColor,
  borderColor,
  ...rest
}: SvgProps & {
  backgroundColor?: string;
  borderColor?: string;
}) => (
  <Svg
    width={44}
    height={44}
    viewBox="0 0 44 44"
    fill="none"
    // xmlns="http://www.w3.org/2000/svg"
    {...rest}>
    <Rect x={1} y={1} width={42} height={42} rx={21} fill={backgroundColor} />
    <Rect
      x={1}
      y={1}
      width={42}
      height={42}
      rx={21}
      stroke={borderColor}
      strokeWidth={2}
    />
    <Path
      d="M13.5 22H30"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
    />
    <Path
      d="M21.75 30.25V13.75"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
    />
  </Svg>
);
