import React from 'react';
import {
  ColorSchemeName,
  Appearance,
  useColorScheme,
  AppState,
} from 'react-native';
import { atom, useAtom, useAtomValue } from 'jotai';

import {
  ThemeColors,
  AppColorsVariants,
  AppThemeScheme,
  AppColorSchemes,
} from '@/constant/theme';
import { atomByMMKV } from '@/core/storage/mmkv';
import { createGetStyles } from '@/utils/styles';
import { stringUtils } from '@rabby-wallet/base-utils';
import { devLog } from '@/utils/logger';
import { BUILD_CHANNEL } from '@/constant/env';

export const SHOULD_SUPPORT_DARK_MODE =
  __DEV__ || BUILD_CHANNEL === 'selfhost-reg';

const FORCE_THEME = 'light' as const;
function coerceBinaryTheme(
  appTheme: AppThemeScheme,
  rnColorScheme: ColorSchemeName = 'light',
): ColorSchemeName {
  if (SHOULD_SUPPORT_DARK_MODE) {
    return appTheme === 'system' ? rnColorScheme || 'light' : appTheme;
  }

  return FORCE_THEME;
}

function appThemeToColorScheme(appTheme: AppThemeScheme): ColorSchemeName {
  return appTheme === 'system'
    ? null
    : appTheme === 'dark'
    ? appTheme
    : 'light';
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

export function useGetBinaryMode() {
  const appTheme = useAtomValue(ThemeModeStore);
  const colorScheme = useColorScheme();

  return coerceBinaryTheme(appTheme, colorScheme);
}

// The useColorScheme value is always either light or dark, but the built-in
// type suggests that it can be null. This will not happen in practice, so this
// makes it a bit easier to work with.
export const useAppTheme = (options?: { isAppTop?: boolean }) => {
  const [appTheme, setAppTheme] = useAtom(ThemeModeStore);
  const colorScheme = useColorScheme();

  const toggleThemeMode = React.useCallback(
    (nextTheme?: AppThemeScheme) => {
      // throw new Error(`cannot specify theme node!`);

      if (!nextTheme) {
        nextTheme =
          AppColorSchemes[
            (AppColorSchemes.indexOf(appTheme) + 1) % AppColorSchemes.length
          ];
      }
      setAppTheme(nextTheme);
      Appearance.setColorScheme(appThemeToColorScheme(nextTheme));
    },
    [appTheme, setAppTheme],
  );

  const binaryTheme: ColorSchemeName = React.useMemo(
    () => coerceBinaryTheme(appTheme, colorScheme),
    [appTheme, colorScheme],
  );

  React.useEffect(() => {
    if (!options?.isAppTop) return;

    Appearance.setColorScheme(appThemeToColorScheme(appTheme));
  }, [options?.isAppTop, appTheme]);

  React.useEffect(() => {
    if (!options?.isAppTop) return;

    // will only triggered on `useColorScheme()`/`Appearance.getColorScheme()` equals to null (means 'system')
    const subp = Appearance.addChangeListener(
      (pref: Appearance.AppearancePreferences) => {
        devLog('system preference changed', pref);
      },
    );

    return () => {
      subp.remove();
    };
  }, [options?.isAppTop, appTheme]);

  const appThemeText = React.useMemo(
    () => stringUtils.ucfirst(appTheme),
    [appTheme],
  );

  return {
    appTheme,
    appThemeText,
    binaryTheme,
    toggleThemeMode,
  };
};

export const useThemeColors = (): AppColorsVariants => {
  const binaryTheme = useGetBinaryMode();

  return ThemeColors[binaryTheme];
};

export function useThemeStyles<T extends ReturnType<typeof createGetStyles>>(
  getStyle: T,
) {
  const appThemeMode = useGetBinaryMode();
  const colors = ThemeColors[appThemeMode] as AppColorsVariants;

  const isLight = appThemeMode === 'light';

  const cs = React.useMemo(() => {
    return {
      colors,
      styles: getStyle(colors, { isLight }) as ReturnType<T>,
    };
  }, [colors, getStyle, isLight]);

  return {
    ...cs,
    appThemeMode,
    isLight,
  };
}
