import { memo, useMemo } from 'react';
import { Image, ImageSourcePropType, ImageProps } from 'react-native';

import type { ColorValue } from 'react-native/Libraries/StyleSheet/StyleSheet';

import type { SvgProps } from 'react-native-svg';
import { useGetBinaryMode, useThemeColors } from '@/hooks/theme';
import { ColorOrVariant, pickColorVariants } from '@/core/theme';
import { AppColorsVariants } from '@/constant/theme';

export const makeThemeIcon = (
  LightIcon: React.FC<SvgProps>,
  DarkIcon: React.FC<SvgProps>,
) =>
  memo((props: SvgProps) => {
    const isLight = useGetBinaryMode() === 'light';

    return isLight ? <LightIcon {...props} /> : <DarkIcon {...props} />;
  });

export function makeThemeIconFromCC(
  IconCC: React.FC<SvgProps>,
  input:
    | ColorOrVariant
    | {
        onLight: ColorOrVariant;
        onDark?: ColorOrVariant;
      },
) {
  return memo((props: SvgProps) => {
    const isLight = useGetBinaryMode() === 'light';

    return <IconCC {...props} color={pickColorVariants(input, isLight)} />;
  });
}

type ActiveColors = {
  activeColor: ColorValue;
  inactiveColor: ColorValue;
};
export function makeActiveIconFromCC(
  IconCC: React.FC<SvgProps>,
  colorsOrGetColors:
    | ActiveColors
    | ((colors: AppColorsVariants) => ActiveColors),
) {
  return memo((props: SvgProps & { isActive?: boolean }) => {
    const { isActive, ...otherProps } = props;

    const colors = useThemeColors();
    const { activeColor, inactiveColor } = useMemo(() => {
      return typeof colorsOrGetColors === 'function'
        ? colorsOrGetColors(colors)
        : colorsOrGetColors;
    }, [colors]);

    return (
      <IconCC {...otherProps} color={isActive ? activeColor : inactiveColor} />
    );
  });
}

export const makePngIcon = (
  lightPath: ImageSourcePropType,
  darkPath: ImageSourcePropType,
) =>
  memo((props: any) => {
    const isLight = useGetBinaryMode() === 'light';

    return <Image source={isLight ? lightPath : darkPath} {...props} />;
  });

export const makeUniPngIcon = (path: ImageSourcePropType) =>
  memo((props: Omit<ImageProps, 'source'>) => (
    <Image source={path} {...props} />
  ));
