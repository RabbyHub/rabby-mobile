import React, { useMemo } from 'react';
import { Appearance, Platform, StatusBar } from 'react-native';

import { useCurrentRouteName, useRabbyAppNavigation } from '@/hooks/navigation';
import { useGetBinaryMode } from '@/hooks/theme';
import { useOpenedActiveDappState } from '@/screens/Dapps/hooks/useDappView';
import {
  AppRootName,
  ScreenStatusBarConf,
  getScreenStatusBarConf,
} from '@/constant/layout';
import { getLatestNavigationName } from '@/utils/navigation';
import { NativeStackNavigationOptions } from '@react-navigation/native-stack';

const IS_ANDROID = Platform.OS === 'android';
export const USE_ANDROID_STATUS_BAR_TRANSPARENT = true;

export function useSafeSetNavigationOptions() {
  const navigation = useRabbyAppNavigation();
  const { hasActiveDapp: isShowingDappCard } = useOpenedActiveDappState();

  const setNavigationOptions = React.useCallback(
    (options: NativeStackNavigationOptions) => {
      if (!IS_ANDROID) {
        return navigation.setOptions(options);
      }

      const appColorScheme = Appearance.getColorScheme();
      const isDarkTheme = appColorScheme === 'dark';

      const screenName = getLatestNavigationName();
      if (screenName) {
        const { screenSpec } = getScreenStatusBarConf({
          screenName,
          isDarkTheme,
          isShowingDappCard,
        });

        options = {
          /* in fact, you also need set it on Android */
          statusBarStyle:
            screenSpec.barStyle === 'dark-content' ? 'dark' : 'light',
          statusBarColor: screenSpec.androidStatusBarBg,
          // ...(!IS_ANDROID && {
          //   statusBarStyle: screenSpec.iosStatusBarStyle,
          // }),
          ...options,
        };
      }

      return navigation.setOptions(options);
    },
    [navigation, isShowingDappCard],
  );

  return { navigation, setNavigationOptions };
}

function useTuneStatusBar() {
  const _isDarkTheme = useGetBinaryMode() !== 'light';
  const { hasActiveDapp: isShowingDappCard } = useOpenedActiveDappState();

  const tuneStatusBar = React.useCallback(
    (options: {
      currentScreen: AppRootName | string | ScreenStatusBarConf;
      isDarkTheme?: boolean;
    }) => {
      const { currentScreen, isDarkTheme = _isDarkTheme } = options || {};

      const screenSpec =
        typeof currentScreen === 'object'
          ? currentScreen
          : getScreenStatusBarConf({
              screenName: currentScreen,
              isDarkTheme,
              isShowingDappCard,
            }).screenSpec;

      const { barStyle, iosStatusBarStyle, androidStatusBarBg } = screenSpec;

      if (IS_ANDROID && androidStatusBarBg) {
        StatusBar.setTranslucent(true);
        StatusBar.setBackgroundColor(androidStatusBarBg, true);
      }
      if (barStyle) {
        StatusBar.setBarStyle(barStyle, true);
      }
    },
    [isShowingDappCard, _isDarkTheme],
  );

  return {
    tuneStatusBar,
  };
}

/**
 * @description hooks version of AppStatusBar
 *
 * We found, sometimes as property `backgroundColor` passed to StatuBar component, it will not update the StatusBar, or not correctly,
 * so we do command-based update on route change.
 */
export function useTuneStatusBarOnRouteChange() {
  const { tuneStatusBar } = useTuneStatusBar();

  const tuneOnRouteChange = React.useCallback(
    (currentRouteName?: string) => {
      currentRouteName = currentRouteName || getLatestNavigationName()!;

      __DEV__ &&
        console.debug('tuneOnRouteChange::currentRouteName', currentRouteName);
      tuneStatusBar({ currentScreen: currentRouteName });

      return currentRouteName;
    },
    [tuneStatusBar],
  );

  return { tuneOnRouteChange };
}

export function useScreenAppStatusBarConf(expectedRoute?: string) {
  const { currentRouteName: currentRouteNameOrig } = useCurrentRouteName();
  const currentRouteName = useMemo(() => {
    return expectedRoute || getLatestNavigationName() || currentRouteNameOrig;
  }, [currentRouteNameOrig, expectedRoute]);

  // const currentRouteNameOrig = useCurrentRouteName();
  // const currentRouteName = useMemo(() => {
  //   return getLatestNavigationName() || currentRouteNameOrig;
  // }, [currentRouteNameOrig]);

  const isLight = useGetBinaryMode() === 'light';

  // maybe we need more smooth transition on toggle active dapp
  const { hasActiveDapp: isShowingDappCard } = useOpenedActiveDappState();

  const { rootSpecs, screenSpec: routeStatusbarConf } = useMemo(() => {
    return getScreenStatusBarConf({
      screenName: currentRouteName || '@default',
      isDarkTheme: !isLight,
      isShowingDappCard,
    });
  }, [isLight, currentRouteName, isShowingDappCard]);

  return {
    currentRouteName,
    isLight,
    rootSpecs,
    routeStatusbarConf,
  };
}

/**
 * @description this component is used on Top of the App, only one instance
 */
export function AppStatusBar({ __isTop__ }: { __isTop__?: boolean }) {
  const { isLight, currentRouteName, rootSpecs, routeStatusbarConf } =
    useScreenAppStatusBarConf();

  if (!__isTop__) return null;

  return (
    <StatusBar
      animated
      translucent={USE_ANDROID_STATUS_BAR_TRANSPARENT}
      backgroundColor={
        routeStatusbarConf.androidStatusBarBg ||
        rootSpecs['@default'].androidStatusBarBg
      }
      barStyle={routeStatusbarConf.barStyle || 'default'}
    />
  );
}
