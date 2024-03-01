import React from 'react';
import { ColorSchemeName, Appearance } from 'react-native';
import { atom, useAtom, useAtomValue } from 'jotai';

import {
  ThemeColors,
  AppColorsVariants,
  AppThemeScheme,
  AppColorSchemes,
} from '@/constant/theme';
import { atomByMMKV } from '@/core/storage/mmkv';
import { useColorScheme } from 'nativewind';
import { createGetStyles } from '@/utils/styles';

const STATIC_THEME = 'light';

function coerceColorSchemeName(
  appTheme: AppThemeScheme,
  themeBySystem: ColorSchemeName = 'light',
): NonNullable<ColorSchemeName> {
  if (__DEV__) {
    return appTheme === 'system' ? themeBySystem ?? 'light' : appTheme;
  }

  return STATIC_THEME;
}

const ThemeStoreBase = atomByMMKV('AppTheme', 'light' as AppThemeScheme);

const ThemeModeStore = atom(
  get => get(ThemeStoreBase),
  (get, set, update) => {
    const nextValue =
      typeof update === 'function' ? update(get(ThemeStoreBase)) : update;
    set(ThemeStoreBase, nextValue);
  },
);

export function useGetAppThemeMode() {
  const appTheme = useAtomValue(ThemeModeStore);

  const { colorScheme } = useColorScheme();

  if (__DEV__) {
    return (
      appTheme === 'system' ? colorScheme : appTheme
    ) as NonNullable<ColorSchemeName>;
  }

  return STATIC_THEME as NonNullable<ColorSchemeName>;
}

// The useColorScheme value is always either light or dark, but the built-in
// type suggests that it can be null. This will not happen in practice, so this
// makes it a bit easier to work with.
export const useAppTheme = (options?: { isAppTop?: boolean }) => {
  const [appTheme, setAppTheme] = useAtom(ThemeModeStore);
  const { colorScheme, setColorScheme } = useColorScheme();

  const toggleThemeMode = React.useCallback(
    (nextTheme?: AppThemeScheme) => {
      if (!nextTheme) {
        nextTheme =
          AppColorSchemes[
            (AppColorSchemes.indexOf(appTheme) + 1) % AppColorSchemes.length
          ];
      }
      setAppTheme(nextTheme);
      setColorScheme(nextTheme);
    },
    [appTheme, setAppTheme, setColorScheme],
  );

  const binaryTheme = coerceColorSchemeName(appTheme, colorScheme);

  React.useEffect(() => {
    if (options?.isAppTop) {
      setColorScheme(binaryTheme);
      Appearance.setColorScheme(binaryTheme);
    }
  }, [options?.isAppTop, binaryTheme, setColorScheme]);

  return {
    appTheme,
    binaryTheme,
    toggleThemeMode,
  };
};

export const useThemeColors = (): AppColorsVariants => {
  const binaryTheme = useGetAppThemeMode();

  return ThemeColors[binaryTheme];
};

export function useThemeStyles<T extends ReturnType<typeof createGetStyles>>(
  getStyle: T,
) {
  const colors = useThemeColors();

  return React.useMemo(() => {
    return {
      colors,
      styles: getStyle(colors) as ReturnType<T>,
    };
  }, [colors, getStyle]);
}
