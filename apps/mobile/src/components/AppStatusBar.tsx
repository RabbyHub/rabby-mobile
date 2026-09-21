import React, { useEffect, useMemo } from 'react';

import { useCurrentRouteName, useRabbyAppNavigation } from '@/hooks/navigation';
import { useGetBinaryMode } from '@/hooks/theme';
import { getScreenSystemBarConfig } from '@/constant/layout';
import { getLatestNavigationName } from '@/utils/navigation';
import { syncAppSystemBars } from '@/utils/systemBarController';
import { NativeStackNavigationOptions } from '@react-navigation/native-stack';

export function useSafeSetNavigationOptions() {
  const navigation = useRabbyAppNavigation();

  const setNavigationOptions = React.useCallback(
    (options: NativeStackNavigationOptions) => {
      return navigation.setOptions(options);
    },
    [navigation],
  );

  return { navigation, setNavigationOptions };
}

function useScreenSystemBarStyle() {
  const { currentRouteName: currentRouteNameOrig } = useCurrentRouteName();
  const currentRouteName = useMemo(() => {
    return getLatestNavigationName() || currentRouteNameOrig;
  }, [currentRouteNameOrig]);

  const isLight = useGetBinaryMode() === 'light';

  return useMemo(() => {
    return getScreenSystemBarConfig({
      screenName: currentRouteName || '@default',
      isDarkTheme: !isLight,
    }).statusBarStyle;
  }, [currentRouteName, isLight]);
}

export function AppStatusBar() {
  const statusBarStyle = useScreenSystemBarStyle();

  useEffect(() => {
    syncAppSystemBars(statusBarStyle);
  }, [statusBarStyle]);

  return null;
}
