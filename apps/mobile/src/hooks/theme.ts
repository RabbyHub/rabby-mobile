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
import { useThemeMode } from '@rneui/themed';

const FORCE_THEME = 'light' as const;
function coerceBinaryTheme(
  appTheme: AppThemeScheme,
  rnColorScheme: ColorSchemeName = 'light',
): ColorSchemeName {
  if (__DEV__) {
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

export function useGetAppThemeMode() {
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

  // use system now always
  React.useEffect(() => {
    if (options?.isAppTop) {
      // will only triggered on `useColorScheme()`/`Appearance.getColorScheme()` equals to null (means 'system')
      const subp = Appearance.addChangeListener(
        (pref: Appearance.AppearancePreferences) => {
          devLog('system preference changed', pref);
          setAppTheme(pref.colorScheme);
        },
      );

      return () => {
        subp.remove();
      };
    }
  }, [options?.isAppTop, setAppTheme]);

  const appThemeText = React.useMemo(
    () => stringUtils.ucfirst(appTheme),
    [appTheme],
  );

  const { setMode } = useThemeMode();
  React.useEffect(() => {
    if (binaryTheme === 'dark') {
      setMode('dark');
    } else {
      setMode('light');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [binaryTheme]);

  return {
    appTheme,
    appThemeText,
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
  const binaryTheme = useGetAppThemeMode();
  const colors = ThemeColors[binaryTheme] as AppColorsVariants;

  const appThemeMode = useGetAppThemeMode();
  const isLight = appThemeMode === 'light';

  const cs = React.useMemo(() => {
    return {
      colors,
      styles: getStyle(colors) as ReturnType<T>,
    };
  }, [colors, getStyle]);

  return {
    ...cs,
    appThemeMode,
    isLight,
  };
}
