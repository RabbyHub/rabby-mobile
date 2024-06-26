import React from 'react';

import FastImage, { FastImageProps } from 'react-native-fast-image';
import type { SvgProps } from 'react-native-svg';

export type ThemeIconType = FastImageProps['source'] | React.FC<SvgProps>;

export default function ThemeIcon<T extends ThemeIconType>({
  src: ImgSrcOrSvg,
  svgSize,
  color,
  ...props
}: (T extends Function ? SvgProps : FastImageProps) & {
  src: T;
  color?: string;
  svgSize?: number | string;
}) {
  if (typeof ImgSrcOrSvg !== 'function') {
    return (
      <FastImage
        {...(props as FastImageProps)}
        source={ImgSrcOrSvg}
        style={[color && { color }, props.style as any]}
      />
    );
  }

  if (!ImgSrcOrSvg) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        `ThemeIcon: src is ${ImgSrcOrSvg}, see more details from trace stack`,
      );
    }
    return null;
  }

  const SvgComponet = ImgSrcOrSvg as React.FC<SvgProps>;

  return (
    <SvgComponet
      {...(props as SvgProps)}
      style={[color && { color }, props.style as any]}
      {...(svgSize && {
        width: svgSize,
        height: svgSize,
      })}
    />
  );
}
