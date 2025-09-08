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

export const RcIconDepositCC = (
  props: SvgProps & {
    bgColor?: string;
  },
) => (
  <Svg
    // xmlns="http://www.w3.org/2000/svg"
    width={46}
    height={46}
    fill="none"
    {...props}>
    <Path
      fill={props.bgColor}
      fillOpacity={0.5}
      d="M23 0C10.29 0 0 10.29 0 23s10.29 23 23 23 23-10.29 23-23S35.71 0 23 0Z"
    />
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={3}
      d="M23 32V15M28 27l-5 5-5-5"
    />
  </Svg>
);

export const RcIconWithdrawCC = (
  props: SvgProps & {
    bgColor?: string;
  },
) => (
  <Svg
    // xmlns="http://www.w3.org/2000/svg"
    width={46}
    height={46}
    fill="none"
    {...props}>
    <Path
      fill={props.bgColor}
      fillOpacity={0.5}
      d="M23 46C10.29 46 0 35.71 0 23S10.29 0 23 0s23 10.29 23 23-10.29 23-23 23Z"
    />
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={3}
      d="M23 14v17M28 19l-5-5-5 5"
    />
  </Svg>
);
