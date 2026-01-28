import { Metrics, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenLayouts } from '@/constant/layout';
import { Dimensions, Platform, StatusBar } from 'react-native';
import { useMemo } from 'react';
import { zCreate } from '@/core/utils/reexports';

const isAndroid = Platform.OS === 'android';

const safeAreaMetricsStore = zCreate<{
  insets: Metrics['insets'];
}>(() => {
  return {
    insets: { top: 0, bottom: 0, left: 0, right: 0 },
    // frame: {
    //   x: 0, y: 0,
    //   width: Dimensions.get('window').width,
    //   height: Dimensions.get('window').height,
    // },
  };
});

export const storeApiAppLayout = {
  getSafeAreaInsets: () => safeAreaMetricsStore.getState().insets,
  setSafeAreaMetrics: (metrics: Partial<Metrics>) => {
    safeAreaMetricsStore.setState({
      ...(metrics.insets && { insets: metrics.insets }),
      // ...metrics.frame && { frame: metrics.frame },
    });
  },
};

export function getVerticalLayoutHeights() {
  const screenHeight = Dimensions.get('screen').height;
  const windowHeight = Dimensions.get('window').height;
  const statusbarHeight = StatusBar.currentHeight || 24;

  const androidSystembarHeight = screenHeight - windowHeight - statusbarHeight;

  return {
    screenHeight,
    windowHeight,
    statusbarHeight,
    androidSystembarHeight: isAndroid ? androidSystembarHeight : 0,
  };
}

export function useSafeSizes() {
  const { top, bottom } = useSafeAreaInsets();

  return {
    safeTop: top,
    headerHeight: ScreenLayouts.headerAreaHeight,
    safeOffHeader: ScreenLayouts.headerAreaHeight + top,
    safeOffScreenTop: Dimensions.get('screen').height - top,
    safeOffBottom: bottom,
    /**
     * @description on android, systembar's height is 0 when it's on gesture mode, but it's not 0 when it's on classic mode.
     *
     * in most cases, it equals to `screenHeight - windowHeight - statusbarHeight`
     */
    systembarOffsetBottom: bottom,
    androidOnlyBottomOffset: isAndroid ? bottom : 0,
  };
}

/**
 * @description pass inputs with key-value pairs, the value should be a number which means the original size
 * if it's not on android's navigation mode(3 buttons mode).
 */
export function useSafeAndroidBottomSizes<T extends Record<string, number>>(
  inputs: T,
) {
  const { bottom } = useSafeAreaInsets();

  const androidBottomOffset = isAndroid ? bottom : 0;
  const { safeSizes, cutOffSizes } = useMemo(() => {
    const outpus = {
      safeSizes: { ...inputs },
      cutOffSizes: { ...inputs },
    };

    return Object.entries(inputs).reduce((acc, [key, value]) => {
      // @ts-expect-error
      acc.safeSizes[key] = isAndroid ? value + bottom : acc.safeSizes[key];
      // @ts-expect-error
      acc.cutOffSizes[key] = isAndroid
        ? Math.max(0, value - bottom)
        : acc.cutOffSizes[key];

      return acc;
    }, outpus);
  }, [bottom, inputs]);

  return { safeSizes, cutOffSizes, androidBottomOffset };
}

export function useSafeOffTop<T extends Record<string, number>>(values: T) {
  const { top: topValue } = useSafeAreaInsets();

  const result = useMemo(() => {
    const fromWin = Dimensions.get('window');
    const fromScr = Dimensions.get('screen');
    // fromScr.height - ScreenWithAccountSwitcherLayouts.screenHeaderHeight - top

    const offWindow = {} as Record<keyof T, number>;
    const offScreen = {} as Record<keyof T, number>;

    Object.keys(values).forEach((key: keyof T) => {
      offWindow[key] = fromWin.height - topValue - values[key];
      offScreen[key] = fromScr.height - topValue - values[key];
    });

    return { offWindow, offScreen };
  }, [topValue, values]);

  return {
    topValue,
    ...result,
  };
}
