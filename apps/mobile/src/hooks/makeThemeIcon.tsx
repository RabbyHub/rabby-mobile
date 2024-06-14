import { memo } from 'react';
import { Image, ImageSourcePropType, ImageProps } from 'react-native';

import type { ColorValue } from 'react-native/Libraries/StyleSheet/StyleSheet';

import type { SvgProps } from 'react-native-svg';
import { useGetBinaryMode } from '@/hooks/theme';
import { ColorOrVariant, pickColorVariants } from '@/core/theme';

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

export function makeActiveIconFromCC(
  IconCC: React.FC<SvgProps>,
  {
    activeColor,
    inactiveColor,
  }: {
    activeColor: ColorValue;
    inactiveColor: ColorValue;
  },
) {
  return memo((props: SvgProps & { isActive?: boolean }) => {
    const { isActive, ...otherProps } = props;

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
