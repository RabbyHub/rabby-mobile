import React from 'react';
import Svg, { SvgProps, Rect, Path, Circle } from 'react-native-svg';

export { default as RcIconBackCC } from './back-cc.svg';
export { default as RcIconBack1CC } from './back-1-cc.svg';
export { default as RcIconForwardCC } from './forward-cc.svg';
export { default as RcIconRefreshCC } from './refresh-cc.svg';
export { default as RcIconMoreCC } from './more-cc.svg';
export { default as RcIconMore1CC } from './more-1-cc.svg';
export { default as RcIconClose1CC } from './close-1-cc.svg';
export { default as RcIconTabsCC } from './tabs-cc.svg';
export { default as RcIconArrowTopLeftCC } from './arrow-top-left-cc.svg';
export { default as RcIconHomeCC } from './home-cc.svg';
export { default as RcIconStarCC } from './star-cc.svg';

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

export const ReactIconHome = (
  props: SvgProps & {
    backgroundColor?: string;
  },
) => (
  <Svg
    // xmlns="http://www.w3.org/2000/svg"
    width={44}
    height={44}
    fill="none"
    {...props}>
    <Rect
      width={44}
      height={44}
      fill={props.backgroundColor}
      fillOpacity={0.5}
      rx={22}
      transform="matrix(-1 0 0 1 44 0)"
    />
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={2.2}
      d="m11 20.4 9.25-7.4a2 2 0 0 1 2.5 0L32 20.4"
    />
    <Path
      fill="currentColor"
      d="M30.5 20v9a2 2 0 0 1-2 2H24v-6a1 1 0 0 0-1-1h-3a1 1 0 0 0-1 1v6h-4.5a2 2 0 0 1-2-2v-9l9-7 9 7Z"
    />
  </Svg>
);
