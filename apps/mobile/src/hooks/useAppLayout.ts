import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenLayouts } from '@/constant/layout';
import { Dimensions } from 'react-native';

export function useSafeSizes() {
  const { top, bottom } = useSafeAreaInsets();

  return {
    safeTop: top,
    safeOffHeader: ScreenLayouts.headerAreaHeight + top,
    safeOffScreenTop: Dimensions.get('screen').height - top,
    safeOffBottom: bottom,
  };
}
