import * as React from 'react';
import Svg, { SvgProps, Rect, Path } from 'react-native-svg';

export const ArrowCircleCC = (
  props: {
    backgroundColor: string;
    color: string;
    width?: number;
    height?: number;
  } & SvgProps,
) => {
  const { color, backgroundColor, width = 26, height = 26, ...rest } = props;
  return (
    <Svg
      // @ts-expect-error type don't need it
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      viewBox="0 0 26 26"
      fill="none"
      {...rest}>
      <Rect width={26} height={26} fill={backgroundColor} rx={13} />
      <Path
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2.095}
        d="m10.5 6.79 5.928 5.926-5.927 5.927"
      />
    </Svg>
  );
};

export const QrCircleCC = (
  props: {
    backgroundColor: string;
    color: string;
  } & SvgProps,
) => {
  const { color, backgroundColor, ...rest } = props;
  return (
    <Svg
      // @ts-expect-error type don't need it
      xmlns="http://www.w3.org/2000/svg"
      width={26}
      height={26}
      fill="none"
      {...rest}>
      <Rect width={26} height={26} fill={backgroundColor} rx={13} />
      <Path
        fill={color}
        d="M15.709 15.525h1.95v-1.95h1.95V16.5h-1.95v.975h-1.95V16.5h-1.95v-2.925h1.95v1.95Zm-8.775-.836c0-.615.498-1.114 1.114-1.114h3.621c.616 0 1.115.499 1.115 1.114v3.622c0 .615-.5 1.114-1.115 1.114H8.048a1.114 1.114 0 0 1-1.114-1.114v-3.622Zm1.95.836v1.95h1.95v-1.95h-1.95Zm-1.95-7.66c0-.616.498-1.115 1.114-1.115h3.621c.616 0 1.115.499 1.115 1.114v3.622c0 .615-.5 1.114-1.115 1.114H8.048a1.114 1.114 0 0 1-1.114-1.114V7.864Zm1.95.835v1.95h1.95V8.7h-1.95Zm4.875-.836c0-.615.498-1.114 1.114-1.114h3.621c.616 0 1.115.499 1.115 1.114v3.622c0 .615-.5 1.114-1.115 1.114h-3.621a1.114 1.114 0 0 1-1.114-1.114V7.864Zm1.95.836v1.95h1.95V8.7h-1.95Zm1.95 8.775h1.95v1.95h-1.95v-1.95Zm-3.9 0h1.95v1.95h-1.95v-1.95Z"
      />
    </Svg>
  );
};
