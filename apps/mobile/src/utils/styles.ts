import { AppColorsVariants } from '@/constant/theme';
import { ImageStyle, StyleSheet, TextStyle, ViewStyle } from 'react-native';
type NamedStyles<T> = { [P in keyof T]: ViewStyle | TextStyle | ImageStyle };

export const createGetStyles =
  <T extends NamedStyles<T> | NamedStyles<any>>(
    styles: (colors: AppColorsVariants) => T | NamedStyles<T>,
  ) =>
  (colors: AppColorsVariants) =>
    StyleSheet.create(styles(colors));
