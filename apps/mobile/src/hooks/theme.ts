import React, { useMemo } from 'react';
import {
  ColorSchemeName,
  Appearance,
  useColorScheme,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ThemeColors,
  ThemeColors2024,
  AppColorsVariants,
  AppThemeScheme,
  AppColorSchemes,
  AppColors2024Variants,
} from '@/constant/theme';
import {
  appJsonStore,
  MMKVStorageStrategy,
  zustandByMMKV,
} from '@/core/storage/mmkv';
import { createGetStyles, createGetStyles2024 } from '@/utils/styles';
import { devLog } from '@/utils/logger';
import { useThemeMode } from '@rneui/themed';
import { TFunction } from 'i18next';
import { useMemoizedFn } from 'ahooks';
import { runDevIIFEFunc } from '@/core/utils/store';
import { useCreationWithShallowCompare } from './common/useMemozied';

export const SHOULD_SUPPORT_DARK_MODE = true;

function isValidAppTheme(themMode: any) {
  return ['light', 'dark', 'system'].includes(themMode);
}

function coerceFinalThemeValue<T extends AppThemeScheme | ColorSchemeName>(
  input: T,
  defaultValue: T,
): T {
  switch (input) {
    default:
      return defaultValue;
    case 'light':
      return 'light' as T;
    case 'dark':
      return 'dark' as T;
    case 'system':
      return 'system' as T;
  }
}

const FORCE_THEME = 'light' as const;
function coerceBinaryTheme(
  appTheme: AppThemeScheme,
  rnColorScheme: ColorSchemeName = 'light',
): Exclude<ColorSchemeName, null | void> {
  if (SHOULD_SUPPORT_DARK_MODE) {
    return appTheme === 'system'
      ? rnColorScheme || 'light'
      : coerceFinalThemeValue(appTheme, 'light');
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

// runDevIIFEFunc(() => {
//   appJsonStore.setItem('@AppTheme', 'dark');
// });

const themeModeStore = zustandByMMKV<{ appTheme: AppThemeScheme }>(
  '@AppTheme',
  { appTheme: 'light' },
  {
    storage: MMKVStorageStrategy.compatString,
    migrateFromAtom(ctx) {
      const newData = {
        state: {
          appTheme: (isValidAppTheme(ctx.oldData)
            ? ctx.oldData
            : 'light') as AppThemeScheme,
        },
        version: 0,
      };
      ctx.appJsonStore.setItem(ctx.key, newData);

      return { migrated: newData.state };
    },
  },
);

function toggleThemeMode(nextTheme?: AppThemeScheme) {
  // throw new Error(`cannot specify theme node!`);

  themeModeStore.setState(prev => {
    if (!nextTheme) {
      nextTheme =
        AppColorSchemes[
          (AppColorSchemes.indexOf(prev.appTheme) + 1) % AppColorSchemes.length
        ];
    }
    Appearance.setColorScheme(appThemeToColorScheme(nextTheme));
    return { ...prev, appTheme: nextTheme };
  });
}

function getBinaryMode(appTheme = themeModeStore.getState().appTheme) {
  const colorScheme = Appearance.getColorScheme();

  return coerceBinaryTheme(appTheme, colorScheme);
}

export function useGetBinaryMode() {
  const appTheme = themeModeStore(s => s.appTheme);
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
  const appTheme = themeModeStore(s => s.appTheme);
  return appTheme;
}

// The useColorScheme value is always either light or dark, but the built-in
// type suggests that it can be null. This will not happen in practice, so this
// makes it a bit easier to work with.
export const useAppTheme = (options?: { isAppTop?: boolean }) => {
  const appTheme = themeModeStore(s => s.appTheme);
  const colorScheme = useColorScheme();

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

  const { safeAreaInsets } = useStyleSafeAreaInsets();
  const getStyle = useMemoizedFn(_getStyle || makeNoop());

  const cs = React.useMemo(() => {
    return {
      colors,
      styles: getStyle(colors, { isLight, safeAreaInsets }) as ReturnType<T>,
    };
  }, [colors, getStyle, isLight, safeAreaInsets]);

  return {
    ...cs,
    appThemeMode,
    isLight,
  };
}

const makeNoop = () => () => void 0;

export const apisTheme = {
  getBinaryMode,
  getColors2024,
};

export function getColors2024(
  appThemeMode: ReturnType<typeof getBinaryMode> = getBinaryMode(),
) {
  const classicalColors = ThemeColors[appThemeMode] as AppColorsVariants;
  const colors2024 = ThemeColors2024[appThemeMode] as AppColors2024Variants;

  return {
    isLight: appThemeMode !== 'dark',
    classicalColors,
    colors: classicalColors,
    colors2024,
  };
}

function useStyleSafeAreaInsets() {
  const safeAreaInsetsOrig = useSafeAreaInsets();
  const safeAreaInsets = useMemo(() => {
    return {
      top: safeAreaInsetsOrig.top,
      bottom: safeAreaInsetsOrig.bottom,
      left: safeAreaInsetsOrig.left,
      right: safeAreaInsetsOrig.right,
    };
  }, [
    safeAreaInsetsOrig.top,
    safeAreaInsetsOrig.bottom,
    safeAreaInsetsOrig.left,
    safeAreaInsetsOrig.right,
  ]);

  return { safeAreaInsets };
}

export function useTheme2024<
  T extends ReturnType<typeof createGetStyles2024>,
>(opts?: { getStyle?: T; isLight?: boolean }) {
  const appThemeMode = useGetBinaryMode();
  const { safeAreaInsets } = useStyleSafeAreaInsets();
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
        safeAreaInsets,
      }) as T extends void ? void : ReturnType<T>,
    };
  }, [colors2024, classicalColors, getStyle, isLight, safeAreaInsets]);

  return {
    ...cs,
    colors: classicalColors,
    classicalColors,
    colors2024,
    appThemeMode,
    isLight,
  };
}
