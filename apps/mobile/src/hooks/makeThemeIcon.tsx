import { memo } from 'react';
import { Image, ImageSourcePropType, ImageProps } from 'react-native';

import type { ColorValue } from 'react-native/Libraries/StyleSheet/StyleSheet';

import type { SvgProps } from 'react-native-svg';
import { useGetAppThemeMode } from '@/hooks/theme';
import {
  ColorOrVariant,
  isColorVariant,
  pickColorVariants,
} from '@/core/theme';

export const makeThemeIcon = (
  LightIcon: React.FC<SvgProps>,
  DarkIcon: React.FC<SvgProps>,
) =>
  memo((props: SvgProps) => {
    const isLight = useGetAppThemeMode() === 'light';

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
    const isLight = useGetAppThemeMode() === 'light';

    return <IconCC {...props} color={pickColorVariants(input, isLight)} />;
  });
}

export function makeActiveIconFromCC(
  IconCC: React.FC<SvgProps>,
  {
    activeColor,
    inactiveAcolor,
  }: {
    activeColor: ColorValue;
    inactiveAcolor: ColorValue;
  },
) {
  return memo((props: SvgProps & { isActive?: boolean }) => {
    const { isActive, ...otherProps } = props;

    return (
      <IconCC {...otherProps} color={isActive ? activeColor : inactiveAcolor} />
    );
  });
}

export const makePngIcon = (
  lightPath: ImageSourcePropType,
  darkPath: ImageSourcePropType,
) =>
  memo((props: any) => {
    const isLight = useGetAppThemeMode() === 'light';

    return <Image source={isLight ? lightPath : darkPath} {...props} />;
  });

export const makeUniPngIcon = (path: ImageSourcePropType) =>
  memo((props: Omit<ImageProps, 'source'>) => (
    <Image source={path} {...props} />
  ));
