import {memo} from 'react';
import {Image, ImageSourcePropType, ImageProps} from 'react-native';

import type {ColorValue} from 'react-native/Libraries/StyleSheet/StyleSheet';

import type {SvgProps} from 'react-native-svg';
import {useColorScheme} from '@/hooks/theme';

export const makeThemeIcon = (
  LightIcon: React.FC<SvgProps>,
  DarkIcon: React.FC<SvgProps>,
) =>
  memo((props: any) => {
    const isLight = useColorScheme() === 'light';

    return isLight ? <LightIcon {...props} /> : <DarkIcon {...props} />;
  });

export function makeThemeIconByCC(
  IconCC: React.FC<SvgProps>,
  {
    onLight,
    onDark,
  }: {
    onLight: ColorValue;
    onDark: ColorValue;
  },
) {
  return memo((props: any) => {
    const isLight = useColorScheme() === 'light';

    return isLight ? (
      <IconCC {...props} color={onLight} />
    ) : (
      <IconCC {...props} color={onDark} />
    );
  });
}

export function makeActiveIconByCC(
  IconCC: React.FC<SvgProps>,
  {
    activeColor,
    inactiveAcolor,
  }: {
    activeColor: ColorValue;
    inactiveAcolor: ColorValue;
  },
) {
  return memo((props: SvgProps & {isActive?: boolean}) => {
    const {isActive, ...otherProps} = props;

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
    const isLight = useColorScheme() === 'light';

    return <Image source={isLight ? lightPath : darkPath} {...props} />;
  });

export const makeUniPngIcon = (path: ImageSourcePropType) =>
  memo((props: Omit<ImageProps, 'source'>) => (
    <Image source={path} {...props} />
  ));
