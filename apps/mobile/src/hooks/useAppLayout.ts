import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenLayouts } from '@/constant/layout';
import { Dimensions, Platform, StatusBar } from 'react-native';

export function getVerticalLayoutHeights() {
  const screenHeight = Dimensions.get('screen').height;
  const windowHeight = Dimensions.get('window').height;
  const statusbarHeight = StatusBar.currentHeight || 24;

  const androidSystembarHeight = screenHeight - windowHeight - statusbarHeight;

  return {
    screenHeight,
    windowHeight,
    statusbarHeight,
    androidSystembarHeight:
      Platform.OS === 'android' ? androidSystembarHeight : 0,
  };
}

export function useSafeSizes() {
  const { top, bottom } = useSafeAreaInsets();

  return {
    safeTop: top,
    safeOffHeader: ScreenLayouts.headerAreaHeight + top,
    safeOffScreenTop: Dimensions.get('screen').height - top,
    safeOffBottom: bottom,
    /**
     * @description on android, systembar's height is 0 when it's on gesture mode, but it's not 0 when it's on classic mode.
     *
     * in most cases, it equals to `screenHeight - windowHeight - statusbarHeight`
     */
    systembarOffsetBottom: bottom,
  };
}
