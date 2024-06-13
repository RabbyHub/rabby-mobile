import React, { useMemo } from 'react';
import { Platform, StatusBar } from 'react-native';

import { useCurrentRouteNameInAppStatusBar } from '@/hooks/navigation';
import { useGetAppThemeMode, useThemeColors } from '@/hooks/theme';
import { useHasActiveOpenedDapp } from '@/screens/Dapps/hooks/useDappView';
import {
  AppRootName,
  ScreenStatusBarConf,
  getRootSpecConfig,
} from '@/constant/layout';
import useDebounceValue from '@/hooks/common/useDebounceValue';

const isAndroid = Platform.OS === 'android';

export function useTuneStatusBar() {
  const colors = useThemeColors();
  const isDarkTheme = useGetAppThemeMode() !== 'light';

  const tuneStatusBar = React.useCallback(
    (currentScreen?: AppRootName | string | ScreenStatusBarConf) => {
      const specs = getRootSpecConfig(colors, { isDarkTheme });
      const spec =
        typeof currentScreen === 'string'
          ? specs[currentScreen as AppRootName] || specs['@default']
          : {
              ...specs['@default'],
              ...currentScreen,
            };

      const { statusBarStyle, androidStatusBarBg } = spec;
      if (statusBarStyle) {
        StatusBar.setBarStyle(statusBarStyle, true);
      }

      if (isAndroid && androidStatusBarBg) {
        StatusBar.setBackgroundColor(androidStatusBarBg, true);
      }

      if (isAndroid) {
        StatusBar.setTranslucent(true);
      }

      return spec;
    },
    [colors, isDarkTheme],
  );

  return {
    colors,
    isDarkTheme,
    tuneStatusBar,
  };
}

export function AppStatusBar() {
  const currentRouteNameOrig = useCurrentRouteNameInAppStatusBar();
  const isLight = useGetAppThemeMode() === 'light';
  const colors = useThemeColors();

  // maybe we need more smooth transition on toggle active dapp
  const hasActiveOpenedDapp = useHasActiveOpenedDapp();

  const currentRouteName = useDebounceValue(currentRouteNameOrig, 250);

  const rootSpecs = useMemo(() => {
    return getRootSpecConfig(colors, { isDarkTheme: !isLight });
  }, [isLight, colors]);

  const routeStatusbarConf = useMemo(() => {
    if (hasActiveOpenedDapp) {
      return rootSpecs['@openeddapp'];
    }
    return currentRouteName
      ? rootSpecs[currentRouteName as any as AppRootName]
      : rootSpecs['@default'];
  }, [currentRouteName, hasActiveOpenedDapp, rootSpecs]);

  return (
    <StatusBar
      animated
      translucent
      backgroundColor={
        routeStatusbarConf?.androidStatusBarBg ||
        rootSpecs['@default'].androidStatusBarBg
      }
      barStyle={
        routeStatusbarConf?.statusBarStyle ||
        rootSpecs['@default'].statusBarStyle
      }
    />
  );
}
