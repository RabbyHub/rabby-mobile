import React from 'react';
import {
  ColorSchemeName,
  Appearance,
  useColorScheme,
  AppState,
  Platform,
} from 'react-native';
import { atom, useAtom, useAtomValue } from 'jotai';

import {
  ThemeColors,
  ThemeColors2024,
  AppColorsVariants,
  AppThemeScheme,
  AppColorSchemes,
  AppColors2024Variants,
} from '@/constant/theme';
import { atomByMMKV, MMKVStorageStrategy } from '@/core/storage/mmkv';
import { createGetStyles, createGetStyles2024 } from '@/utils/styles';
import { stringUtils } from '@rabby-wallet/base-utils';
import { devLog } from '@/utils/logger';
import { useThemeMode } from '@rneui/themed';
import { TFunction } from 'i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMemoizedFn } from 'ahooks';

export const SHOULD_SUPPORT_DARK_MODE = true;

const FORCE_THEME = 'light' as const;
function coerceBinaryTheme(
  appTheme: AppThemeScheme,
  rnColorScheme: ColorSchemeName = 'light',
): Exclude<ColorSchemeName, null | void> {
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

const ThemeModeStore = atomByMMKV('@AppTheme', 'light' as AppThemeScheme, {
  storage: MMKVStorageStrategy.compatString,
});

// const ThemeModeStore = atom(
//   get => get(ThemeStoreBase),
//   (get, set, valOrFunc) => {
//     const nextValue =
//       typeof valOrFunc === 'function' ? valOrFunc(get(ThemeStoreBase)) : valOrFunc;
//     set(ThemeStoreBase, nextValue);
//   },
// );

export function useGetBinaryMode() {
  const appTheme = useAtomValue(ThemeModeStore);
  const colorScheme = useColorScheme();

  return coerceBinaryTheme(appTheme, colorScheme);
}

export function makeThemeOptions(t: TFunction) {
  return [
    {
      title: t('global.themeMode.option_System'),
      value: 'system' as const,
    },
    {
      title: t('global.themeMode.option_Light'),
      value: 'light' as const,
    },
    {
      title: t('global.themeMode.option_Dark'),
      value: 'dark' as const,
    },
  ] as const;
}

export function useAppThemeConfig() {
  const appTheme = useAtomValue(ThemeModeStore);
  return appTheme;
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

      setAppTheme(prev => {
        if (!nextTheme) {
          nextTheme =
            AppColorSchemes[
              (AppColorSchemes.indexOf(prev) + 1) % AppColorSchemes.length
            ];
        }
        Appearance.setColorScheme(appThemeToColorScheme(nextTheme));
        return nextTheme;
      });
    },
    [setAppTheme],
  );

  const binaryTheme: ColorSchemeName = React.useMemo(
    () => coerceBinaryTheme(appTheme, colorScheme),
    [appTheme, colorScheme],
  );

  React.useEffect(() => {
    if (!options?.isAppTop) return;

    Appearance.setColorScheme(appThemeToColorScheme(appTheme));
  }, [options?.isAppTop, appTheme]);

  const { setMode: rneui_setMode } = useThemeMode();

  const setRneuiMode = useMemoizedFn(rneui_setMode);
  React.useEffect(() => {
    if (!options?.isAppTop) return;

    setRneuiMode(colorScheme === 'dark' ? 'dark' : 'light');
  }, [options?.isAppTop, setRneuiMode, colorScheme]);

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
  }, [options?.isAppTop]);

  return {
    appTheme,
    binaryTheme,
    toggleThemeMode,
  };
};

export const useThemeColors = (): AppColorsVariants => {
  const binaryTheme = useGetBinaryMode();

  return ThemeColors[binaryTheme];
};

export function useThemeStyles<T extends ReturnType<typeof createGetStyles>>(
  _getStyle: T,
  opts?: { isLight?: boolean },
) {
  const appThemeMode = useGetBinaryMode();
  const colors = ThemeColors[appThemeMode] as AppColorsVariants;

  const isLight =
    typeof opts?.isLight === 'boolean'
      ? opts?.isLight
      : appThemeMode === 'light';

  const { bottom: bottomSafeArea } = useSafeAreaInsets();

  const getStyle = useMemoizedFn(_getStyle || makeNoop());

  const cs = React.useMemo(() => {
    return {
      colors,
      styles: getStyle(colors, { isLight, bottomSafeArea }) as ReturnType<T>,
    };
  }, [colors, getStyle, isLight, bottomSafeArea]);

  return {
    ...cs,
    appThemeMode,
    isLight,
  };
}

const makeNoop = () => () => void 0;
const isAndroid = Platform.OS === 'android';
export function useTheme2024<
  T extends ReturnType<typeof createGetStyles2024>,
>(opts?: { getStyle?: T; isLight?: boolean }) {
  const appThemeMode = useGetBinaryMode();
  const { bottom: bottomSafeArea } = useSafeAreaInsets();
  // const { getStyle } = opts || {};

  const getStyle = useMemoizedFn(opts?.getStyle || makeNoop());

  const classicalColors = ThemeColors[appThemeMode] as AppColorsVariants;
  const colors2024 = ThemeColors2024[appThemeMode] as AppColors2024Variants;

  const isLight =
    typeof opts?.isLight === 'boolean'
      ? opts?.isLight
      : appThemeMode === 'light';

  const cs = React.useMemo(() => {
    return {
      styles: getStyle?.({
        colors: classicalColors,
        colors2024,
        classicalColors,
        isLight,
        bottomSafeArea,
        // androidOnlyBottomSafeArea: isAndroid ? bottomSafeArea : 0,
      }) as T extends void ? void : ReturnType<T>,
    };
  }, [colors2024, classicalColors, getStyle, isLight, bottomSafeArea]);

  return {
    ...cs,
    colors: classicalColors,
    classicalColors,
    colors2024,
    appThemeMode,
    isLight,
  };
}
