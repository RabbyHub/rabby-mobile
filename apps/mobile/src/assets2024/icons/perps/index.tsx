import Svg, { SvgProps, Rect, Path } from 'react-native-svg';
export { default as RcLogoutCC } from './logout-cc.svg';
export { default as RcTradPerps } from './trade-perps.svg';
export { default as RcWarningFull } from './waring-full.svg';
export { default as RcArrowRightCC } from './arrow-right-cc.svg';

export const RcIconLong = (
  props: SvgProps & {
    bgColor?: string;
  },
) => (
  <Svg
    // xmlns="http://www.w3.org/2000/svg"
    width={20}
    height={20}
    fill="none"
    {...props}>
    <Rect width={20} height={20} fill={props.bgColor} rx={10} />

    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.875}
      d="M13.809 12.97V6.192h-6.78M13.808 6.192 6.25 13.75"
    />
  </Svg>
);

export const RcIconShort = (
  props: SvgProps & {
    bgColor?: string;
  },
) => (
  <Svg
    // xmlns="http://www.w3.org/2000/svg"
    width={20}
    height={20}
    fill="none"
    {...props}>
    <Rect width={20} height={20} fill={props.bgColor} rx={10} />
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.875}
      d="M13.809 7.03v6.779h-6.78M13.808 13.808 6.25 6.25"
    />
  </Svg>
);
