import { Metrics, useSafeAreaInsets } from 'react-native-safe-area-context';
import { HeaderHeightContext } from '@react-navigation/elements';

import { ScreenLayouts } from '@/constant/layout';
import { Dimensions, Platform, StatusBar, type ScaledSize } from 'react-native';
import { useContext, useMemo } from 'react';
import { makeMutable } from 'react-native-reanimated';
import { isEqual } from 'lodash';
import { zCreate } from '@/core/utils/reexports';

const isAndroid = Platform.OS === 'android';

export const svsLayout = {
  insets: makeMutable<Metrics['insets']>({
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  }),
  winLayout: makeMutable(Dimensions.get('window')),
  screenLayout: makeMutable(Dimensions.get('screen')),
};

export function startWatchLayoutChange() {
  const syncLayout = ({
    window,
    screen,
  }: {
    window: ScaledSize;
    screen: ScaledSize;
  }) => {
    if (!isEqual(svsLayout.winLayout.value, window)) {
      svsLayout.winLayout.value = window;
    }

    if (!isEqual(svsLayout.screenLayout.value, screen)) {
      svsLayout.screenLayout.value = screen;
    }
  };

  // The initial native size is captured when this module loads, which can be
  // before `SafeWindowFrame` publishes the reduced foldable width. Sync once
  // when the listener starts so `AppDimensions` does not keep the native
  // 466pt width while React Native's Dimensions is already 382pt.
  syncLayout({
    window: Dimensions.get('window'),
    screen: Dimensions.get('screen'),
  });

  Dimensions.addEventListener('change', syncLayout);
}

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
  const { top, right, bottom } = useSafeAreaInsets();
  const navigationHeaderHeight = useContext(HeaderHeightContext);
  const baseOffHeader = ScreenLayouts.headerAreaHeight + top;
  // iOS foldable outer screen: the app is letterboxed to the left of the
  // system column, so safe-area-context reports `top = 0` even though the
  // native stack header still reserves a status-bar-sized top inset. Using
  // only `headerAreaHeight + top` then puts the content ~31pt too high and
  // the first label slides under the header's translucent edge.
  const usesSideStatusColumn = Platform.OS === 'ios' && right > 0;
  const safeOffHeader =
    usesSideStatusColumn &&
    typeof navigationHeaderHeight === 'number' &&
    navigationHeaderHeight > 0
      ? Math.max(baseOffHeader, navigationHeaderHeight + 12)
      : baseOffHeader;
  // Custom in-screen headers do not get the native stack header's automatic
  // status-bar inset. On the iPhone Duo outer screen safe-area-context reports
  // `top = 0`, while the native header still reserves ~38pt above its 44pt bar.
  // Reuse the measured native height when available, and fall back to the
  // device-specific inset that the foldable frame was validated against.
  const foldableStatusBarTop = 38;
  const nativeHeaderTopInset =
    typeof navigationHeaderHeight === 'number' && navigationHeaderHeight > 44
      ? navigationHeaderHeight - 44
      : foldableStatusBarTop;
  const safeHeaderTop = usesSideStatusColumn
    ? Math.max(top, nativeHeaderTopInset)
    : top;

  return {
    safeTop: top,
    safeHeaderTop,
    headerHeight: ScreenLayouts.headerAreaHeight,
    safeOffHeader,
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
 * Top inset for JS-owned headers.
 *
 * Native stack headers reserve a status-bar inset even when the app is
 * letterboxed to the left of the Duo system column and safe-area-context
 * reports `top = 0`. Custom `header:` renderers must reproduce that inset or
 * they sit at the very top of the screen.
 */
export function useCustomHeaderTop() {
  const { top, right } = useSafeAreaInsets();
  return top > 0 ? top : right > 0 ? 38 : 0;
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
