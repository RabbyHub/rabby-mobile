import { ScreenLayouts } from '@/constant/layout';
import { isNil } from 'lodash';
import React from 'react';

import { View } from 'react-native';
import { useSafeSizes } from '@/hooks/useAppLayout';

export default function RootScreenContainer({
  children,
  style,
  fitStatuBar,
  hideBottomBar,
  top: topProp,
}: React.PropsWithChildren<{
  fitStatuBar?: boolean;
  style?: React.ComponentProps<typeof View>['style'];
  hideBottomBar?: boolean;
  top?: number;
}>) {
  const { safeOffHeader } = useSafeSizes();

  return (
    <View
      style={[
        style,
        fitStatuBar && { marginTop: -1 },
        !hideBottomBar && { paddingBottom: ScreenLayouts.bottomBarHeight },
        // eslint-disable-next-line react-native/no-inline-styles
        {
          // Same content offset as `NormalScreenContainer`: a native header can
          // be taller than `headerAreaHeight + top` (the Duo outer screen
          // reports top = 0 while the bar is 82pt), and content must not slide
          // under its translucent edge.
          paddingTop: isNil(topProp)
            ? safeOffHeader
            : topProp + ScreenLayouts.headerAreaHeight,
          flexDirection: 'column',
          height: '100%',
        },
      ]}>
      {children}
    </View>
  );
}
