import {
  ColorSchemeName,
  useColorScheme as useColorSchemeO,
} from 'react-native';

import { ThemeColors, Colors } from '@/constant/theme';
import { useGetTheme } from '@/core/storage/theme';

// The useColorScheme value is always either light or dark, but the built-in
// type suggests that it can be null. This will not happen in practice, so this
// makes it a bit easier to work with.
export const useColorScheme = () => {
  const theme = useGetTheme();
  const systemTheme = useColorSchemeO();

  return (
    theme === 'system' ? systemTheme : theme
  ) as NonNullable<ColorSchemeName>;
};

export const useThemeColors = (): Colors => {
  const theme = useColorScheme();

  return ThemeColors[theme];
};
