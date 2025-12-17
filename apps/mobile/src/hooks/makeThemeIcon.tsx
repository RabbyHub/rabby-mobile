import { memo, useMemo } from 'react';
import { Image, ImageSourcePropType, ImageProps } from 'react-native';

import type { ColorValue } from 'react-native/Libraries/StyleSheet/StyleSheet';

import type { SvgProps } from 'react-native-svg';
import { useGetBinaryMode, useTheme2024, useThemeColors } from '@/hooks/theme';
import { ColorOrVariant, pickColorVariants } from '@/core/theme';
import { AppColors2024Variants, AppColorsVariants } from '@/constant/theme';

export const makeThemeIcon = (
  LightIcon: React.FC<SvgProps>,
  DarkIcon: React.FC<SvgProps>,
) =>
  memo((props: SvgProps) => {
    const isLight = useGetBinaryMode() === 'light';

    return isLight ? <LightIcon {...props} /> : <DarkIcon {...props} />;
  });

type ThemeVaryVariants = {
  onLight: ColorOrVariant;
  onDark?: ColorOrVariant;
};
type ThemeVariants = ColorOrVariant | ThemeVaryVariants;
export function makeThemeIconFromCC(
  IconCC: React.FC<SvgProps>,
  colorsOrGetColors:
    | ThemeVariants
    | ((colors: AppColorsVariants) => ThemeVariants),
  options?: {
    allowColorProp?: boolean;
  },
) {
  const { allowColorProp } = options || {};
  return memo((props: SvgProps) => {
    const isLight = useGetBinaryMode() === 'light';
    const colors = useThemeColors();

    const input = useMemo(() => {
      return typeof colorsOrGetColors === 'function'
        ? colorsOrGetColors(colors)
        : colorsOrGetColors;
    }, [colors]);

    return (
      <IconCC
        {...props}
        color={pickColorVariants(input, isLight)}
        {...(allowColorProp && props.color && { color: props.color })}
      />
    );
  });
}

export function makeThemeIcon2024FromCC(
  IconCC: React.FC<SvgProps>,
  colorsOrGetColors:
    | ThemeVaryVariants
    | ((ctx: {
        colors: AppColorsVariants;
        colors2024: AppColors2024Variants;
      }) => ThemeVaryVariants),
  options?: {
    allowColorProp?: boolean;
  },
) {
  const { allowColorProp } = options || {};
  return memo((props: SvgProps) => {
    const isLight = useGetBinaryMode() === 'light';
    const { colors, colors2024 } = useTheme2024();

    const input = useMemo(() => {
      return typeof colorsOrGetColors === 'function'
        ? colorsOrGetColors({ colors, colors2024 })
        : colorsOrGetColors;
    }, [colors, colors2024]);

    return (
      <IconCC
        {...props}
        color={pickColorVariants(input, isLight)}
        {...(allowColorProp && props.color && { color: props.color })}
      />
    );
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
export function makeActiveIcon2024FromCC(
  IconCC: React.FC<SvgProps>,
  colorsOrGetColors:
    | ActiveColors
    | ((ctx: {
        colors: AppColorsVariants;
        colors2024: AppColors2024Variants;
        isLight?: boolean;
      }) => ActiveColors),
) {
  return memo((props: SvgProps & { isActive?: boolean }) => {
    const { isActive, ...otherProps } = props;
    const isLight = useGetBinaryMode() === 'light';
    const { colors, colors2024 } = useTheme2024();

    const { activeColor, inactiveColor } = useMemo(() => {
      return typeof colorsOrGetColors === 'function'
        ? colorsOrGetColors({ colors, colors2024, isLight })
        : colorsOrGetColors;
    }, [colors, colors2024, isLight]);

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
