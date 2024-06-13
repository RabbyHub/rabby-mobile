import { useIsFocused } from '@react-navigation/native';
import { StatusBar, StatusBarProps } from 'react-native';

import { useThemeColors, useGetAppThemeMode } from '@/hooks/theme';
import { useMemo } from 'react';
import { getRootSpecConfig } from '@/constant/layout';
import { useCurrentRouteNameInAppStatusBar } from '@/hooks/navigation';

/**
 * @description this component can be ONLY used in navigation screens
 *
 * @deprecated this component is deprecated, set your screen's status bar config by one of the following ways:
 * - in `getRootSpecConfig` in `constant/layout.ts` instead
 * - or just use `ScreenSpecificStatusBar` component directly in your screen
 *
 */
export const FocusAwareStatusBar = (props: StatusBarProps) => {
  const isFocused = useIsFocused();
  const colors = useThemeColors();
  const isLight = useGetAppThemeMode() === 'light';

  return isFocused ? (
    <StatusBar
      backgroundColor={colors['neutral-bg-1']}
      barStyle={isLight ? 'dark-content' : 'light-content'}
      translucent
      {...props}
    />
  ) : null;
};

export const ScreenSpecificStatusBar = (props: StatusBarProps) => {
  const colors = useThemeColors();
  const isLight = useGetAppThemeMode() === 'light';
  const currentRouteName = useCurrentRouteNameInAppStatusBar();
  const routeConf = useMemo(() => {
    const confs = getRootSpecConfig(colors, { isDarkTheme: !isLight });
    if (!currentRouteName) return confs['@default']!;

    return confs[currentRouteName] || confs['@default']!;
  }, [colors, currentRouteName, isLight]);

  return (
    <FocusAwareStatusBar
      backgroundColor={routeConf.androidStatusBarBg || colors['neutral-bg-1']}
      barStyle={
        routeConf.statusBarStyle || (isLight ? 'dark-content' : 'light-content')
      }
      {...props}
    />
  );
};
