import React, { useEffect, useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCurrentRouteName, useRabbyAppNavigation } from '@/hooks/navigation';
import { useGetBinaryMode } from '@/hooks/theme';
import { useOpenedActiveDappState } from '@/screens/Dapps/hooks/useDappView';
import {
  ScreenSystemBarConfig,
  getScreenSystemBarConfig,
} from '@/constant/layout';
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

function useScreenSystemBarConfig() {
  const { currentRouteName: currentRouteNameOrig } = useCurrentRouteName();
  const currentRouteName = useMemo(() => {
    return getLatestNavigationName() || currentRouteNameOrig;
  }, [currentRouteNameOrig]);

  const isLight = useGetBinaryMode() === 'light';
  const { hasActiveDapp: isShowingDappCard } = useOpenedActiveDappState();

  return useMemo<ScreenSystemBarConfig>(() => {
    return getScreenSystemBarConfig({
      screenName: currentRouteName || '@default',
      isDarkTheme: !isLight,
      isShowingDappCard,
    });
  }, [currentRouteName, isLight, isShowingDappCard]);
}

export function StatusBarBackground({
  color,
  height,
}: {
  color: string;
  height: number;
}) {
  if (Platform.OS !== 'android' || height <= 0 || color === 'transparent') {
    return null;
  }

  return (
    <View
      pointerEvents="none"
      style={[styles.statusBarBackground, { backgroundColor: color, height }]}
    />
  );
}

export function AppStatusBar() {
  const { top } = useSafeAreaInsets();
  const config = useScreenSystemBarConfig();

  useEffect(() => {
    syncAppSystemBars(config);
  }, [config]);

  return (
    <>
      <StatusBarBackground
        color={config.statusBarBackgroundColor}
        height={top}
      />
    </>
  );
}

const styles = StyleSheet.create({
  statusBarBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
});
