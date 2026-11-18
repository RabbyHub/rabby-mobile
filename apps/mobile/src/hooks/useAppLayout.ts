import { Metrics, useSafeAreaInsets } from 'react-native-safe-area-context';
import { HeaderHeightContext } from '@react-navigation/elements';

import { ScreenLayouts } from '@/constant/layout';
import { Dimensions, Platform, StatusBar, type ScaledSize } from 'react-native';
import { useContext, useMemo } from 'react';
import { makeMutable } from 'react-native-reanimated';
import { isEqual } from 'lodash';
import { zCreate } from '@/core/utils/reexports';
import { isFoldableSideColumnPosture } from '@/core/utils/foldableDevice';

const isAndroid = Platform.OS === 'android';

/**
 * Offset applied above JS-owned headers on the iPhone Duo outer screen.
 *
 * This is NOT the status bar height: on the letterboxed outer window
 * `StatusBarManager.getHeight()` reports 2pt and `safe-area-context` reports
 * `top = 0`. The value is the visual alignment point of the native header's
 * own title/back control on that device (measured `navigationHeaderHeight`
 * 82pt, native title center ~48pt): a 52pt JS header row centred on it starts
 * 22pt from the window top. Verified against Send/Settings at 48.5pt vs
 * 47.9pt.
 *
 * Only applied when `isFoldableSideColumnPosture()` matches: iOS, a listed
 * foldable device id, iOS >= 27, and the letterboxed outer window signature
 * (`right > 0`, `top = 0`).
 */
const FOLDABLE_HEADER_TOP = 22;

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
  //
  // Gated on the exact device id + iOS major version + letterbox signature so
  // no other phone/iPad posture can pick up the compensation.
  const usesSideStatusColumn = isFoldableSideColumnPosture({ top, right });
  const safeOffHeader =
    usesSideStatusColumn &&
    typeof navigationHeaderHeight === 'number' &&
    navigationHeaderHeight > 0
      ? Math.max(baseOffHeader, navigationHeaderHeight + 12)
      : baseOffHeader;
  // Custom in-screen headers do not get a native stack header, so they have
  // to be aligned to where the native bar would have put its own title. That
  // point is calibrated per device (see `FOLDABLE_HEADER_TOP`), not derived
  // from the native header height: the bar is 82pt tall on the Duo outer
  // screen but its title sits ~48pt from the window top, while a 52pt JS row
  // centred there starts at 22pt.
  const safeHeaderTop = usesSideStatusColumn ? FOLDABLE_HEADER_TOP : top;

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
 * On the Duo outer screen the native header is aligned below an inset that
 * safe-area-context does not report (`top = 0`), so JS-owned `header:`
 * renderers must reproduce it or they sit at the very top of the screen.
 * Every other posture keeps using the real safe-area top.
 */
export function useCustomHeaderTop() {
  const { top, right } = useSafeAreaInsets();
  return top > 0
    ? top
    : isFoldableSideColumnPosture({ top, right })
    ? FOLDABLE_HEADER_TOP
    : 0;
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
