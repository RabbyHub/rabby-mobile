import type { ColorValue } from 'react-native/Libraries/StyleSheet/StyleSheet';
import { AppColorsVariants, ThemeColors } from '@/constant/theme';

export type ColorOrVariant = keyof AppColorsVariants | ColorValue;
export function isColorVariant(
  colorVariants: ColorOrVariant,
): colorVariants is keyof AppColorsVariants {
  return (
    colorVariants in ThemeColors.light && colorVariants in ThemeColors.dark
  );
}

export function pickColorVariants(
  input:
    | ColorOrVariant
    | {
        onLight: ColorOrVariant;
        onDark?: ColorOrVariant;
      },
  isOnLight: boolean,
) {
  const options =
    typeof input === 'string'
      ? { onLight: input }
      : (input as typeof input & object);
  const { onLight, onDark = onLight } = options;

  if (isOnLight) {
    if (isColorVariant(onLight)) {
      return ThemeColors.light[input as keyof AppColorsVariants];
    }

    return onLight;
  } else {
    if (isColorVariant(onDark)) {
      return ThemeColors.dark[input as keyof AppColorsVariants];
    }

    return onDark;
  }
}
